package app.costly.companion.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Costly design tokens — the same palette as the web app, kept in lockstep
// with web/src/app/globals.css. Dark only.
//
// Colour carries meaning here and is not decoration:
//   Accent  the house talking — CTAs, chrome, "this is done"
//   Burn    money at risk and the live meter ONLY, never a form error
//   Gold    the user beating the house
//   Danger  ordinary failure (a bad code, a blocked permission), deliberately
//           distinct from Burn so "that didn't work" never wears the same
//           colour as "your card is about to be charged"
val Bg = Color(0xFF0B0D0A)
val Surface = Color(0xFF151812)
val Surface2 = Color(0xFF1E231A)
val Line = Color(0xFF2A3124)
val Accent = Color(0xFF2EDB6A)
val AccentDim = Color(0xFF1A7A3C)
val Burn = Color(0xFFFF3B2F)
val Gold = Color(0xFFF5B940)
val Danger = Color(0xFFE0574A)
val Fg = Color(0xFFF2F4EF)
val Muted = Color(0xFF98A090)
val Faint = Color(0xFF6B7364)

private val scheme = darkColorScheme(
    primary = Accent,
    onPrimary = Bg,
    background = Bg,
    onBackground = Fg,
    surface = Surface,
    onSurface = Fg,
    surfaceVariant = Surface2,
    onSurfaceVariant = Muted,
    outline = Line,
    error = Danger,
)

@Composable
fun CostlyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, content = content)
}
