package app.costly.companion.spy

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import app.costly.companion.Prefs
import app.costly.companion.R
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
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

/**
 * THE HEURISTIC SPY ENGINE — Play-compliant replacement for the
 * AccessibilityService. No accessibility APIs anywhere.
 *
 * Two signals, combined:
 *  1. App Watcher — polls UsageStatsManager every 2s for the foreground
 *     package. A target app (IG / TikTok) foregrounded opens a backend
 *     session and arms the sensor gate.
 *  2. Sensor Gate + Doomscroll algorithm — while a target is foregrounded a
 *     gyroscope listener feeds [DoomscrollDetector]. The billing meter only
 *     ticks once the detector CONFIRMS doomscrolling (≥2 swipe signatures in
 *     20s); it pauses when the phone goes dormant (30s+ still) and the whole
 *     session ends when the user leaves the app (sensor unregistered).
 *
 * Everything downstream is unchanged from the old spy: the same
 * /sessions/start → /heartbeat → /end contract, the same MeterBus publishes,
 * the same overlay. Only the input signal changed.
 *
 * The billing definition of "interactive doomscrolling":
 *
 *   HARD GATES (all mandatory):
 *     1. screen ON            (PowerManager.isInteractive) — kills pocket motion
 *     2. target app foreground (UsageStatsManager) — the open session itself
 *     3. phone NOT dormant     (gyro floor) — not propped/abandoned on a table
 *
 *   ENGAGEMENT VOTE (need ≥2 of 3, so no single signal can charge a card):
 *     • NETWORK  — target app pulling content (NetworkEngagementDetector).
 *                  The primary, motion-independent signal: reels stream.
 *     • GYRO     — swipe-signature rhythm (DoomscrollDetector), the touch proxy.
 *     • AUDIO    — media audio playing (AudioManager.isMusicActive).
 *
 * Two independent signal families must agree before the meter ticks — network
 * catches the gentle-thumb scroll the gyro misses, the gyro catches the
 * cached/low-traffic scroll the network misses, and neither alone bills.
 * Touch on another app is unobservable without AccessibilityService, so this
 * vote is the closest defensible stand-in.
 *
 * One capability lost with accessibility: we can no longer force-close the app
 * at the cap (no performGlobalAction). Instead, at cap we stop billing but
 * keep the session open so re-entry can't start a fresh, uncapped session.
 */
