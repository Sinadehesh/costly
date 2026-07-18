package app.costly.companion.overlay

import app.costly.companion.spy.AnchorSnapshot
import app.costly.companion.spy.Meter
import android.os.SystemClock
import java.util.Locale

/**
 * Pure display math for the live meter — no Android view deps, so it's
 * trivially unit-testable. Everything is derived from a [Meter] baseline plus
 * the current elapsedRealtime, giving a value that grows every second and
 * snaps to the spy's truth on each publish.
 */
object MeterMath {

    /** Billable seconds to show right now: baseline + time since it was running. */
    fun displaySeconds(meter: Meter, nowRealtime: Long = SystemClock.elapsedRealtime()): Int {
        val running = meter.runningSince ?: return meter.activeSeconds
        val extra = ((nowRealtime - running) / 1000L).toInt().coerceAtLeast(0)
        return meter.activeSeconds + extra
    }

    /** Penalty in whole cents, to the cent, for the given billable seconds. */
    fun penaltyCents(seconds: Int, rateCentsPerMin: Int): Int =
        Math.round(seconds / 60.0 * rateCentsPerMin).toInt()

    fun formatClock(seconds: Int): String {
        val m = seconds / 60
        val s = seconds % 60
        return String.format(Locale.US, "%02d:%02d", m, s)
    }

    fun formatEuros(cents: Int): String =
        String.format(Locale.GERMANY, "€%,.2f", cents / 100.0)

    /**
     * The hostage line: the *cheapest anchor not yet fully burned* is the
     * current target, shown as "Burned: 12.4% of PS5". Once an item is fully
     * paid for, the ladder escalates to the next. Returns null if no anchors.
     */
    fun hostage(penaltyCents: Int, anchors: List<AnchorSnapshot>): String? {
        if (anchors.isEmpty()) return null
        val ladder = anchors.sortedBy { it.tierLevel }
        val target = ladder.firstOrNull { penaltyCents < it.priceCents } ?: ladder.last()
        val pct = if (target.priceCents <= 0) 0.0
        else (penaltyCents.toDouble() / target.priceCents * 100).coerceIn(0.0, 100.0)
        return String.format(Locale.US, "Burned: %.1f%% of %s", pct, target.name)
    }
}
