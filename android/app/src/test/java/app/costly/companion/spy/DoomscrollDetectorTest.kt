package app.costly.companion.spy

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Tests for the swipe-signature pattern match and the dormancy timeout.
 *
 * This class decides whether a card gets charged, so the cases that matter
 * most are the NEGATIVE ones: walking, pocket jostle, and a phone left on a
 * table must never register as doomscrolling. The thresholds themselves are
 * still first-pass estimates (see the class doc) — these tests pin the
 * *behaviour* of the state machine so retuning the numbers later can't
 * silently break the shape of the algorithm.
 *
 * Defaults under test: spike ≥1.5 rad/s, calm ≤0.35 rad/s held ≥2s, 2 swipes
 * inside a 20s window, dormant after 30s below 0.08 rad/s.
 */
class DoomscrollDetectorTest {

    /** Feed a constant sample every [stepMs] for [durationMs], returning the end time. */
    private fun DoomscrollDetector.feed(
        wx: Float,
        from: Long,
        durationMs: Long,
        stepMs: Long = 100,
        wy: Float = 0f,
        wz: Float = 0f,
    ): Long {
        var t = from
        val end = from + durationMs
        while (t <= end) {
            onSample(wx, wy, wz, t)
            t += stepMs
        }
        return end
    }

    /** One complete swipe signature: a spike, then the calm "watching" tail. */
    private fun DoomscrollDetector.swipe(at: Long, calmMs: Long = 2_500): Long {
        onSample(3.0f, 0f, 0f, at) // the flick
        return feed(0.1f, at + 100, calmMs) // watching the reel
    }

    @Test
    fun `no samples at all is not doomscrolling and not dormant`() {
        val d = DoomscrollDetector()
        assertFalse(d.isDoomscrolling(0))
        // Never armed: without a baseline we must not claim the phone is idle.
        assertFalse(d.isDormant(60_000))
    }

    @Test
    fun `a single swipe is not enough to bill`() {
        val d = DoomscrollDetector()
        val t = d.swipe(1_000)
        assertFalse("one swipe must not confirm doomscrolling", d.isDoomscrolling(t))
    }

    @Test
    fun `two swipes inside the window confirm doomscrolling`() {
        val d = DoomscrollDetector()
        var t = d.swipe(1_000)
        t = d.swipe(t + 500)
        assertTrue("two swipes in 20s is the confirm condition", d.isDoomscrolling(t))
    }

    @Test
    fun `a spike with too short a calm tail does not count as a swipe`() {
        val d = DoomscrollDetector()
        // 1s of calm — under the 2s minimum, so no signature completes.
        var t = d.swipe(1_000, calmMs = 1_000)
        t = d.swipe(t + 200, calmMs = 1_000)
        assertFalse(d.isDoomscrolling(t))
    }

    @Test
    fun `swipes older than the 20s window expire`() {
        val d = DoomscrollDetector()
        var t = d.swipe(1_000)
        t = d.swipe(t + 500)
        assertTrue(d.isDoomscrolling(t))

        // Same two swipes, judged well after the window has slid past them.
        assertFalse("stale swipes must not keep billing", d.isDoomscrolling(t + 25_000))
    }

    @Test
    fun `sustained walking motion never registers a swipe`() {
        val d = DoomscrollDetector()
        // Continuous mid-band churn: above the calm ceiling, so the stability
        // timer keeps resetting and no signature ever completes.
        val t = d.feed(0.9f, 0, 30_000)
        assertFalse("walking must never bill", d.isDoomscrolling(t))
    }

    @Test
    fun `sustained hard shaking never registers a swipe`() {
        val d = DoomscrollDetector()
        // Always above the spike threshold: the spike anchor keeps restarting,
        // the calm tail never accrues.
        val t = d.feed(4.0f, 0, 30_000)
        assertFalse("a shaken phone must never bill", d.isDoomscrolling(t))
    }

    @Test
    fun `a phone left still becomes dormant after 30s`() {
        val d = DoomscrollDetector()
        val t = d.feed(0.5f, 0, 1_000) // some motion to establish a baseline
        assertFalse(d.isDormant(t))
        assertTrue("30s below the floor is dormant", d.isDormant(t + 30_000))
    }

    @Test
    fun `dormancy is not reached just before the timeout`() {
        val d = DoomscrollDetector()
        val t = d.feed(0.5f, 0, 1_000)
        assertFalse(d.isDormant(t + 29_999))
    }

    @Test
    fun `motion below the dormant floor does not count as motion`() {
        val d = DoomscrollDetector()
        val t = d.feed(0.5f, 0, 1_000)
        // Tiny vibration under the floor — still dormant.
        d.feed(0.02f, t + 1_000, 30_000)
        assertTrue(d.isDormant(t + 35_000))
    }

    @Test
    fun `billing stops once the phone is set down`() {
        val d = DoomscrollDetector()
        var t = d.swipe(1_000)
        t = d.swipe(t + 500)
        assertTrue(d.isDoomscrolling(t))

        // Put it on the table: by the time dormancy could be reached (30s of
        // stillness) the swipes have also aged out of the 20s window, so both
        // guards agree. Note this makes the dormancy check inside
        // isDoomscrolling redundant in practice — window (20s) < dormant (30s)
        // means it can never be the deciding factor. Kept as defence in depth.
        assertFalse(d.isDoomscrolling(t + 31_000))
        assertTrue(d.isDormant(t + 31_000))
    }

    @Test
    fun `reset clears both the swipe history and the dormancy baseline`() {
        val d = DoomscrollDetector()
        var t = d.swipe(1_000)
        t = d.swipe(t + 500)
        assertTrue(d.isDoomscrolling(t))

        d.reset()
        assertFalse(d.isDoomscrolling(t))
        assertFalse("no baseline after reset", d.isDormant(t + 60_000))
    }

    @Test
    fun `a fresh session after reset can confirm again`() {
        val d = DoomscrollDetector()
        d.swipe(1_000)
        d.reset()
        var t = d.swipe(100_000)
        t = d.swipe(t + 500)
        assertTrue(d.isDoomscrolling(t))
    }

    @Test
    fun `the swipe backlog stays bounded under a long scrolling session`() {
        val d = DoomscrollDetector()
        var t = 0L
        repeat(40) { t = d.swipe(t + 500) }
        // Still billing, and the deque cap (8) hasn't broken the window logic.
        assertTrue(d.isDoomscrolling(t))
        assertFalse(d.isDoomscrolling(t + 30_000))
    }

    @Test
    fun `off-axis rotation alone does not trigger a swipe`() {
        val d = DoomscrollDetector()
        // Big Y/Z rotation but no X spike — turning the phone, not scrolling.
        var t = 0L
        repeat(4) {
            d.onSample(0.1f, 3.0f, 3.0f, t)
            t = d.feed(0.1f, t + 100, 2_500, wy = 0.05f, wz = 0.05f)
            t += 200
        }
        assertFalse("only the X-axis flick is the scroll signature", d.isDoomscrolling(t))
    }
}
