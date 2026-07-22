package app.costly.companion.work

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
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
import app.costly.companion.net.StepsSyncRequest
import app.costly.companion.net.WalkingSyncRequest
import java.io.IOException
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/**
 * THE SWEAT EQUITY SYNC — both physical fronts of the two-front war.
 *
 * Health Connect is on-device only — no server can poll it — so this worker
 * is the sole bridge between the user's legs and their money. Per run:
 *
 *  FRONT A — daily laziness harvest:
 *    aggregate today's total step count (midnight → now) via the Health
 *    Connect aggregate API (COUNT_TOTAL dedupes overlapping sources, e.g. a
 *    watch and a phone both counting the same walk). Currently logged for
 *    verification; the backend POST lands when the daily-laziness endpoint
 *    exists.
 *
 *  FRONT B — redemption sync (releases Stripe holds):
 *    1. discover PENDING redemption tasks via GET /api/dashboard;
 *    2. per task, read walking for [session end → now]: walking-type
 *       ExerciseSessions are authoritative; else steps ÷ 100 as a
 *       conservative estimate;
 *    3. POST the CUMULATIVE minutes to /api/redemptions/:taskId/sync —
 *       the backend takes max(), so replays are harmless.
 *
 * Runs every 4h plus manually from the arming UI's "Sync my walk" button.
 */
class HealthSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val userId = Prefs.userId(applicationContext)
            ?: return Result.success() // unarmed — nothing to prove, nobody to punish

        if (HealthConnectClient.getSdkStatus(applicationContext) != HealthConnectClient.SDK_AVAILABLE) {
            Log.e(TAG, "Health Connect unavailable on this device — the system is blind to laziness")
            return Result.failure()
        }
        val client = HealthConnectClient.getOrCreate(applicationContext)

        val granted = client.permissionController.getGrantedPermissions()
        if (HealthPermission.getReadPermission(StepsRecord::class) !in granted) {
            Log.e(TAG, "READ_STEPS not granted — cannot see the step count; arming UI must re-request")
            return Result.failure()
        }

        // ── FRONT A: today's total steps (midnight → now) → backend ───────
        // The nightly /api/jobs/evaluate-steps cron reads this to price
        // inactivity. Device-authed via the x-device-secret interceptor.
        val zone = ZoneId.systemDefault()
        val totalSteps = fetchTodaySteps(client)
        Log.d(TAG, "Total steps today: $totalSteps")
        runCatching {
            Network.api.syncSteps(
                StepsSyncRequest(
                    steps = totalSteps.toInt(),
                    day = LocalDate.now(zone).toString(), // YYYY-MM-DD, same zone as fetch
                ),
            )
        }.onFailure { Log.w(TAG, "step sync failed — retried next run", it) }

        // ── FRONT B: redemption sync (existing hold-release path) ─────────
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

    /**
     * Aggregate today's step count from midnight (device timezone) to now.
     * aggregate() + COUNT_TOTAL is the correct primitive here: Health Connect
     * merges and dedupes records from all contributing apps/devices, which
     * naive readRecords + sum would double-count.
     */
    private suspend fun fetchTodaySteps(client: HealthConnectClient): Long {
        val zone = ZoneId.systemDefault()
        val midnight = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        return runCatching {
            val result = client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(midnight, Instant.now()),
                ),
            )
            result[StepsRecord.COUNT_TOTAL] ?: 0L
        }.getOrElse {
            Log.e(TAG, "step aggregation failed", it)
            0L
        }
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
        private const val TAG = "CostlyHealth"
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
