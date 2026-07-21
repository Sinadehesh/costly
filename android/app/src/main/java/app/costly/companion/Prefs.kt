package app.costly.companion

import android.content.Context
import android.content.SharedPreferences
import app.costly.companion.net.AnchorLite
import app.costly.companion.net.Network
import com.squareup.moshi.Types

/** Tiny persistent state: who we spy for, and which apps are the vices. */
object Prefs {

    private const val FILE = "costly"
    private const val KEY_USER_ID = "userId"
    private const val KEY_DEVICE_SECRET = "deviceSecret"
    private const val KEY_BLOCKED = "blockedPackages"
    private const val KEY_ACTIVE_SESSION = "activeSessionId"
    private const val KEY_RATE = "penaltyRateCentsPerMin"
    private const val KEY_ANCHORS = "anchorsJson"

    private val anchorsAdapter by lazy {
        Network.moshi.adapter<List<AnchorLite>>(
            Types.newParameterizedType(List::class.java, AnchorLite::class.java),
        )
    }

    // Memoized parse — the spy publishes meter state every 5s.
    private var anchorsCacheJson: String? = null
    private var anchorsCache: List<AnchorLite> = emptyList()

    val DEFAULT_BLOCKED: Set<String> = setOf(
        "com.instagram.android",
        "com.zhiliaoapp.musically", // TikTok
        "com.ss.android.ugc.trill", // TikTok (Asia builds)
        "com.twitter.android",
        "com.reddit.frontpage",
    )

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

    fun blockedPackages(context: Context): Set<String> =
        sp(context).getStringSet(KEY_BLOCKED, null) ?: DEFAULT_BLOCKED

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

    fun setMeterConfig(context: Context, rateCentsPerMin: Int, anchors: List<AnchorLite>) =
        sp(context).edit()
            .putInt(KEY_RATE, rateCentsPerMin)
            .putString(KEY_ANCHORS, anchorsAdapter.toJson(anchors))
            .apply()
}
