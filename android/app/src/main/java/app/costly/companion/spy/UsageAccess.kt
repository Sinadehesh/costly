package app.costly.companion.spy

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings

/**
 * PACKAGE_USAGE_STATS ("Usage Access") helpers — the Play-compliant
 * replacement for the AccessibilityService's foreground-app detection.
 *
 * It's a special app-ops permission: declaring it in the manifest is not
 * enough, the user must toggle it in Settings, so we check it via AppOps.
 */
object UsageAccess {

    fun isGranted(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName,
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun settingsIntent(): Intent =
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /**
     * The current foreground package, or null. There is no direct "what's on
     * screen" API without AccessibilityService, so we scan recent usage events
     * and take the most recent MOVE_TO_FOREGROUND. This carries ~1–2s of
     * latency — acceptable for a meter that only bills confirmed doomscrolling.
     */
    fun currentForegroundPackage(context: Context, lookbackMs: Long = 10_000): String? {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val end = System.currentTimeMillis()
        val events = usm.queryEvents(end - lookbackMs, end)
        val event = UsageEvents.Event()
        var pkg: String? = null
        var lastTs = 0L
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            @Suppress("DEPRECATION") // MOVE_TO_FOREGROUND == ACTIVITY_RESUMED(29+); works on minSdk 26
            if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND && event.timeStamp >= lastTs) {
                lastTs = event.timeStamp
                pkg = event.packageName
            }
        }
        return pkg
    }
}
