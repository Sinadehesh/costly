package app.costly.companion.overlay

import app.costly.companion.spy.AnchorSnapshot
import app.costly.companion.spy.Meter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Display math for the live overlay. `nowRealtime` is always passed explicitly
 * so the SystemClock default never evaluates — these stay plain JVM tests.
 *
 * The overlay must agree with the server's numbers, so penaltyCents here
 * mirrors the web's sessionPenaltyCents rounding exactly; a divergence would
 * show the user one price and charge them another.
 */
class MeterMathTest {

    // ── displaySeconds ────────────────────────────────────────────────────

    @Test
    fun `a paused meter shows exactly its banked seconds`() {
        val meter = Meter(activeSeconds = 42, runningSince = null)
        assertEquals(42, MeterMath.displaySeconds(meter, nowRealtime = 999_999))
    }

    @Test
    fun `a running meter adds the elapsed time to the baseline`() {
        val meter = Meter(activeSeconds = 10, runningSince = 1_000)
        // 5s later → 10 + 5.
        assertEquals(15, MeterMath.displaySeconds(meter, nowRealtime = 6_000))
    }

    @Test
    fun `partial seconds are floored, so the display never runs ahead of billing`() {
        val meter = Meter(activeSeconds = 0, runningSince = 0)
        assertEquals(0, MeterMath.displaySeconds(meter, nowRealtime = 999))
        assertEquals(1, MeterMath.displaySeconds(meter, nowRealtime = 1_000))
        assertEquals(1, MeterMath.displaySeconds(meter, nowRealtime = 1_999))
    }

    @Test
    fun `a clock that goes backwards never subtracts from the baseline`() {
        val meter = Meter(activeSeconds = 30, runningSince = 10_000)
        assertEquals(30, MeterMath.displaySeconds(meter, nowRealtime = 5_000))
    }

    // ── penaltyCents ──────────────────────────────────────────────────────

    @Test
    fun `penalty matches the stated per-minute rate`() {
        assertEquals(100, MeterMath.penaltyCents(60, 100))
        assertEquals(50, MeterMath.penaltyCents(30, 100))
        assertEquals(500, MeterMath.penaltyCents(600, 50))
    }

    @Test
    fun `zero seconds costs nothing`() {
        assertEquals(0, MeterMath.penaltyCents(0, 250))
    }

    @Test
    fun `penalty rounds to the nearest cent like the server does`() {
        // 1s at 100c/min = 1.666… → 2, matching web sessionPenaltyCents.
        assertEquals(2, MeterMath.penaltyCents(1, 100))
    }

    // ── formatting ────────────────────────────────────────────────────────

    @Test
    fun `clock formats as zero-padded minutes and seconds`() {
        assertEquals("00:00", MeterMath.formatClock(0))
        assertEquals("00:09", MeterMath.formatClock(9))
        assertEquals("01:05", MeterMath.formatClock(65))
    }

    @Test
    fun `clock keeps counting past an hour rather than wrapping`() {
        // 90 minutes reads as 90:00, not 30:00 — the meter is a punch clock.
        assertEquals("90:00", MeterMath.formatClock(5_400))
    }

    @Test
    fun `euros format with two decimals`() {
        assertEquals("€0.00", MeterMath.formatEuros(0).replace(',', '.'))
        assertEquals("€1.00", MeterMath.formatEuros(100).replace(',', '.'))
    }

    // ── hostage ladder ────────────────────────────────────────────────────

    private val anchors = listOf(
        AnchorSnapshot(name = "Coffee", priceCents = 500, tierLevel = 1),
        AnchorSnapshot(name = "AirPods", priceCents = 25_000, tierLevel = 2),
        AnchorSnapshot(name = "PS5", priceCents = 50_000, tierLevel = 3),
    )

    @Test
    fun `no anchors means no hostage line`() {
        assertNull(MeterMath.hostage(1_000, emptyList()))
    }

    @Test
    fun `targets the cheapest anchor not yet fully burned`() {
        assertEquals("Burned: 20.0% of Coffee", MeterMath.hostage(100, anchors))
    }

    @Test
    fun `escalates to the next rung once an item is fully paid for`() {
        // 500c exactly covers the coffee, so the target becomes the AirPods.
        assertEquals("Burned: 2.0% of AirPods", MeterMath.hostage(500, anchors))
    }

    @Test
    fun `sticks on the top rung and clamps at 100 percent once everything is burned`() {
        assertEquals("Burned: 100.0% of PS5", MeterMath.hostage(999_999, anchors))
    }

    @Test
    fun `unordered anchors are sorted by tier before choosing a target`() {
        val shuffled = listOf(anchors[2], anchors[0], anchors[1])
        assertEquals("Burned: 20.0% of Coffee", MeterMath.hostage(100, shuffled))
    }

    @Test
    fun `a zero-priced anchor reports zero instead of dividing by zero`() {
        val free = listOf(AnchorSnapshot(name = "Nothing", priceCents = 0, tierLevel = 1))
        assertEquals("Burned: 0.0% of Nothing", MeterMath.hostage(1_000, free))
    }
}
