package app.costly.companion.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Canvas

/**
 * THE MASCOT CARD, matching web/src/components/CatWidget.tsx.
 *
 * Every coordinate below is lifted from Cat.tsx's 112x84 viewBox rather than
 * redrawn by eye, so the companion and the dashboard show one animal instead
 * of two that resemble each other. Card treatment is the web's too: 4dp
 * border, 16dp radius, TONE_BG fill, hard offset shadow.
 */

private val FUR = Color(0xFF0A0A0A)
private val EYE = Color(0xFFFFFFFF)

/** TONE_BG from Cat.tsx, by mood tier. */
enum class CatTone(val bg: Color) {
    SLATE(Color(0xFF79836F)),
    CALM(Color(0xFFA9C3CF)),
    AMBER(Color(0xFFD9A441)),
    ORANGE(Color(0xFFE87F3C)),
    RED(Color(0xFFEF4444)),
    GOLD(Color(0xFFF5B940)),
}

enum class CatMood { WAITING, GREEDY, UNHINGED, SULKING, DEFEATED, KIND }

/** The tone the web picks for a given amount at stake. */
fun toneFor(mood: CatMood): CatTone = when (mood) {
    CatMood.WAITING -> CatTone.SLATE
    CatMood.GREEDY -> CatTone.ORANGE
    CatMood.UNHINGED -> CatTone.RED
    CatMood.SULKING -> CatTone.SLATE
    CatMood.DEFEATED -> CatTone.GOLD
    CatMood.KIND -> CatTone.CALM
}

private fun DrawScope.catPath(block: Path.() -> Unit) = drawPath(Path().apply(block), FUR)

/**
 * The cat, drawn in Cat.tsx's own coordinate space and scaled to fit.
 * Ears are flattened for sulking/defeated — the single clearest "this animal
 * is unhappy" signal in the drawing, worth more than any eye shape.
 */
@Composable
fun CatFace(mood: CatMood, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val k = size.width / 112f
        scale(k, k, pivot = Offset.Zero) {
            // tail
            drawPath(
                Path().apply {
                    moveTo(92f, 80f)
                    quadraticBezierTo(108f, 76f, 104f, 60f)
                    quadraticBezierTo(102f, 51f, 96f, 51f)
                },
                FUR,
                style = Stroke(width = 6f, cap = StrokeCap.Round),
            )
            // whiskers
            listOf(
                Offset(7f, 47f) to Offset(34f, 50f),
                Offset(7f, 56f) to Offset(34f, 55f),
                Offset(93f, 47f) to Offset(66f, 50f),
                Offset(93f, 56f) to Offset(66f, 55f),
            ).forEach { (a, b) ->
                drawLine(FUR, a, b, strokeWidth = 2f, cap = StrokeCap.Round)
            }

            val flat = mood == CatMood.SULKING || mood == CatMood.DEFEATED
            if (flat) {
                catPath { moveTo(2f, 47f); lineTo(32f, 25f); lineTo(28f, 46f); close() }
                catPath { moveTo(98f, 47f); lineTo(68f, 25f); lineTo(72f, 46f); close() }
            } else {
                catPath { moveTo(26f, 24f); lineTo(33f, 3f); lineTo(49f, 18f); close() }
                catPath { moveTo(74f, 24f); lineTo(67f, 3f); lineTo(51f, 18f); close() }
            }

            // head: rounded dome, flat bottom
            drawPath(
                Path().apply {
                    moveTo(14f, 66f)
                    lineTo(14f, 46f)
                    cubicTo(14f, 12f, 86f, 12f, 86f, 46f)
                    lineTo(86f, 66f)
                    close()
                },
                FUR,
            )

            drawEyes(mood)
            drawMouth(mood)

            // paws gripping the ledge
            listOf(27f, 34f, 41f, 53f, 60f, 67f).forEach { x ->
                drawRoundRect(
                    FUR,
                    topLeft = Offset(x, 60f),
                    size = androidx.compose.ui.geometry.Size(6f, 18f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f, 3f),
                )
            }
        }
    }
}

private fun DrawScope.drawEyes(mood: CatMood) = when (mood) {
    CatMood.UNHINGED, CatMood.GREEDY -> {
        drawPath(
            Path().apply {
                moveTo(30f, 41f); lineTo(47f, 48f); lineTo(46f, 53f); lineTo(30f, 47f); close()
            },
            EYE,
        )
        drawPath(
            Path().apply {
                moveTo(70f, 41f); lineTo(53f, 48f); lineTo(54f, 53f); lineTo(70f, 47f); close()
            },
            EYE,
        )
        drawCircle(FUR, 2.6f, Offset(39f, 47f))
        drawCircle(FUR, 2.6f, Offset(61f, 47f))
    }
    CatMood.SULKING, CatMood.DEFEATED -> {
        drawRoundRect(
            EYE,
            topLeft = Offset(30f, 44f),
            size = androidx.compose.ui.geometry.Size(17f, 5f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(2.5f, 2.5f),
        )
        drawRoundRect(
            EYE,
            topLeft = Offset(53f, 44f),
            size = androidx.compose.ui.geometry.Size(17f, 5f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(2.5f, 2.5f),
        )
        drawCircle(FUR, 2.2f, Offset(38.5f, 46.5f))
        drawCircle(FUR, 2.2f, Offset(61.5f, 46.5f))
    }
    else -> {
        drawCircle(EYE, 7f, Offset(39f, 46f))
        drawCircle(EYE, 7f, Offset(61f, 46f))
        drawCircle(FUR, 3f, Offset(39f, 47f))
        drawCircle(FUR, 3f, Offset(61f, 47f))
    }
}

private fun DrawScope.drawMouth(mood: CatMood) = when (mood) {
    CatMood.UNHINGED -> drawOval(
        EYE,
        topLeft = Offset(43.5f, 54f),
        size = androidx.compose.ui.geometry.Size(13f, 10f),
    )
    CatMood.SULKING, CatMood.DEFEATED -> drawRoundRect(
        EYE,
        topLeft = Offset(43f, 57f),
        size = androidx.compose.ui.geometry.Size(14f, 3f),
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(1.5f, 1.5f),
    )
    else -> drawPath(
        Path().apply { moveTo(44f, 56f); quadraticBezierTo(50f, 61f, 56f, 56f) },
        EYE,
        style = Stroke(width = 2.5f, cap = StrokeCap.Round),
    )
}

/**
 * Cat left, words right, on a bright ledge — the CatWidget layout. The hard
 * offset shadow is the web's `shadow-[6px_6px_0_0_rgba(0,0,0,0.55)]`, faked
 * with a second box behind because Compose has no non-blurred elevation.
 */
@Composable
fun CatCard(mood: CatMood, headline: String, line: String, modifier: Modifier = Modifier) {
    val tone = toneFor(mood)
    androidx.compose.foundation.layout.Box(modifier.fillMaxWidth()) {
        androidx.compose.foundation.layout.Box(
            Modifier
                .padding(start = 6.dp, top = 6.dp)
                .fillMaxWidth()
                .height(96.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0x8C000000)),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(tone.bg)
                .border(4.dp, Bg.copy(alpha = 0.7f), RoundedCornerShape(16.dp))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CatFace(mood, Modifier.size(width = 84.dp, height = 63.dp))
            Spacer(Modifier.width(12.dp))
            Column {
                Text(headline, color = Bg, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 21.sp)
                Spacer(Modifier.height(3.dp))
                Text(line, color = Bg.copy(alpha = 0.8f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 17.sp)
            }
        }
    }
}
