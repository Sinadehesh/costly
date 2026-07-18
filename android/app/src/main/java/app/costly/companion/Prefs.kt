package app.costly.companion

import android.content.Context
import android.content.SharedPreferences

/** Tiny persistent state: who we spy for, and which apps are the vices. */
object Prefs {

    private const val FILE = "costly"
    private const val KEY_USER_ID = "userId"
    private const val KEY_BLOCKED = "blockedPackages"
    private const val KEY_ACTIVE_SESSION = "activeSessionId"

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

    fun blockedPackages(context: Context): Set<String> =
        sp(context).getStringSet(KEY_BLOCKED, null) ?: DEFAULT_BLOCKED

    /**
     * The active server session id survives process death — if the system
     * kills and rebinds the accessibility service mid-session, we resume
     * instead of orphaning an ACTIVE session on the backend.
     */
    fun activeSessionId(context: Context): String? =
        sp(context).getString(KEY_ACTIVE_SESSION, null)

    fun setActiveSessionId(context: Context, sessionId: String?) =
        sp(context).edit().apply {
            if (sessionId == null) remove(KEY_ACTIVE_SESSION) else putString(KEY_ACTIVE_SESSION, sessionId)
        }.apply()
}
