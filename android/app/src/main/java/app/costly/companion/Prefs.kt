package app.costly.companion

import android.content.Context
import app.costly.companion.BuildConfig
import android.content.SharedPreferences
import app.costly.companion.net.AnchorLite
import app.costly.companion.net.Network
import com.squareup.moshi.Types

/** Tiny persistent state: who we spy for, and which apps are the vices. */
object Prefs {

    private const val FILE = "costly"
    private const val KEY_USER_ID = "userId"
    private const val KEY_DEVICE_SECRET = "deviceSecret"
    private const val KEY_ACTIVE_SESSION = "activeSessionId"
    private const val KEY_RATE = "penaltyRateCentsPerMin"
    private const val KEY_ANCHORS = "anchorsJson"
    private const val KEY_FREE_REMAINING = "freeSecondsRemaining"
    private const val KEY_GOD_MODE = "godMode"
    private const val KEY_PAYMENT_FAILED = "paymentFailed"
    private const val KEY_SETTLE_UP_URL = "settleUpUrl"

    private val anchorsAdapter by lazy {
        Network.moshi.adapter<List<AnchorLite>>(
            Types.newParameterizedType(List::class.java, AnchorLite::class.java),
        )
    }

    // Memoized parse — the spy publishes meter state every 5s.
    private var anchorsCacheJson: String? = null
    private var anchorsCache: List<AnchorLite> = emptyList()

    private fun sp(context: Context): SharedPreferences =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun userId(context: Context): String? =
        sp(context).getString(KEY_USER_ID, null)?.takeIf { it.isNotBlank() }

    fun setUserId(context: Context, userId: String) =
        sp(context).edit().putString(KEY_USER_ID, userId.trim()).apply()

    // ── Device secret (Phase 1) — the x-device-secret from /api/device/link ──

    /** Presence of a device secret is what "armed/linked" now means. */
    fun deviceSecret(context: Context): String? =
        sp(context).getString(KEY_DEVICE_SECRET, null)?.takeIf { it.isNotBlank() }

    fun isLinked(context: Context): Boolean = deviceSecret(context) != null

    /** Persist the linking result: the secret + the userId it belongs to. */
    fun setLink(context: Context, deviceSecret: String, userId: String) =
        sp(context).edit()
            .putString(KEY_DEVICE_SECRET, deviceSecret)
            .putString(KEY_USER_ID, userId.trim())
            .apply()

    /**
     * The active server session id survives process death — if the system
     * kills and restarts the spy service mid-session, we resume instead of
     * orphaning an ACTIVE session on the backend.
     */
    fun activeSessionId(context: Context): String? =
        sp(context).getString(KEY_ACTIVE_SESSION, null)

    fun setActiveSessionId(context: Context, sessionId: String?) =
        sp(context).edit().apply {
            if (sessionId == null) remove(KEY_ACTIVE_SESSION) else putString(KEY_ACTIVE_SESSION, sessionId)
        }.apply()

    // ── Meter config (cached from /api/device/heartbeat) ──────────────────

    /** €1/min default until the first ping refreshes the real rate. */
    fun rateCentsPerMin(context: Context): Int =
        sp(context).getInt(KEY_RATE, 100)

    fun anchors(context: Context): List<AnchorLite> {
        val json = sp(context).getString(KEY_ANCHORS, null) ?: return emptyList()
        if (json != anchorsCacheJson) {
            anchorsCache = runCatching { anchorsAdapter.fromJson(json) }.getOrNull() ?: emptyList()
            anchorsCacheJson = json
        }
        return anchorsCache
    }

    /**
     * Last known remainder of today's free allowance. Only a fallback for
     * resuming a session the app already had cached (no /start round-trip, so
     * no fresh figure) — the server stays authoritative and every heartbeat
     * response corrects it. Stale by at most one ping, and only ever affects
     * what the bubble displays, never what is charged.
     */
    fun freeSecondsRemaining(context: Context): Int =
        sp(context).getInt(KEY_FREE_REMAINING, 0)

    fun setFreeSecondsRemaining(context: Context, seconds: Int) =
        sp(context).edit().putInt(KEY_FREE_REMAINING, seconds.coerceAtLeast(0)).apply()

    // ── God mode (debug builds only) ──────────────────────────────────────

    /**
     * Local test mode: run the detector, the meter and the overlay with NO
     * account and NO server. Nothing is billed and no API is called, which is
     * the point: it exercises the risky half (foreground detection, the
     * engagement vote, the overlay) on a real phone without needing auth,
     * Postgres, Stripe or a Google client.
     *
     * Hard-gated on BuildConfig.DEBUG at the READ, not just where it is set, so
     * a release build cannot honour the flag even if the preference somehow
     * exists on disk. R8 folds this to `false` and strips the branches.
     */
    fun isGodMode(context: Context): Boolean =
        BuildConfig.DEBUG && sp(context).getBoolean(KEY_GOD_MODE, false)

    fun setGodMode(context: Context, on: Boolean) =
        sp(context).edit().putBoolean(KEY_GOD_MODE, on).apply()

    fun setMeterConfig(
        context: Context,
        rateCentsPerMin: Int,
        anchors: List<AnchorLite>,
        freeSecondsRemaining: Int,
    ) =
        sp(context).edit()
            .putInt(KEY_RATE, rateCentsPerMin)
            .putString(KEY_ANCHORS, anchorsAdapter.toJson(anchors))
            .putInt(KEY_FREE_REMAINING, freeSecondsRemaining.coerceAtLeast(0))
            .apply()

    // ── Settle Up lockout (Phase 2) — set when the backend returns 402 ──────

    fun isPaymentFailed(context: Context): Boolean =
        sp(context).getBoolean(KEY_PAYMENT_FAILED, false)

    fun settleUpUrl(context: Context): String? =
        sp(context).getString(KEY_SETTLE_UP_URL, null)?.takeIf { it.isNotBlank() }

    fun setPaymentFailed(context: Context, settleUpUrl: String?) =
        sp(context).edit()
            .putBoolean(KEY_PAYMENT_FAILED, true)
            .apply {
                if (settleUpUrl != null) putString(KEY_SETTLE_UP_URL, settleUpUrl)
            }
            .apply()

    fun clearPaymentFailed(context: Context) =
        sp(context).edit()
            .putBoolean(KEY_PAYMENT_FAILED, false)
            .remove(KEY_SETTLE_UP_URL)
            .apply()

    // Let the UI react the instant a background worker clears the lock.
    fun registerChangeListener(
        context: Context,
        listener: SharedPreferences.OnSharedPreferenceChangeListener,
    ) = sp(context).registerOnSharedPreferenceChangeListener(listener)

    fun unregisterChangeListener(
        context: Context,
        listener: SharedPreferences.OnSharedPreferenceChangeListener,
    ) = sp(context).unregisterOnSharedPreferenceChangeListener(listener)
}
