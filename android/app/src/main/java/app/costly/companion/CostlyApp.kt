package app.costly.companion

import android.app.Application
import androidx.work.Configuration
import app.costly.companion.notify.Notifier
import app.costly.companion.work.HealthSyncWorker
import app.costly.companion.work.HeartbeatWorker

class CostlyApp : Application(), Configuration.Provider {

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().build()

    override fun onCreate() {
        super.onCreate()
        Notifier.ensureChannel(this)
        // Defensive rescheduling on every process start: the dead man's switch
        // must survive updates, crashes, and force-stops that later relaunch.
        HeartbeatWorker.schedule(this)
        HealthSyncWorker.schedule(this)
        // Every launch is proof of life — don't wait for the 12h window.
        if (Prefs.userId(this) != null) HeartbeatWorker.pingNow(this)
    }
}
