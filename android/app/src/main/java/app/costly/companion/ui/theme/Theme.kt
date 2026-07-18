package app.costly.companion.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Costly design tokens — same palette as the web app. Dark only.
val Bg = Color(0xFF0B0D0A)
val Surface = Color(0xFF151812)
val Accent = Color(0xFF2EDB6A)
val Burn = Color(0xFFFF3B2F)
val Gold = Color(0xFFF5B940)
val Fg = Color(0xFFF2F4EF)
val Muted = Color(0xFF98A090)

private val scheme = darkColorScheme(
    primary = Accent,
    onPrimary = Bg,
    background = Bg,
    onBackground = Fg,
    surface = Surface,
    onSurface = Fg,
    surfaceVariant = Surface,
    onSurfaceVariant = Muted,
    error = Burn,
)

@Composable
fun CostlyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, content = content)
}
