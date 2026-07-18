package app.costly.companion.overlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

/** Overlay (SYSTEM_ALERT_WINDOW) permission helpers. */
object OverlayPermission {

    fun canDraw(context: Context): Boolean = Settings.canDrawOverlays(context)

    /**
     * Bounce the user to the system "Display over other apps" screen for THIS
     * app. There is no result to await — the caller re-checks canDraw() on
     * resume.
     */
    fun requestIntent(context: Context): Intent =
        Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    fun launchSettings(context: Context) {
        context.startActivity(requestIntent(context))
    }
}
