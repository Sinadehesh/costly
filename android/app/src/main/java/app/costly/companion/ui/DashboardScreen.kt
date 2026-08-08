package app.costly.companion.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.costly.companion.Prefs
import app.costly.companion.spy.MeterBus
import app.costly.companion.ui.theme.Burn
import app.costly.companion.ui.theme.Faint
import app.costly.companion.ui.theme.Fg
import app.costly.companion.ui.theme.Line
import app.costly.companion.ui.theme.Muted
import kotlinx.coroutines.delay
import java.util.Locale

/**
 * THE COMPANION DASHBOARD — the same screen as web/src/app/dashboard/page.tsx.
 *
 * The companion used to stop at a setup checklist, so once armed the phone had
 * nothing to show and the two halves of the product looked unrelated. This is
 * the web dashboard's own layout and chrome: terminal header, mascot card,
 * the recoverable figure as the hero, the stat row, and the wishlist bars.
 *
 * The hero is deliberately the money still at stake rather than the total
 * lost. The recoverable number is the only one the user can still act on, and
 * acting on it is the product.
 */
@Composable
fun DashboardScreen(armed: Boolean) {
    val context = LocalContext.current
    val meter by MeterBus.state.collectAsState()

    var clock by remember { mutableStateOf(nowClock()) }
    LaunchedEffect(Unit) {
        while (true) {
            clock = nowClock()
            delay(1000)
        }
    }

    val rate = Prefs.rateCentsPerMin(context)
    val atStakeCents = (meter.billableSeconds / 60.0 * rate).toInt()
    val burnCents = (atStakeCents * 0.2).toInt()
    val walkableCents = atStakeCents - burnCents
    val requiredWalkMin = (meter.billableSeconds / 60.0 * 2).toInt()

    val mood = when {
        !armed -> CatMood.SULKING
        atStakeCents == 0 -> CatMood.WAITING
        atStakeCents < 1000 -> CatMood.GREEDY
        else -> CatMood.UNHINGED
    }
    val anchors = remember { Prefs.anchors(context) }
    val topAnchor = anchors.maxByOrNull { it.priceCents }?.name ?: "your wishlist"

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        TerminalHeader(armed = armed, clock = clock)

        CatCard(
            mood = mood,
            headline = when (mood) {
                CatMood.WAITING -> "I am patient. And hungry."
                CatMood.GREEDY -> "Yum."
                CatMood.UNHINGED -> "That's so much money."
                else -> "Wake me when it counts."
            },
            line = when (mood) {
                CatMood.WAITING -> "Nothing yet. The meter is armed and the day is young."
                CatMood.SULKING -> "Nothing is being watched. This is all just a screensaver."
                else -> "I took your $topAnchor money!"
            },
        )

        // HERO — what is still recoverable, not what is already gone.
        Panel(borderColor = if (atStakeCents > 0) Burn else Line) {
            Label("At stake right now", if (atStakeCents > 0) Burn else Faint)
            Spacer(Modifier.height(8.dp))
            Money(euros(atStakeCents), if (atStakeCents > 0) Burn else Fg, size = 38)
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Label("Walk it off")
                Text(
                    "$requiredWalkMin min",
                    color = Muted,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                if (atStakeCents == 0) {
                    "Nothing owed. Keep it that way."
                } else {
                    "${euros(walkableCents)} comes back if you walk it off within 24 hours. " +
                        "${euros(burnCents)} does not — the time was not refundable either."
                },
                color = Muted,
                fontSize = 13.sp,
                lineHeight = 19.sp,
            )
        }

        // Stat row, matching the web's three small cards.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard("Free left today", secondsLabel(meter.freeSecondsRemaining), Modifier.weight(1f))
            StatCard("Your rate", "${euros(rate)}/min", Modifier.weight(1f))
            StatCard("Metering", if (meter.active) "LIVE" else "IDLE", Modifier.weight(1f))
        }

        if (anchors.isNotEmpty()) {
            Panel {
                Label("Things the cat is eating")
                Spacer(Modifier.height(6.dp))
                anchors.sortedBy { it.priceCents }.forEach { a ->
                    AnchorBar(
                        name = a.name,
                        priceLabel = euros(a.priceCents),
                        fraction = if (a.priceCents > 0) atStakeCents / a.priceCents.toFloat() else 0f,
                    )
                }
            }
        }

        Text(
            if (armed) "> system armed. scroll wisely." else "> unarmed. everything above is theatre.",
            color = Faint,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .padding(0.dp),
    ) {
        Panel {
            Label(label)
            Spacer(Modifier.height(6.dp))
            Text(
                value,
                color = Fg,
                fontSize = 17.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

private fun euros(cents: Int): String =
    String.format(Locale.GERMANY, "%,.2f €", cents / 100.0)

private fun secondsLabel(seconds: Int): String =
    if (seconds <= 0) "0 min" else "${seconds / 60} min"

private fun nowClock(): String {
    val c = java.util.Calendar.getInstance()
    return String.format(
        Locale.US,
        "%02d:%02d:%02d",
        c.get(java.util.Calendar.HOUR_OF_DAY),
        c.get(java.util.Calendar.MINUTE),
        c.get(java.util.Calendar.SECOND),
    )
}
