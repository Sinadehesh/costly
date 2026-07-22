package app.costly.companion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.costly.companion.spy.HeuristicSpyService
import app.costly.companion.spy.UsageAccess
import app.costly.companion.work.HealthSyncWorker
import app.costly.companion.work.HeartbeatWorker

/**
 * A reboot must not look like desertion: re-arm the workers and ping
 * immediately so the 24h breach window resets as soon as the phone is back,
 * and restart the spy engine.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        HeartbeatWorker.schedule(context)
        HealthSyncWorker.schedule(context)
        // Network.deviceSecret is already hydrated by CostlyApp.onCreate, which
        // runs before this receiver on process start.
        if (Prefs.isLinked(context)) {
            HeartbeatWorker.pingNow(context)
            // Best-effort: starting a foreground service from BOOT_COMPLETED is
            // an allowed exemption, but OEMs vary — start() swallows a refusal.
            // Skip entirely while locked into Settle Up.
            if (!Prefs.isPaymentFailed(context) && UsageAccess.isGranted(context)) {
                HeuristicSpyService.start(context)
            }
        }
    }
}
