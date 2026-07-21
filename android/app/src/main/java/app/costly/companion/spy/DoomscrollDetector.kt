package app.costly.companion.spy

import kotlin.math.abs
import kotlin.math.sqrt

/**
 * THE DOOMSCROLL ALGORITHM (pure logic — no Android deps, so it unit-tests).
 *
 * Distinguishes "sitting/laying and actively scrolling" from "walking with the
 * phone open" using the gyroscope's angular velocity (rad/s).
 *
 * Swipe signature: a brief, sharp spike in angular velocity (primarily the
 * X-axis for vertical scrolling) immediately followed by 2–15s of relative
 * stability (watching the reel / reading the post). Walking never produces
 * this — it's sustained mid-band motion that never settles into the calm
 * tail, so the stability timer keeps resetting and no swipe is registered.
 *
 * Pattern match: ≥2 swipe signatures inside a 20s rolling window ⇒ confirmed
 * doomscrolling. Dormancy: if angular velocity stays below a near-zero floor
 * for 30s+ (phone set down on a table), the meter must pause.
 *
 * Thread-safety: [onSample] runs on the sensor-callback coroutine while the
 * billing coroutine reads [isDoomscrolling]/[isDormant]; all state access is
 * synchronized on this instance.
 *
 * IMPORTANT: these thresholds are first-pass estimates. Billing real money on
 * an inferred signal demands on-device tuning before live cards — false
 * positives charge a user for a wobble.
 */
class DoomscrollDetector(
    private val spikeThreshold: Float = 1.5f, // rad/s — a sharp scroll flick
    private val stabilityThreshold: Float = 0.35f, // rad/s — "watching" calm
    private val dormantThreshold: Float = 0.08f, // rad/s — phone essentially still
    private val minStabilityMs: Long = 2_000,
    private val maxStabilityMs: Long = 15_000,
    private val patternWindowMs: Long = 20_000,
    private val patternCount: Int = 2,
    private val dormantMs: Long = 30_000,
) {
    private enum class Phase { SEEKING_SPIKE, AWAIT_STABILITY }

    private var phase = Phase.SEEKING_SPIKE
    private var spikeAtMs = 0L
    private var stableSinceMs = 0L
    private var lastMotionMs = 0L
    private var seenAnySample = false

    /** Spike timestamps of completed swipe signatures, pruned to the window. */
    private val swipes = ArrayDeque<Long>()

    @Synchronized
    fun onSample(wx: Float, wy: Float, wz: Float, nowMs: Long) {
        seenAnySample = true
        val primary = abs(wx) // vertical scroll ⇒ rotation about the device X-axis
        val magnitude = sqrt(wx * wx + wy * wy + wz * wz)
        if (magnitude > dormantThreshold) lastMotionMs = nowMs

        when (phase) {
            Phase.SEEKING_SPIKE -> {
                if (primary >= spikeThreshold) {
                    phase = Phase.AWAIT_STABILITY
                    spikeAtMs = nowMs
                    stableSinceMs = 0L
                }
            }
            Phase.AWAIT_STABILITY -> when {
                // Still spiking — continuous motion (e.g. walking). Restart the
                // spike anchor; the calm tail never accrues, so nothing counts.
                primary >= spikeThreshold -> {
                    spikeAtMs = nowMs
                    stableSinceMs = 0L
                }
                // Calm enough to be "watching". Time it.
                primary <= stabilityThreshold -> {
                    if (stableSinceMs == 0L) stableSinceMs = nowMs
                    val stableFor = nowMs - stableSinceMs
                    if (stableFor >= minStabilityMs) {
                        // Spike + ≥2s calm = one completed swipe signature.
                        swipes.addLast(spikeAtMs)
                        if (swipes.size > 8) swipes.removeFirst()
                        phase = Phase.SEEKING_SPIKE
                    } else if (stableFor > maxStabilityMs) {
                        // Calm ran past the ceiling before settling — abandon.
                        phase = Phase.SEEKING_SPIKE
                    }
                }
                // Mid-band churn (not a spike, not calm): reset the calm timer.
                else -> stableSinceMs = 0L
            }
        }
        prune(nowMs)
    }

    @Synchronized
    fun isDoomscrolling(nowMs: Long): Boolean {
        prune(nowMs)
        return swipes.size >= patternCount && !isDormantInternal(nowMs)
    }

    @Synchronized
    fun isDormant(nowMs: Long): Boolean = isDormantInternal(nowMs)

    @Synchronized
    fun reset() {
        phase = Phase.SEEKING_SPIKE
        spikeAtMs = 0L
        stableSinceMs = 0L
        lastMotionMs = 0L
        seenAnySample = false
        swipes.clear()
    }

    private fun isDormantInternal(nowMs: Long): Boolean =
        seenAnySample && lastMotionMs != 0L && nowMs - lastMotionMs >= dormantMs

    private fun prune(nowMs: Long) {
        while (swipes.isNotEmpty() && nowMs - swipes.first() > patternWindowMs) swipes.removeFirst()
    }
}
