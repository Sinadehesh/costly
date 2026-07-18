package app.costly.companion.overlay

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import app.costly.companion.spy.MeterBus
import kotlinx.coroutines.isActive

private val Bg = Color(0xFF0B0D0A)
private val Burn = Color(0xFFFF3B2F)
private val Muted = Color(0xFF98A090)
private val Fg = Color(0xFFF2F4EF)

/**
 * The live bleed meter. A rigid, monospaced pill that punches once per second.
 *
 * It observes MeterBus (published by the spy) for the authoritative baseline,
 * and runs its OWN 1s ticker so the digits move every second regardless of
 * when the backend flush lands. The tick is deliberately un-animated — no
 * crossfade, no easing — so the number just SNAPS, like a punch clock.
 */
@Composable
fun MeterOverlay() {
    val meter by MeterBus.state.collectAsState()

    // A 1s counter drives recomposition; values are recomputed from the
    // baseline + realtime each tick, so the display snaps to truth and never
    // drifts. Using `tick` as a remember key is what forces the recompute.
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (isActive) {
            kotlinx.coroutines.delay(1000)
            tick++
        }
    }

    val seconds = remember(tick, meter) { MeterMath.displaySeconds(meter) }
    val cents = remember(seconds, meter) { MeterMath.penaltyCents(seconds, meter.rateCentsPerMin) }
    val hostage = remember(cents, meter) { MeterMath.hostage(cents, meter.anchors) }
    val paused = meter.active && meter.runningSince == null

    Column(
        modifier = Modifier
            .background(Bg.copy(alpha = 0.92f), RoundedCornerShape(14.dp))
            .border(1.dp, Burn.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp)
            .width(150.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = if (paused) "IDLE" else "● LIVE",
                color = if (paused) Muted else Burn,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
            )
            Text(
                text = "  ${MeterMath.formatClock(seconds)}",
                color = Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
            )
        }

        // The number that hurts — big, red, monospaced, snapping every second.
        Text(
            text = MeterMath.formatEuros(cents),
            color = Burn,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 30.sp,
        )

        if (hostage != null) {
            Text(
                text = hostage,
                color = Fg,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                textAlign = TextAlign.Start,
            )
        }
    }
}
