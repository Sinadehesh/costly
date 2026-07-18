package app.costly.companion.spy

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The single source of truth linking the spy and the overlay, in-process.
 *
 * The spy owns the authoritative billable clock (idle-aware, 5s ticks). The
 * overlay must NOT re-derive billable time — it would double-count or drift
 * against the backend. Instead the spy publishes a baseline here on every
 * tick, and the overlay interpolates *within* the current second for a
 * smooth per-second punch-clock feel, snapping back to truth each update.
 *
 * `activeSeconds` is billable seconds already accrued. `runningSince` is the
 * wall-clock instant the meter was last known to be actively counting (null
 * when idle/paused), so the overlay can advance the display between spy ticks
 * without inventing time the spy would consider idle.
 */
data class Meter(
    val active: Boolean = false,
    val appPackage: String? = null,
    val activeSeconds: Int = 0,
    val runningSince: Long? = null, // SystemClock.elapsedRealtime() or null when paused
    val rateCentsPerMin: Int = 100,
    val anchors: List<AnchorSnapshot> = emptyList(),
)

data class AnchorSnapshot(
    val name: String,
    val priceCents: Int,
    val tierLevel: Int,
)

object MeterBus {
    private val _state = MutableStateFlow(Meter())
    val state: StateFlow<Meter> = _state.asStateFlow()

    fun publish(meter: Meter) {
        _state.value = meter
    }

    fun clear() {
        _state.value = Meter()
    }
}
