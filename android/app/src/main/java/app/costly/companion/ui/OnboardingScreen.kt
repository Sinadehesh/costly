package app.costly.companion.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.costly.companion.net.AnchorItem
import app.costly.companion.ui.theme.Accent
import app.costly.companion.ui.theme.Bg
import app.costly.companion.ui.theme.Burn
import app.costly.companion.ui.theme.Faint
import app.costly.companion.ui.theme.Fg
import app.costly.companion.ui.theme.Gold
import app.costly.companion.ui.theme.Line
import app.costly.companion.ui.theme.Muted
import app.costly.companion.ui.theme.Surface2

/**
 * ONBOARDING — the same four content steps as web/src/app/onboarding/page.tsx,
 * in the same order, with the same copy and the same presets.
 *
 * The companion previously had no onboarding at all: a person could only
 * become a customer on the website, which is the exact "go to the web page"
 * the product refuses to ask for. These are steps 1-4; sign-in (5) is
 * SignInScreen, and the card (6) follows it.
 */

/** Stamped on the contract. Must match TERMS_VERSION in the web onboarding. */
const val TERMS_VERSION = "2026-07-v2-arcade"
const val WITHDRAWAL_TERMS_VERSION = "2026-07-withdrawal-v1"

/** The mechanic in the cat's own voice, one beat per tap — BEATS on web. */
private data class Beat(val line: String, val cents: Int)

private val BEATS = listOf(
    Beat("You tell me what one hour of your life is worth.", 0),
    Beat("Open Instagram and I start charging that rate to your card. By the minute.", 60),
    Beat(
        "When you close it, 20% is mine. Permanently. That part never comes back, " +
            "and neither did the time.",
        640,
    ),
    Beat(
        "The other 80% I only hold for 24 hours. Walk two minutes for every minute " +
            "you scrolled and you get all of it back.",
        3200,
    ),
    Beat("Don't walk, and I keep that too.", 2400),
)

private data class WishOption(val name: String, val priceEuros: Int)
private data class WishGroup(val group: String, val items: List<WishOption>)

/** WISH_CATALOGUE, verbatim. Picking one fills name and price in a single tap. */
private val WISH_CATALOGUE = listOf(
    WishGroup(
        "Small stuff (€5-€30)",
        listOf(
            WishOption("A fancy coffee", 5),
            WishOption("A cinema ticket", 13),
            WishOption("Lunch out", 15),
            WishOption("A hardcover book", 25),
            WishOption("A month of streaming", 30),
        ),
    ),
    WishGroup(
        "Nights out (€50-€150)",
        listOf(
            WishOption("A month at the gym", 50),
            WishOption("A nice dinner", 80),
            WishOption("Concert tickets", 90),
            WishOption("A good pair of jeans", 120),
            WishOption("A weekend train trip", 150),
        ),
    ),
    WishGroup(
        "Real money (€200-€600)",
        listOf(
            WishOption("A mechanical keyboard", 200),
            WishOption("AirPods", 250),
            WishOption("A flight home", 400),
            WishOption("A PlayStation 5", 500),
            WishOption("A new phone", 600),
        ),
    ),
    WishGroup(
        "The big ones (€1000+)",
        listOf(
            WishOption("Rent for a month", 1000),
            WishOption("A laptop", 1200),
            WishOption("A holiday abroad", 1500),
            WishOption("A used car", 4000),
        ),
    ),
)

private val FREE_MINUTE_OPTIONS = listOf(0, 5, 15, 30, 60)
private val DAILY_USAGE_OPTIONS = listOf(30, 60, 90, 120, 180, 240)

/** Everything the four steps collect, handed to the caller when they finish. */
data class OnboardingDraft(
    val hourlyRateCents: Int,
    val dailyFreeMinutes: Int,
    val anchors: List<AnchorItem>,
    val lockinDays: Int,
    val deletionFeeCents: Int,
)

