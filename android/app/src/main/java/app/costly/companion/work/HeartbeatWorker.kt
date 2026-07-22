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
import app.costly.companion.net.PaymentRequiredResponse
import app.costly.companion.spy.HeuristicSpyService
import app.costly.companion.spy.UsageAccess
import retrofit2.HttpException
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
        if (!Prefs.isLinked(applicationContext)) {
            return Result.success() // unlinked: nothing to prove, no auth to send
        }

        return try {
            val response = Network.api.deviceHeartbeat(
                DeviceHeartbeatRequest(
                    // DTO field name kept for backend compatibility; it now
                    // reports whether monitoring (Usage Access) is granted,
                    // since the AccessibilityService is gone. userId is derived
                    // server-side from x-device-secret (Phase 1).
                    accessibilityEnabled = UsageAccess.isGranted(applicationContext),
                    appVersion = BuildConfig.VERSION_NAME,
                ),
            )
            // Cache the meter config so the overlay can tick locally.
            response.penaltyRateCentsPerMin?.let { rate ->
                Prefs.setMeterConfig(applicationContext, rate, response.anchorItems)
            }
            // A clean 2xx means the server considers the account settled — lift
            // any local Settle Up lock (recovery is server-driven).
            Prefs.clearPaymentFailed(applicationContext)
            Result.success()
        } catch (e: HttpException) {
            if (e.code() == 402) {
                // Phase 2 lockout: a charge failed. Hard-lock into Settle Up and
                // kill the meter so a locked account stops accruing.
                val url = runCatching {
                    Network.moshi.adapter(PaymentRequiredResponse::class.java)
                        .fromJson(e.response()?.errorBody()?.string() ?: "")
                        ?.settleUpUrl
                }.getOrNull()
                Prefs.setPaymentFailed(applicationContext, url)
                HeuristicSpyService.stop(applicationContext)
            }
            Result.success() // 402 (and other HTTP errors) won't fix on retry
        } catch (e: IOException) {
            // Offline or server unreachable — retry with backoff. Retrying IS
            // the product here: every failed attempt burns runway on the 24h
            // breach window.
            Result.retry()
        } catch (e: Exception) {
            // Non-IO (parsing, etc.): retrying the same request won't help.
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
