package app.costly.companion.work

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.costly.companion.Prefs
import app.costly.companion.net.Network
import app.costly.companion.net.WalkingSyncRequest
import java.io.IOException
import java.time.Duration
import java.time.Instant
import java.util.concurrent.TimeUnit

/**
 * THE SWEAT EQUITY SYNC.
 *
 * Health Connect is on-device only — no server can poll it — so this worker
 * is the sole bridge between the user's legs and their money:
 *
 *  1. discover PENDING redemption tasks via GET /api/dashboard (the app only
 *     knows its userId; taskIds live server-side);
 *  2. per task, read walking from Health Connect for [session end → now]:
 *     walking-type ExerciseSessions are authoritative; if none exist, fall
 *     back to a steps estimate (100 steps ≈ 1 active minute);
 *  3. POST the CUMULATIVE minutes to /api/redemptions/:taskId/sync — the
 *     backend takes max(), so replays and overlaps are harmless.
 *
 * Runs every 4h (a redemption window is 24h — plenty of chances), plus
 * manually from the arming UI's "Sync my walk" button.
 */
class HealthSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val userId = Prefs.userId(applicationContext) ?: return Result.success()

        if (HealthConnectClient.getSdkStatus(applicationContext) != HealthConnectClient.SDK_AVAILABLE) {
            return Result.success() // no Health Connect on device — nothing to read
        }
        val client = HealthConnectClient.getOrCreate(applicationContext)
        val granted = client.permissionController.getGrantedPermissions()
        if (REQUIRED_PERMISSIONS.none { it in granted }) {
            return Result.success() // user never granted health reads — the UI nags, not us
        }

        val pending = try {
            Network.api.dashboard(userId).holds
                .filter { it.redemption?.status == "PENDING" }
        } catch (e: IOException) {
            return Result.retry()
        }
        if (pending.isEmpty()) return Result.success()

        for (hold in pending) {
            val task = hold.redemption ?: continue
            val since = hold.endTime?.let { runCatching { Instant.parse(it) }.getOrNull() }
                ?: Instant.now().minus(Duration.ofHours(24))

            val minutes = readWalkingMinutes(client, since, Instant.now())
            try {
                Network.api.syncWalking(
                    task.taskId,
                    WalkingSyncRequest(completedWalkingMinutes = minutes),
                )
            } catch (e: IOException) {
                return Result.retry() // partial progress is fine; sync is idempotent
            }
        }
        return Result.success()
    }

    private suspend fun readWalkingMinutes(
        client: HealthConnectClient,
        from: Instant,
        to: Instant,
    ): Int {
        val range = TimeRangeFilter.between(from, to)

        // Authoritative: explicit walking exercise sessions.
        val sessions = runCatching {
            client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, range)).records
        }.getOrElse { emptyList() }

        val walkingSeconds = sessions
            .filter { it.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_WALKING }
            .sumOf { Duration.between(it.startTime, it.endTime).seconds.coerceAtLeast(0) }
        if (walkingSeconds > 0) return (walkingSeconds / 60L).toInt()

        // Fallback: steps estimate. ~100 steps per active minute is the
        // conservative end of normal walking cadence — we under-credit rather
        // than hand out free redemptions.
        val steps = runCatching {
            client.readRecords(ReadRecordsRequest(StepsRecord::class, range)).records
        }.getOrElse { emptyList() }.sumOf { it.count }

        return (steps / 100L).toInt()
    }

    companion object {
        private const val PERIODIC_NAME = "costly-health-sync"
        private const val ONESHOT_NAME = "costly-health-sync-now"

        val REQUIRED_PERMISSIONS: Set<String> = setOf(
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
        )

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(4, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }

        fun syncNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<HealthSyncWorker>()
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
