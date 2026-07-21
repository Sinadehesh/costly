package app.costly.companion.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.costly.companion.BuildConfig
import app.costly.companion.Prefs
import app.costly.companion.net.DeviceHeartbeatRequest
import app.costly.companion.net.Network
import app.costly.companion.spy.UsageAccess
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * THE DEAD MAN'S SWITCH — device side.
 *
 * Every 12 hours this POSTs /api/device/heartbeat. If the server misses two
 * consecutive pings (>24h of silence) inside an active lock-in, it charges
 * the breach fee. So this worker's one job is: never miss twice.
 *
 * Honest platform constraint: Android gives NO true "guaranteed execution".
 * Doze defers periodic work; OEM battery managers kill apps. The defense is
 * layered, not a single flag:
 *  - periodic 12h work with network constraint + exponential retry, so a
 *    failed ping keeps retrying instead of waiting 12h;
 *  - opportunistic expedited pings on every app launch, every boot
 *    (BootReceiver), and every session event (the backend counts session
 *    heartbeats as proof of life too);
 *  - the arming UI requests a battery-optimization exemption, which keeps
 *    WorkManager honest in Doze on stock Android;
 *  - the server side only fires after TWO missed windows, precisely because
 *    one deferred ping is normal Android weather.
 */
class HeartbeatWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val userId = Prefs.userId(applicationContext)
            ?: return Result.success() // unarmed: nothing to prove, nobody to bill

        return try {
            val response = Network.api.deviceHeartbeat(
                DeviceHeartbeatRequest(
                    // DTO field name kept for backend compatibility; it now
                    // reports whether monitoring (Usage Access) is granted,
                    // since the AccessibilityService is gone.
                    userId = userId,
                    accessibilityEnabled = UsageAccess.isGranted(applicationContext),
                    appVersion = BuildConfig.VERSION_NAME,
                ),
            )
            // Cache the meter config so the overlay can tick locally.
            response.penaltyRateCentsPerMin?.let { rate ->
                Prefs.setMeterConfig(applicationContext, rate, response.anchorItems)
            }
            Result.success()
        } catch (e: IOException) {
            // Offline or server unreachable — retry with backoff. Retrying IS
            // the product here: every failed attempt burns runway on the 24h
            // breach window.
            Result.retry()
        } catch (e: Exception) {
            // Non-IO (4xx, parsing): retrying the same request won't help.
            Result.success()
        }
    }

    companion object {
        private const val PERIODIC_NAME = "costly-heartbeat"
        private const val ONESHOT_NAME = "costly-heartbeat-now"

        /** Idempotent — safe to call from app launch, boot, and the arming flow. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(12, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }

        /** Opportunistic proof of life — expedited so it runs even under Doze quota. */
        fun pingNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<HeartbeatWorker>()
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                ONESHOT_NAME,
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }
}