@Composable
fun OnboardingScreen(onDone: (OnboardingDraft) -> Unit) {
    var step by remember { mutableStateOf(1) }

    var beat by remember { mutableStateOf(0) }
    var moneyUnderstood by remember { mutableStateOf(false) }

    var dailyUsageMinutes by remember { mutableStateOf(120) }
    var hourlyRateEuros by remember { mutableStateOf("15") }
    var dailyFreeMinutes by remember { mutableStateOf(0) }

    val picked = remember { mutableStateListOf<WishOption>() }

    var lockinDays by remember { mutableStateOf(7) }
    var deletionFeeEuros by remember { mutableStateOf("60") }
    var acceptedImmediate by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Bg)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        StepDots(step)

        when (step) {
            1 -> {
                CatCard(
                    mood = if (beat >= 3) CatMood.UNHINGED else if (beat >= 1) CatMood.GREEDY else CatMood.WAITING,
                    headline = "How this works",
                    line = BEATS[beat].line,
                )
                Panel {
                    Text("How this works", color = Fg, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.height(12.dp))
                    BEATS.take(beat + 1).forEachIndexed { i, b ->
                        Row(Modifier.padding(bottom = 10.dp)) {
                            Text(
                                "${i + 1}",
                                color = Accent,
                                fontSize = 14.sp,
                                fontFamily = FontFamily.Monospace,
                                modifier = Modifier.width(22.dp),
                            )
                            Text(b.line, color = Fg, fontSize = 15.sp, lineHeight = 22.sp)
                        }
                    }

                    if (beat < BEATS.size - 1) {
                        Spacer(Modifier.height(4.dp))
                        PillButton("Go on…", Surface2, Accent) { beat++ }
                    } else {
                        Spacer(Modifier.height(6.dp))
                        // The sentence the whole screen exists for.
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0x1AFF3B2F))
                                .border(4.dp, Burn, RoundedCornerShape(12.dp))
                                .padding(14.dp),
                        ) {
                            Text(
                                "THIS IS NOT A GAME",
                                color = Burn,
                                fontSize = 10.sp,
                                letterSpacing = 2.4.sp,
                                fontFamily = FontFamily.Monospace,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "Real money. Your real credit card. Costly charges it " +
                                    "automatically, without asking again, every time you scroll.",
                                color = Fg,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                lineHeight = 21.sp,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "Nobody is pretending. If that is not what you want, close " +
                                    "this app, which costs nothing and is a completely " +
                                    "reasonable thing to do.",
                                color = Muted,
                                fontSize = 13.sp,
                                lineHeight = 19.sp,
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = moneyUnderstood,
                                onCheckedChange = { moneyUnderstood = it },
                                colors = CheckboxDefaults.colors(checkedColor = Accent, checkmarkColor = Bg),
                            )
                            Text(
                                "I understand Costly will charge my real card with real money.",
                                color = Muted,
                                fontSize = 13.sp,
                                lineHeight = 18.sp,
                            )
                        }
                    }
                }
                PrimaryCta(
                    if (moneyUnderstood) "I UNDERSTAND. CONTINUE" else "READ IT FIRST",
                    enabled = beat == BEATS.size - 1 && moneyUnderstood,
                ) { step = 2 }
            }

            2 -> {
                Panel {
                    Text(
                        "How long do you scroll, honestly?",
                        color = Fg,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        lineHeight = 27.sp,
                    )
                    Spacer(Modifier.height(12.dp))
                    ChipGrid(DAILY_USAGE_OPTIONS.map { minutesLabel(it) }) { i ->
                        dailyUsageMinutes = DAILY_USAGE_OPTIONS[i]
                    }
                    Spacer(Modifier.height(12.dp))
                    // The most-validated element in the cohort: the yearly figure.
                    Text(
                        "That is ${"%.0f".format(dailyUsageMinutes * 365 / 60.0)} hours a year.",
                        color = Burn,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                }

                Panel {
                    Text(
                        "What is one hour of your life worth?",
                        color = Fg,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        lineHeight = 25.sp,
                    )
                    Spacer(Modifier.height(10.dp))
                    Field(hourlyRateEuros, "€ per hour", KeyboardType.Number) { hourlyRateEuros = it }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "That is ${perMinute(hourlyRateEuros)} a minute. " +
                            "Every minute past your free time costs that.",
                        color = Muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                }

                Panel {
                    Text("Free minutes each day", color = Fg, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.height(10.dp))
                    ChipGrid(FREE_MINUTE_OPTIONS.map { "$it min" }) { i ->
                        dailyFreeMinutes = FREE_MINUTE_OPTIONS[i]
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "There is no such thing as normal Instagram usage. Pick zero, or " +
                            "five minutes — enough to see your friends' stories and leave.",
                        color = Muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                    if (dailyFreeMinutes > 0) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "You will spend ${minutesLabel(dailyFreeMinutes)} a day here for free — " +
                                "${"%.0f".format(dailyFreeMinutes * 365 / 60.0)} hours a year. " +
                                "Addiction always arrives with a justification attached.",
                            color = Gold,
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                        )
                    }
                }
                NavRow(onBack = { step = 1 }, nextLabel = "CONTINUE", nextEnabled = euros(hourlyRateEuros) > 0) {
                    step = 3
                }
            }

            3 -> {
                Panel {
                    Text(
                        "What am I taking it from?",
                        color = Fg,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Losing €4.20 is forgettable. Losing 8% of a PlayStation is not. " +
                            "Pick up to five things you actually want.",
                        color = Muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                }
                WISH_CATALOGUE.forEach { group ->
                    Panel {
                        Label(group.group)
                        Spacer(Modifier.height(8.dp))
                        group.items.forEach { item ->
                            val on = picked.any { it.name == item.name }
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 3.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (on) Accent else Surface2)
                                    .clickable {
                                        if (on) picked.removeAll { it.name == item.name }
                                        else if (picked.size < 5) picked.add(item)
                                    }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(item.name, color = if (on) Bg else Fg, fontSize = 14.sp)
                                Text(
                                    "€${item.priceEuros}",
                                    color = if (on) Bg else Muted,
                                    fontSize = 14.sp,
                                    fontFamily = FontFamily.Monospace,
                                )
                            }
                        }
                    }
                }
                NavRow(onBack = { step = 2 }, nextLabel = "CONTINUE", nextEnabled = picked.isNotEmpty()) {
                    step = 4
                }
            }

            else -> {
                Panel {
                    Text("The Contract", color = Fg, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "A fixed term. While it runs, your rate cannot go down and the " +
                            "meter cannot be switched off. That is the entire point.",
                        color = Muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                    Spacer(Modifier.height(12.dp))
                    Label("Lock-in")
                    Spacer(Modifier.height(8.dp))
                    ChipGrid(listOf("7 days", "30 days"), selectedIndex = if (lockinDays == 7) 0 else 1) { i ->
                        lockinDays = if (i == 0) 7 else 30
                    }
                }

                Panel {
                    Label("Early breach fee")
                    Spacer(Modifier.height(8.dp))
                    Field(deletionFeeEuros, "€", KeyboardType.Number) { deletionFeeEuros = it }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "You set this number yourself, and you set it while you still meant " +
                            "it. Delete the app or revoke a permission before the term is " +
                            "served and it is collected. €0 is allowed, and is not recommended.",
                        color = Muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                }

                Panel {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = acceptedImmediate,
                            onCheckedChange = { acceptedImmediate = it },
                            colors = CheckboxDefaults.colors(checkedColor = Accent, checkmarkColor = Bg),
                        )
                        Text(
                            "I want Costly to start immediately, and I understand this means " +
                                "I lose my 14-day right to withdraw once it has run.",
                            color = Muted,
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                        )
                    }
                }

                NavRow(
                    onBack = { step = 3 },
                    nextLabel = "SIGN THE CONTRACT",
                    nextEnabled = acceptedImmediate,
                ) {
                    onDone(
                        OnboardingDraft(
                            hourlyRateCents = (euros(hourlyRateEuros) * 100).toInt(),
                            dailyFreeMinutes = dailyFreeMinutes,
                            anchors = picked
                                .sortedBy { it.priceEuros }
                                .map { AnchorItem(it.name, it.priceEuros * 100) },
                            lockinDays = lockinDays,
                            deletionFeeCents = (euros(deletionFeeEuros) * 100).toInt(),
                        ),
                    )
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}

