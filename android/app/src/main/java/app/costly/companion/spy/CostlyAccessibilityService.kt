package app.costly.companion.spy

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import app.costly.companion.Prefs
import app.costly.companion.net.HeartbeatRequest
import app.costly.companion.net.Network
import app.costly.companion.net.StartSessionRequest
import app.costly.companion.notify.Notifier
import app.costly.companion.overlay.CostlyOverlayService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

/**
 * THE SPY.
 *
 * Watches TYPE_WINDOW_STATE_CHANGED to know which package owns the screen and
 * TYPE_VIEW_SCROLLED to know whether the user is actually scrolling. While a
 * blocked package is foregrounded it runs the billable-time loop:
 *
 *  - tick every 5s; seconds only count while the last scroll was <60s ago
 *    (IDLE_TIMEOUT) — a phone lying open on TikTok while its owner sleeps
 *    accrues nothing;
 *  - flush a heartbeat to the backend every ~30s (the server enforces the
 *    financial cap and answers with taunts to surface);
 *  - when the vice app leaves the foreground (with a short debounce so the
 *    keyboard or a permission dialog doesn't end a session), flush the last
 *    delta and POST /end — that call is the Stripe moment.
 *
 * The system owns this service's lifecycle: it can kill and rebind it at any
 * time. The active server session id is persisted in Prefs, so a rebind
 * resumes the same session instead of orphaning an ACTIVE row on the backend
 * (the backend also answers /start with the existing ACTIVE session).
 */
