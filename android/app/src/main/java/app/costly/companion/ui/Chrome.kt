package app.costly.companion.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.costly.companion.ui.theme.Accent
import app.costly.companion.ui.theme.Bg
import app.costly.companion.ui.theme.Burn
import app.costly.companion.ui.theme.Danger
import app.costly.companion.ui.theme.Faint
import app.costly.companion.ui.theme.Fg
import app.costly.companion.ui.theme.Line
import app.costly.companion.ui.theme.Muted
import app.costly.companion.ui.theme.Surface
import app.costly.companion.ui.theme.Surface2

/**
 * The web app's chrome, in Compose.
 *
 * globals.css draws every panel the same way — 2px line border, surface fill,
 * 16dp radius — and every number in monospace. These are those rules as
 * composables so the companion and the dashboard are one product rather than
 * two that share a palette.
 */

/** Panel: `border-2 border-line bg-surface rounded-[var(--radius-card)]`. */
@Composable
fun Panel(
    modifier: Modifier = Modifier,
    borderColor: Color = Line,
    fill: Color = Surface,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(fill)
            .border(2.dp, borderColor, RoundedCornerShape(16.dp))
            .padding(16.dp),
        content = content,
    )
}

/** The all-caps tracked label the web uses above every figure. */
@Composable
fun Label(text: String, color: Color = Faint) {
    Text(
        text.uppercase(),
        color = color,
        fontSize = 10.sp,
        letterSpacing = 2.4.sp,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
    )
}

/** A figure. Monospace always — the meter has to read like a taxi meter. */
@Composable
fun Money(text: String, color: Color = Fg, size: Int = 34) {
    Text(
        text,
        color = color,
        fontSize = size.sp,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.sp,
    )
}

/**
 * `COSTLY://TERMINAL · ● armed · 12:25:24`
 *
 * Armed state lives in persistent chrome rather than in a panel that only
 * appears when something is wrong, because it is a persistent fact about the
 * system. The dot pulses when armed, exactly as `animate-pulse` does on web.
 */
@Composable
fun TerminalHeader(armed: Boolean, clock: String) {
    val pulse = rememberInfiniteTransition(label = "armed-pulse")
    val dotAlpha by pulse.animateFloat(
        initialValue = 1f,
        targetValue = 0.35f,
        animationSpec = infiniteRepeatable(tween(1100), RepeatMode.Reverse),
        label = "dot-alpha",
    )

    Panel {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "COSTLY://TERMINAL",
                color = Accent,
                fontSize = 12.sp,
                letterSpacing = 3.sp,
                fontFamily = FontFamily.Monospace,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(8.dp)
                        .alpha(if (armed) dotAlpha else 1f)
                        .clip(CircleShape)
                        .background(if (armed) Accent else Danger),
                )
                Text(
                    if (armed) "  ARMED" else "  UNARMED",
                    color = if (armed) Accent else Danger,
                    fontSize = 10.sp,
                    letterSpacing = 2.sp,
                    fontFamily = FontFamily.Monospace,
                )
                Text(
                    "   $clock",
                    color = Muted,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }
    }
}

/**
 * The shared CTA. MainActivity keeps a private one of its own from before
 * these files existed; this is the version the screens outside it use.
 */
@Composable
fun CtaButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    color: Color = Accent,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (enabled) color else Surface2)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            color = if (enabled) Bg else Faint,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 15.sp,
        )
    }
}

/**
 * The wishlist bars. The web reports losses as a percentage of a named object
 * the user wants, because "8% of a PlayStation" costs something to read and
 * "€4.20" does not.
 */
@Composable
fun AnchorBar(name: String, priceLabel: String, fraction: Float) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(name, color = Fg, fontSize = 14.sp)
            Text(priceLabel, color = Fg, fontSize = 14.sp, fontFamily = FontFamily.Monospace)
        }
        Box(
            Modifier
                .padding(top = 5.dp)
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Surface2),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(fraction.coerceIn(0f, 1f))
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Burn),
            )
        }
    }
}