// ── small parts ──────────────────────────────────────────────────────────

@Composable
private fun StepDots(step: Int) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        (1..4).forEach { i ->
            Box(
                Modifier
                    .weight(1f)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(if (i <= step) Accent else Line),
            )
        }
    }
}

@Composable
private fun PillButton(text: String, bg: Color, fg: Color, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = fg, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}

@Composable
private fun PrimaryCta(text: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (enabled) Accent else Surface2)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            color = if (enabled) Bg else Faint,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 16.sp,
        )
    }
}

@Composable
private fun NavRow(
    onBack: () -> Unit,
    nextLabel: String,
    nextEnabled: Boolean,
    onNext: () -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier
                .clip(RoundedCornerShape(14.dp))
                .background(Surface2)
                .clickable(onClick = onBack)
                .padding(horizontal = 22.dp, vertical = 16.dp),
        ) {
            Text("BACK", color = Muted, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
        Box(Modifier.weight(1f)) { PrimaryCta(nextLabel, nextEnabled, onNext) }
    }
}

@Composable
private fun ChipGrid(labels: List<String>, selectedIndex: Int = -1, onPick: (Int) -> Unit) {
    var selected by remember { mutableStateOf(selectedIndex) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        labels.chunked(3).forEachIndexed { rowIdx, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEachIndexed { colIdx, label ->
                    val index = rowIdx * 3 + colIdx
                    val on = index == selected
                    Box(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (on) Accent else Surface2)
                            .clickable { selected = index; onPick(index) }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            label,
                            color = if (on) Bg else Muted,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
                repeat(3 - row.size) { Box(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun Field(value: String, label: String, keyboard: KeyboardType, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, color = Faint) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Fg,
            unfocusedTextColor = Fg,
            focusedBorderColor = Accent,
            unfocusedBorderColor = Line,
            cursorColor = Accent,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}

private fun euros(text: String): Double = text.replace(',', '.').toDoubleOrNull() ?: 0.0

private fun perMinute(hourly: String): String {
    val cents = euros(hourly) * 100 / 60
    return "%.2f €".format(cents / 100)
}

private fun minutesLabel(m: Int): String =
    if (m >= 60 && m % 60 == 0) "${m / 60}h" else if (m > 60) "${m / 60}h ${m % 60}m" else "$m min"