class CostlyAccessibilityService : AccessibilityService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()

    private var tickerJob: Job? = null
    private var endDebounceJob: Job? = null

    // Session state — only touched under [mutex].
    private var sessionId: String? = null
    private var sessionPackage: String? = null
    private var lastScrollAtMs: Long = 0
    private var lastTickMs: Long = 0
    private var unsentActiveSeconds: Int = 0     // pending flush to backend
    private var sessionActiveSeconds: Int = 0    // running total, for the overlay baseline
    private var scrolledSinceFlush: Boolean = false
    private var msSinceFlush: Long = 0

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "Spy bound. Watching: ${Prefs.blockedPackages(this)}")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName || pkg in IGNORED_PACKAGES) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> onForegroundChanged(pkg)
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> onScroll(pkg)
        }
    }

    private fun onForegroundChanged(pkg: String) {
        val blocked = Prefs.blockedPackages(this)
        scope.launch {
            mutex.withLock {
                when {
                    pkg in blocked && sessionId == null -> startSessionLocked(pkg)
                    pkg in blocked && pkg == sessionPackage -> {
                        // Vice app came back within the debounce window — the
                        // user never really left. Keep billing.
                        endDebounceJob?.cancel()
                        endDebounceJob = null
                    }
                    pkg !in blocked && sessionId != null -> scheduleEndLocked()
                }
            }
        }
    }

    private fun onScroll(pkg: String) {
        if (pkg != sessionPackage) return
        lastScrollAtMs = System.currentTimeMillis()
        scrolledSinceFlush = true
    }

    // ── Session lifecycle (all *Locked functions require [mutex]) ─────────

    private suspend fun startSessionLocked(pkg: String) {
        val userId = Prefs.userId(this) ?: return // unarmed — nothing to bill

        val resumedId = Prefs.activeSessionId(this)
        val id = resumedId ?: runCatching {
            Network.api.startSession(StartSessionRequest(userId = userId, appPackage = pkg)).sessionId
        }.getOrElse {
            Log.w(TAG, "start failed (offline?) — session not billed", it)
            return
        }

        Prefs.setActiveSessionId(this, id)
        sessionId = id
        sessionPackage = pkg
        val now = System.currentTimeMillis()
        lastScrollAtMs = now // opening the app counts as activity
        lastTickMs = now
        unsentActiveSeconds = 0
        sessionActiveSeconds = 0
        scrolledSinceFlush = false
        msSinceFlush = 0

        publishMeterLocked()
        if (Settings.canDrawOverlays(this)) {
            CostlyOverlayService.start(this)
        }

        tickerJob?.cancel()
        tickerJob = scope.launch { tickLoop() }
        Log.i(TAG, "Session $id started for $pkg")
    }

    private fun scheduleEndLocked() {
        if (endDebounceJob != null) return
        endDebounceJob = scope.launch {
            delay(END_DEBOUNCE_MS)
            mutex.withLock { endSessionLocked() }
        }
    }

    private suspend fun endSessionLocked() {
        val id = sessionId ?: return
        tickerJob?.cancel()
        tickerJob = null
        endDebounceJob = null

        accumulateLocked()
        flushLocked(force = true)

        runCatching { Network.api.endSession(id) }
            .onSuccess { Log.i(TAG, "Session $id ended: ${it.status}, ${it.totalPenaltyCents}c") }
            .onFailure { Log.w(TAG, "end failed for $id — server expiry sweep is the backstop", it) }

        Prefs.setActiveSessionId(this, null)
        sessionId = null
        sessionPackage = null
        unsentActiveSeconds = 0
        sessionActiveSeconds = 0

        MeterBus.clear()
        CostlyOverlayService.stop(this)
    }

    // ── Billable-time loop ────────────────────────────────────────────────

    private suspend fun tickLoop() {
        while (scope.isActive && sessionId != null) {
            delay(TICK_MS)
            mutex.withLock {
                if (sessionId == null) return@withLock
                accumulateLocked()
                publishMeterLocked()
                msSinceFlush += TICK_MS
                if (msSinceFlush >= FLUSH_MS && flushLocked(force = false)) {
                    // Cap hit mid-session: shove the user out and settle up.
                    performGlobalAction(GLOBAL_ACTION_HOME)
                    endSessionLocked()
                }
            }
        }
    }

    /** Fold wall-clock time since the last tick into billable seconds — unless idle. */
    private fun accumulateLocked() {
        val now = System.currentTimeMillis()
        val elapsedMs = (now - lastTickMs).coerceAtLeast(0)
        lastTickMs = now
        val idle = now - lastScrollAtMs > IDLE_TIMEOUT_MS
        if (!idle) {
            val secs = (elapsedMs / 1000L).toInt()
            unsentActiveSeconds += secs
            sessionActiveSeconds += secs
        }
    }

    /**
     * Publish the authoritative baseline for the overlay. The overlay ticks
     * per-second on its own, but never invents billable time: runningSince is
     * non-null only while the meter is actively counting (not idle), so the
     * bubble advances between spy ticks and snaps to truth on each publish.
     */
    private fun publishMeterLocked() {
        val idle = System.currentTimeMillis() - lastScrollAtMs > IDLE_TIMEOUT_MS
        MeterBus.publish(
            Meter(
                active = true,
                appPackage = sessionPackage,
                activeSeconds = sessionActiveSeconds,
                runningSince = if (idle) null else SystemClock.elapsedRealtime(),
                rateCentsPerMin = Prefs.rateCentsPerMin(this),
                anchors = Prefs.anchors(this).map {
                    AnchorSnapshot(name = it.name, priceCents = it.priceCents, tierLevel = it.tierLevel)
                },
            ),
        )
    }

    /**
     * Push unsent billable time to the backend. Returns true if the server
     * says the session cap was reached — the CALLER decides how to tear the
     * session down, so this never re-enters [endSessionLocked] (which would
     * recurse, since ending a session flushes one last time).
     */
    private suspend fun flushLocked(force: Boolean): Boolean {
        val id = sessionId ?: return false
        if (!force && unsentActiveSeconds == 0 && !scrolledSinceFlush) {
            msSinceFlush = 0
            return false
        }
        // The API caps a single delta at 120s; ship in slices if we fell behind.
        while (true) {
            val delta = unsentActiveSeconds.coerceAtMost(MAX_DELTA_SECONDS)
            val response = runCatching {
                Network.api.sessionHeartbeat(
                    id,
                    HeartbeatRequest(activeSecondsDelta = delta, scrolledSinceLast = scrolledSinceFlush),
                )
            }.getOrElse {
                Log.w(TAG, "heartbeat flush failed — retrying next tick", it)
                return false // keep unsentActiveSeconds; next flush retries
            }
            unsentActiveSeconds -= delta
            scrolledSinceFlush = false
            msSinceFlush = 0

            response.taunts.forEach { taunt ->
                Notifier.taunt(this, "Purchase complete.", taunt.message)
            }
            if (response.capReached) {
                Notifier.taunt(
                    this,
                    "Session cap reached.",
                    "The meter has taken all it's allowed to today. We're closing the app for you. You're welcome.",
                )
                return true
            }
            if (unsentActiveSeconds < MAX_DELTA_SECONDS) return false
        }
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        // Best-effort close so the backend isn't left holding an ACTIVE
        // session; the server-side expiry sweep is the backstop if this races.
        runBlocking {
            withTimeoutOrNull(3_000) { mutex.withLock { endSessionLocked() } }
        }
        scope.cancel()
        super.onDestroy()
    }

    private companion object {
        const val TAG = "CostlySpy"
        const val TICK_MS = 5_000L
        const val FLUSH_MS = 30_000L
        const val IDLE_TIMEOUT_MS = 60_000L
        const val END_DEBOUNCE_MS = 3_000L
        const val MAX_DELTA_SECONDS = 120

        /** Windows that appear over an app without meaning the user left it. */
        val IGNORED_PACKAGES = setOf(
            "com.android.systemui",
            "com.google.android.inputmethod.latin",
            "com.samsung.android.honeyboard",
            "com.google.android.permissioncontroller",
        )
    }
}