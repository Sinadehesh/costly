package app.costly.companion.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import app.costly.companion.BuildConfig
import app.costly.companion.Prefs
import app.costly.companion.net.Network
import app.costly.companion.ui.theme.Bg
import app.costly.companion.ui.theme.Danger
import app.costly.companion.ui.theme.Faint
import app.costly.companion.ui.theme.Fg
import app.costly.companion.ui.theme.Gold
import app.costly.companion.ui.theme.Muted
import app.costly.companion.ui.theme.Surface2
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import com.stripe.android.paymentsheet.rememberPaymentSheet

/**
 * THE VAULT — step 6, the card.
 *
 * PaymentSheet rather than a hand-rolled form: the PAN is entered inside
 * Stripe's own UI and tokenised there, so the number never enters this
 * process and the app stays out of PCI scope. It also brings 3DS, Google Pay
 * and every local method for free.
 *
 * The SetupIntent is session-authenticated, which is why sign-in has to have
 * happened before this screen — and why the session token had to start coming
 * back in the login body at all.
 */
@Composable
fun CardScreen(onSaved: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current

    var clientSecret by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(true) }

    val paymentSheet = rememberPaymentSheet { result ->
        when (result) {
            is PaymentSheetResult.Completed -> onSaved()
            is PaymentSheetResult.Canceled -> error = null // they can try again
            is PaymentSheetResult.Failed -> error = result.error.message ?: "The card was refused."
        }
    }

    // Fetch the client secret once. The publishable key is public by design;
    // it only permits tokenising, never charging.
    LaunchedEffect(Unit) {
        val key = BuildConfig.STRIPE_PUBLISHABLE_KEY
        if (key.isBlank()) {
            error = "This build has no Stripe key. Set costlyStripePublishableKey and rebuild."
            busy = false
            return@LaunchedEffect
        }
        PaymentConfiguration.init(context, key)

        val token = Prefs.sessionToken(context)
        if (token == null) {
            error = "Signed out. Sign in again before adding a card."
            busy = false
            return@LaunchedEffect
        }
        runCatching { Network.api.setupIntent("Bearer $token") }
            .onSuccess { clientSecret = it.clientSecret }
            .onFailure { error = "Could not reach the vault. Check your connection." }
        busy = false
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Bg)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        CatCard(
            mood = CatMood.GREEDY,
            headline = "The Vault",
            line = "Give me something to reach into. I will only use it when you scroll.",
        )

        Panel {
            Text("The Vault", color = Fg, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(8.dp))
            Text(
                "Your card is saved with Stripe, not with us — the number never " +
                    "reaches this app. Nothing is charged today. From the moment you " +
                    "arm the meter, it is charged automatically, without asking again.",
                color = Muted,
                fontSize = 14.sp,
                lineHeight = 20.sp,
            )

            error?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = Danger, fontSize = 13.sp, lineHeight = 19.sp)
            }

            Spacer(Modifier.height(14.dp))
            CtaButton(
                text = when {
                    busy -> "Opening the vault…"
                    clientSecret == null -> "Try again"
                    else -> "Add my card"
                },
                enabled = !busy,
                color = Gold,
            ) {
                val secret = clientSecret
                if (secret == null) {
                    error = null
                    busy = true
                    return@CtaButton
                }
                paymentSheet.presentWithSetupIntent(
                    setupIntentClientSecret = secret,
                    configuration = PaymentSheet.Configuration(merchantDisplayName = "Costly"),
                )
            }
        }

        Panel {
            Text(
                "> nothing is metered until you finish setting up permissions.",
                color = Faint,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                lineHeight = 17.sp,
            )
        }

        CtaButton(text = "Back", color = Surface2) { onBack() }
    }
}
