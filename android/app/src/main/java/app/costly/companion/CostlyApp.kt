package app.costly.companion

import android.app.Application
import androidx.work.Configuration
import app.costly.companion.net.Network
import app.costly.companion.notify.Notifier
import app.costly.companion.spy.HeuristicSpyService
import app.costly.companion.spy.UsageAccess
import app.costly.companion.work.HealthSyncWorker
import app.costly.companion.work.HeartbeatWorker

class CostlyApp : Application(), Configuration.Provider {

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().build()

    override fun onCreate() {
        super.onCreate()
        Notifier.ensureChannel(this)
        // Hydrate the device secret before any component runs — Application
        // .onCreate precedes every receiver/service/activity, so the network
        // layer is authenticated from the first request in any entry path.
        Network.deviceSecret = Prefs.deviceSecret(this)

        // Defensive rescheduling on every process start: the dead man's switch
        // must survive updates, crashes, and force-stops that later relaunch.
        HeartbeatWorker.schedule(this)
        HealthSyncWorker.schedule(this)
        // Every launch is proof of life — don't wait for the 12h window.
        if (Prefs.isLinked(this)) {
            HeartbeatWorker.pingNow(this)
            // Re-arm the spy if fully set up. When the process started in the
            // foreground (user opened the app) this is allowed; a background
            // process-start refusal is swallowed by start().
            if (UsageAccess.isGranted(this)) HeuristicSpyService.start(this)
        }
    }
}
