package app.costly.companion.spy

import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.content.Context
import android.net.ConnectivityManager
import android.util.Log

/**
 * NETWORK ENGAGEMENT — the primary "is this person actually consuming content"
 * signal, and the one that doesn't depend on how the phone is physically held.
 *
 * Instagram/TikTok reels are a continuous, bursty download. We poll the target
 * app's own UID via NetworkStatsManager (gated by PACKAGE_USAGE_STATS, which
 * the spy already holds) and flag "engaged" when its received bytes over a
 * trailing window clear a threshold. A burst latches engagement for a short
 * decay so buffering gaps (download-ahead, then play quietly) don't flicker it
 * off mid-scroll.
 *
 * Honest limitation: NetworkStatsManager is an accounting API, not a real-time
 * throughput meter — its buckets are flushed on a schedule, so very recent
 * bytes can be undercounted. That bias is toward NOT charging (engaged stays
 * false when unsure), which is the safe direction for a meter that bills real
 * money. Resolving the target UID needs package visibility — the target
 * packages are declared in the manifest <queries> block.
 */
class NetworkEngagementDetector(
    private val context: Context,
    private val rxThresholdBytes: Long = 200_000, // ~content loading, above keepalive noise
    private val windowMs: Long = 30_000,
    private val engagedDecayMs: Long = 30_000,
) {
    private val nsm = context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager

    private var uid = -1

    @Volatile
    private var engagedUntilElapsedMs = 0L

    /** Resolve the target app's UID once per session. */
    fun bind(pkg: String) {
        uid = runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.getApplicationInfo(pkg, 0).uid
        }.getOrElse {
            Log.w(TAG, "cannot resolve uid for $pkg (missing <queries> visibility?)", it)
            -1
        }
    }

    fun reset() {
        uid = -1
        engagedUntilElapsedMs = 0L
    }

    /** Poll periodically off the main thread; latches engagement on a burst. */
    fun sample(nowElapsedMs: Long) {
        if (uid < 0) return
        if (rxBytesInWindow() >= rxThresholdBytes) {
            engagedUntilElapsedMs = nowElapsedMs + engagedDecayMs
        }
    }

    fun isEngaged(nowElapsedMs: Long): Boolean = nowElapsedMs < engagedUntilElapsedMs

    private fun rxBytesInWindow(): Long {
        val end = System.currentTimeMillis()
        val start = end - windowMs
        // Sum WiFi + mobile; either can throw (permission/old-OS mobile quirks),
        // so degrade per-transport rather than losing the whole reading.
        var total = 0L
        for (type in intArrayOf(ConnectivityManager.TYPE_WIFI, ConnectivityManager.TYPE_MOBILE)) {
            total += runCatching { sumRxForUid(type, start, end) }.getOrDefault(0L)
        }
        return total
    }

    private fun sumRxForUid(networkType: Int, start: Long, end: Long): Long {
        @Suppress("DEPRECATION") // subscriberId path; null aggregates on modern OS
        val stats = nsm.queryDetailsForUid(networkType, null, start, end, uid)
        val bucket = NetworkStats.Bucket()
        var sum = 0L
        while (stats.hasNextBucket()) {
            stats.getNextBucket(bucket)
            sum += bucket.rxBytes
        }
        stats.close()
        return sum
    }

    private companion object {
        const val TAG = "CostlyNet"
    }
}
