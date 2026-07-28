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

    // ── daily free allowance ──────────────────────────────────────────────

    @Test
    fun `a paused meter shows its banked billable seconds`() {
        val meter = Meter(billableSeconds = 12, freeSecondsRemaining = 0, runningSince = null)
        assertEquals(12, MeterMath.displayBillableSeconds(meter, nowRealtime = 999_999))
    }

    @Test
    fun `elapsed time pays down the free allowance before it bills anything`() {
        val meter = Meter(billableSeconds = 0, freeSecondsRemaining = 10, runningSince = 0)
        // 4s in: still inside the allowance, so nothing is billable yet.
        assertEquals(0, MeterMath.displayBillableSeconds(meter, nowRealtime = 4_000))
        assertEquals(6, MeterMath.displayFreeRemaining(meter, nowRealtime = 4_000))
    }

    @Test
    fun `billing starts only once the allowance is exhausted`() {
        val meter = Meter(billableSeconds = 0, freeSecondsRemaining = 10, runningSince = 0)
        // 15s in: 10 free, 5 billable.
        assertEquals(5, MeterMath.displayBillableSeconds(meter, nowRealtime = 15_000))
        assertEquals(0, MeterMath.displayFreeRemaining(meter, nowRealtime = 15_000))
    }

    @Test
    fun `with no allowance left every elapsed second is billable`() {
        val meter = Meter(billableSeconds = 30, freeSecondsRemaining = 0, runningSince = 1_000)
        assertEquals(35, MeterMath.displayBillableSeconds(meter, nowRealtime = 6_000))
    }

    @Test
    fun `free remaining never goes negative`() {
        val meter = Meter(freeSecondsRemaining = 3, runningSince = 0)
        assertEquals(0, MeterMath.displayFreeRemaining(meter, nowRealtime = 60_000))
    }

    /**
     * The bubble shows a green grace countdown instead of euros while the
     * allowance holds. If billable time advanced during grace the user would
     * watch a price tick up that the server is not charging — a number they
     * would catch on their first statement.
     */
    @Test
    fun `the meter shows no cost for any instant inside the allowance`() {
        val meter = Meter(billableSeconds = 0, freeSecondsRemaining = 300, runningSince = 0)
        for (elapsedMs in 0..300_000 step 7_000) {
            val billable = MeterMath.displayBillableSeconds(meter, nowRealtime = elapsedMs.toLong())
            assertEquals(0, billable)
            assertEquals(0, MeterMath.penaltyCents(billable, rateCentsPerMin = 100))
        }
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