class HeuristicSpyService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var sensorManager: SensorManager
    private lateinit var powerManager: PowerManager
    private lateinit var audioManager: AudioManager
    private val detector = DoomscrollDetector()
    private lateinit var networkDetector: NetworkEngagementDetector

    private val mutex = Mutex()
    private var sessionId: String? = null
    private var sessionPackage: String? = null
    private var sessionActiveSeconds = 0
    private var unsentActiveSeconds = 0
    private var countingSinceFlush = false
    private var msSinceFlush = 0L
    private var capped = false

    private var sensorJob: Job? = null
    private var networkJob: Job? = null
    private var billingJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(SensorManager::class.java)
        powerManager = getSystemService(PowerManager::class.java)
        audioManager = getSystemService(AudioManager::class.java)
        networkDetector = NetworkEngagementDetector(applicationContext)
        startAsForeground()
        scope.launch { appWatcherLoop() }
        Log.i(TAG, "Heuristic spy engine started. Targets: $TARGETS")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    // ── 1. App Watcher ────────────────────────────────────────────────────

    private suspend fun appWatcherLoop() {
        while (currentCoroutineContext().isActive) {
            val pkg = runCatching { UsageAccess.currentForegroundPackage(this) }.getOrNull()
            val onTarget = pkg != null && pkg in TARGETS
            mutex.withLock {
                when {
                    onTarget && sessionId == null -> startSessionLocked(pkg!!)
                    !onTarget && sessionId != null -> endSessionLocked()
                }
            }
            delay(POLL_MS)
        }
    }

    // ── Session lifecycle (all *Locked functions require [mutex]) ─────────

    private suspend fun startSessionLocked(pkg: String) {
        val userId = Prefs.userId(this) ?: return // unarmed — nothing to bill

        val id = Prefs.activeSessionId(this) ?: runCatching {
            Network.api.startSession(StartSessionRequest(userId = userId, appPackage = pkg)).sessionId
        }.getOrElse {
            Log.w(TAG, "start failed (offline?) — session not billed", it)
            return
        }

        Prefs.setActiveSessionId(this, id)
        sessionId = id
        sessionPackage = pkg
        sessionActiveSeconds = 0
        unsentActiveSeconds = 0
        countingSinceFlush = false
        msSinceFlush = 0
        capped = false
        detector.reset()
        networkDetector.reset()
        networkDetector.bind(pkg)

        publishMeterLocked(counting = false) // opened, but nothing billed until confirmed
        if (Settings.canDrawOverlays(this)) CostlyOverlayService.start(this)

        // Sensor gate ON: collect gyro into the detector until this job cancels.
        sensorJob = scope.launch {
            gyroFlow().buffer().collect { s -> detector.onSample(s.x, s.y, s.z, s.tMs) }
        }
        // Network engagement poll (binder IO → IO dispatcher), coarser cadence.
        networkJob = scope.launch(Dispatchers.IO) {
            while (currentCoroutineContext().isActive) {
                networkDetector.sample(SystemClock.elapsedRealtime())
                delay(NET_POLL_MS)
            }
        }
        billingJob = scope.launch { billingLoop() }
        Log.i(TAG, "Session $id opened for $pkg; sensor + network gates armed")
    }

    private suspend fun endSessionLocked() {
        val id = sessionId ?: return
        billingJob?.cancel(); billingJob = null
        sensorJob?.cancel(); sensorJob = null // awaitClose unregisters the listener
        networkJob?.cancel(); networkJob = null
        networkDetector.reset()

        flushLocked(force = true)
        runCatching { Network.api.endSession(id) }
            .onSuccess { Log.i(TAG, "Session $id ended: ${it.status}") }
            .onFailure { Log.w(TAG, "end failed for $id — server sweep is the backstop", it) }

        Prefs.setActiveSessionId(this, null)
        sessionId = null
        sessionPackage = null
        sessionActiveSeconds = 0
        unsentActiveSeconds = 0
        capped = false

        MeterBus.clear()
        CostlyOverlayService.stop(this)
    }

    // ── 2b. Billing loop — ticks only while doomscrolling is confirmed ────

    private suspend fun billingLoop() {
        while (currentCoroutineContext().isActive) {
            delay(TICK_MS)
            mutex.withLock {
                if (sessionId == null) return@withLock
                val now = SystemClock.elapsedRealtime()

                // Hard gates: screen on, not physically abandoned. (In-app is
                // implied — the session only exists while a target is foreground.)
                val gatesOpen = powerManager.isInteractive && !detector.isDormant(now)

                // Engagement vote — need ≥2 of 3 so no lone signal charges a card.
                val networkVote = networkDetector.isEngaged(now)
                val gyroVote = detector.isDoomscrolling(now) // false when dormant
                val audioVote = audioManager.isMusicActive
                val votes = (if (networkVote) 1 else 0) +
                    (if (gyroVote) 1 else 0) +
                    (if (audioVote) 1 else 0)

                val counting = !capped && gatesOpen && votes >= 2
                if (counting) {
                    sessionActiveSeconds++
                    unsentActiveSeconds++
                    countingSinceFlush = true
                }
                publishMeterLocked(counting)
                msSinceFlush += TICK_MS
                if (msSinceFlush >= FLUSH_MS && flushLocked(force = false)) {
                    // Cap reached. Without accessibility we can't send the user
                    // home — so freeze billing but keep the session open, or
                    // re-entry would start a new uncapped one.
                    capped = true
                    Notifier.taunt(
                        this,
                        "Session cap reached.",
                        "The meter took all it's allowed today. We can't close the app for you " +
                            "anymore — but the damage is capped. That's so much money, by the way.",
                    )
                }
            }
        }
    }

    /** Push unsent billable seconds. Returns true if the server reports the cap. */
    private suspend fun flushLocked(force: Boolean): Boolean {
        val id = sessionId ?: return false
        if (!force && unsentActiveSeconds == 0 && !countingSinceFlush) {
            msSinceFlush = 0
            return false
        }
        val delta = unsentActiveSeconds.coerceAtMost(MAX_DELTA_SECONDS)
        val response = runCatching {
            Network.api.sessionHeartbeat(
                id,
                HeartbeatRequest(activeSecondsDelta = delta, scrolledSinceLast = countingSinceFlush),
            )
        }.getOrElse {
            Log.w(TAG, "heartbeat flush failed — retrying next tick", it)
            return false // keep unsent; next flush retries
        }
        unsentActiveSeconds -= delta
        countingSinceFlush = false
        msSinceFlush = 0
        response.taunts.forEach { Notifier.taunt(this, "Purchase complete.", it.message) }
        return response.capReached
    }

    private fun publishMeterLocked(counting: Boolean) {
        MeterBus.publish(
            Meter(
                active = true,
                appPackage = sessionPackage,
                activeSeconds = sessionActiveSeconds,
                runningSince = if (counting) SystemClock.elapsedRealtime() else null,
                rateCentsPerMin = Prefs.rateCentsPerMin(this),
                anchors = Prefs.anchors(this).map {
                    AnchorSnapshot(name = it.name, priceCents = it.priceCents, tierLevel = it.tierLevel)
                },
            ),
        )
    }

    // ── Sensor gate: gyroscope as a Flow ──────────────────────────────────

    private data class GyroSample(val x: Float, val y: Float, val z: Float, val tMs: Long)

    private fun gyroFlow(): Flow<GyroSample> = callbackFlow {
        val gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        if (gyro == null) {
            Log.w(TAG, "no gyroscope on this device — cannot detect doomscrolling")
            close()
            return@callbackFlow
        }
        val listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                trySend(GyroSample(e.values[0], e.values[1], e.values[2], SystemClock.elapsedRealtime()))
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }
        // SENSOR_DELAY_GAME (~50Hz) is plenty for 1–4Hz swipe rhythms; we don't
        // actually need HIGH_SAMPLING_RATE (>200Hz) and burning battery on it
        // would be pointless. The permission is declared for headroom only.
        sensorManager.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_GAME)
        awaitClose { sensorManager.unregisterListener(listener) }
    }

    // ── Foreground service plumbing ───────────────────────────────────────

    private fun startAsForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Costly Meter", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Runs while Costly is watching for doomscrolling."
                setShowBadge(false)
            },
        )
        val notification: Notification = Notification.Builder(this, CHANNEL)
            .setContentTitle("Costly is watching")
            .setContentText("The meter is armed. Scroll wisely.")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    override fun onDestroy() {
        runBlocking {
            withTimeoutOrNull(3_000) { mutex.withLock { endSessionLocked() } }
        }
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "CostlySpy"
        private const val CHANNEL = "costly-spy"
        private const val NOTIF_ID = 7002
        private const val POLL_MS = 2_000L
        private const val NET_POLL_MS = 5_000L
        private const val TICK_MS = 1_000L
        private const val FLUSH_MS = 30_000L
        private const val MAX_DELTA_SECONDS = 120

        /** Explicit targets: Instagram + TikTok (global + Asia builds). */
        val TARGETS = setOf(
            "com.instagram.android",
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.trill",
        )

        fun start(context: Context) {
            runCatching {
                context.startForegroundService(Intent(context, HeuristicSpyService::class.java))
            }.onFailure { Log.w(TAG, "FGS start refused (background restriction?)", it) }
        }

        fun stop(context: Context) {
            runCatching { context.stopService(Intent(context, HeuristicSpyService::class.java)) }
        }
    }
}
