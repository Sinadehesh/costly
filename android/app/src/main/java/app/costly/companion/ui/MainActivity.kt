package app.costly.companion.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import app.costly.companion.BuildConfig
import app.costly.companion.Prefs
import app.costly.companion.net.DeviceLinker
import app.costly.companion.net.GoogleAuth
import app.costly.companion.net.Network
import app.costly.companion.overlay.OverlayPermission
import app.costly.companion.spy.HeuristicSpyService
import app.costly.companion.spy.UsageAccess
import app.costly.companion.ui.theme.Accent
import app.costly.companion.ui.theme.AccentDim
import app.costly.companion.ui.theme.Bg
import app.costly.companion.ui.theme.Burn
import app.costly.companion.ui.theme.CostlyTheme
import app.costly.companion.ui.theme.Danger
import app.costly.companion.ui.theme.Faint
import app.costly.companion.ui.theme.Fg
import app.costly.companion.ui.theme.Gold
import app.costly.companion.ui.theme.Line
import app.costly.companion.ui.theme.Muted
import app.costly.companion.ui.theme.Surface2
import app.costly.companion.work.HealthSyncWorker
import app.costly.companion.work.HeartbeatWorker
import kotlinx.coroutines.launch

/**
 * The companion's front door.
 *
 * It used to open on five permission cards stacked at once, with a manual
 * 6-digit code as step one — a wall of technical chores handed to somebody who
 * has just signed a financial contract and expects to be finished. Three
 * things were wrong with that and all three are fixed here:
 *
 *  1. ONE THING AT A TIME. Setup is now a sequence: connect, then each
 *     permission in turn, with the rest collapsed. You cannot skim five
 *     simultaneous asks and know which one is blocking you.
 *  2. NOBODY TYPES A CODE. It signs in with an email and a password like any
 *     other app. The old 6-digit pairing code is a TV-and-console pattern and
 *     had no business on a device with a keyboard. The costly:// deep link
 *     still resolves so already-paired devices keep working.
 *  3. ANDROID'S RESTRICTED SETTINGS IS HANDLED OUT LOUD. On Android 13+ a
 *     sideloaded app cannot be granted Usage Access or overlay at all until
 *     the user flips "Allow restricted settings" in App info. The old UI
 *     bounced you to a settings screen with a permanently greyed-out toggle
 *     and no explanation — the single most common way to get stuck here.
 */
class MainActivity : ComponentActivity() {
    private var pendingOtp by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingOtp = otpFrom(intent)
        setContent {
            CostlyTheme {
                ArmingScreen(pendingOtp = pendingOtp, onOtpConsumed = { pendingOtp = null })
            }
        }
    }

    /** The activity is singleTask, so a deep link into a running app lands here. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingOtp = otpFrom(intent)
    }

    override fun onResume() {
        super.onResume()
        // Returning from the Settle Up browser flow → reconcile now. A 2xx
        // heartbeat clears the lock (Phase 2), and the prefs listener in
        // ArmingScreen dismisses the Settle Up screen the moment it does.
        HeartbeatWorker.pingNow(this)
    }

    private fun otpFrom(intent: Intent?): String? =
        intent?.data
            ?.takeIf { it.scheme == "costly" }
            ?.getQueryParameter("otp")
            ?.filter(Char::isDigit)
            ?.takeIf { it.length == 6 }
}

// ── Shared bits ──────────────────────────────────────────────────────────────

@Composable
private fun Eyebrow(text: String, color: Color = Accent) {
    Text(
        text,
        color = color,
        fontFamily = FontFamily.Monospace,
        fontSize = 11.sp,
        letterSpacing = 3.sp,
    )
}

// onClick is LAST so every call site can use trailing-lambda syntax; with it in
// the middle, `PrimaryButton("x") { … }` binds the lambda to `color` instead.
@Composable
private fun PrimaryButton(
    text: String,
    enabled: Boolean = true,
    color: Color = Accent,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = color,
            contentColor = Bg,
            disabledContainerColor = Surface2,
            disabledContentColor = Faint,
        ),
        modifier = Modifier.fillMaxWidth().height(52.dp),
    ) { Text(text, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
}

/**
 * A setup step. Exactly one is `active` at a time; finished steps shrink to a
 * single green line and pending ones grey out, so the screen always answers
 * "what do I do next" without being read top to bottom.
 */
@Composable
private fun Step(
    number: Int,
    title: String,
    done: Boolean,
    active: Boolean,
    body: String? = null,
    content: @Composable () -> Unit = {},
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (active) MaterialTheme.colorScheme.surface else Bg,
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (active) 2.dp else 1.dp,
                color = if (done) AccentDim else if (active) Line else Line.copy(alpha = 0.5f),
                shape = RoundedCornerShape(16.dp),
            ),
    ) {
        Column(Modifier.padding(if (active) 18.dp else 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(
                            if (done) Accent else if (active) Surface2 else Bg,
                            CircleShape,
                        )
                        .border(1.dp, if (done) Accent else Line, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (done) "✓" else "$number",
                        color = if (done) Bg else if (active) Fg else Faint,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    title,
                    color = if (done) Accent else if (active) Fg else Faint,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                )
            }

            // Only the step you're on explains itself. Collapsed steps stay a
            // single line so the whole flow fits on one screen.
            if (active) {
                body?.let {
                    Spacer(Modifier.height(10.dp))
                    Text(it, color = Muted, fontSize = 13.sp, lineHeight = 19.sp)
                }
                Spacer(Modifier.height(14.dp))
                content()
            }
        }
    }
}

/**
 * The escape hatch for Android's restricted settings. Sideloading is the ONLY
 * way to install this app today, and Android 13+ silently refuses to let a
 * sideloaded app hold Usage Access or overlay until this toggle is flipped —
 * the settings switch is simply greyed out with no reason given. Without this
 * panel the setup is a dead end, which is exactly where testing got stuck.
 */
@Composable
private fun RestrictedSettingsHelp(context: Context) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Surface2, RoundedCornerShape(14.dp))
            .border(1.dp, Danger.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .padding(14.dp),
    ) {
        Eyebrow("TOGGLE GREYED OUT?", Danger)
        Spacer(Modifier.height(8.dp))
        Text(
            "Android blocks sideloaded apps from holding this permission until you " +
                "unlock it by hand. It takes ten seconds:",
            color = Muted,
            fontSize = 13.sp,
            lineHeight = 19.sp,
        )
        Spacer(Modifier.height(8.dp))
        listOf(
            "Open App info below",
            "Tap ⋮ in the top-right corner",
            "Tap \"Allow restricted settings\"",
            "Come back and grant the permission",
        ).forEachIndexed { i, line ->
            Text(
                "${i + 1}.  $line",
                color = Fg,
                fontSize = 13.sp,
                fontFamily = FontFamily.Monospace,
                lineHeight = 22.sp,
            )
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            onClick = {
                context.startActivity(
                    Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:${context.packageName}"),
                    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Open App info", color = Fg) }
    }
}

// ── The screen ───────────────────────────────────────────────────────────────

@Composable
fun ArmingScreen(pendingOtp: String? = null, onOtpConsumed: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // God mode counts as linked: it has no account but it does run the meter,
    // so the permission steps are exactly what it needs to show.
    var linked by remember { mutableStateOf(Prefs.isLinked(context) || Prefs.isGodMode(context)) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var linking by remember { mutableStateOf(false) }
    var linkError by remember { mutableStateOf<String?>(null) }

    var monitoringOn by remember { mutableStateOf(UsageAccess.isGranted(context)) }
    var overlayOn by remember { mutableStateOf(OverlayPermission.canDraw(context)) }
    var healthGranted by remember { mutableStateOf(false) }
    var batteryExempt by remember {
        mutableStateOf(
            context.getSystemService(PowerManager::class.java)
                .isIgnoringBatteryOptimizations(context.packageName),
        )
    }
    var syncRequested by remember { mutableStateOf(false) }
    // Shown only after a permission trip comes back empty-handed — the most
    // likely cause by far is the restricted-settings block.
    var showBlockedHelp by remember { mutableStateOf(false) }

    var paymentFailed by remember { mutableStateOf(Prefs.isPaymentFailed(context)) }
    DisposableEffect(Unit) {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            paymentFailed = Prefs.isPaymentFailed(context)
        }
        Prefs.registerChangeListener(context, listener)
        onDispose { Prefs.unregisterChangeListener(context, listener) }
    }

    fun startEngineIfReady() {
        if (Prefs.isLinked(context) && UsageAccess.isGranted(context)) {
            HeuristicSpyService.start(context)
        }
    }

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* taunts are a bonus, not a dependency */ }

    fun completeLink() {
        linked = true
        // Skipped in god mode: every one of these calls the API, which god mode
        // has no credential for and deliberately never touches.
        if (!Prefs.isGodMode(context)) {
            HeartbeatWorker.schedule(context)
            HealthSyncWorker.schedule(context)
            HeartbeatWorker.pingNow(context)
        }
        startEngineIfReady()
        if (Build.VERSION.SDK_INT >= 33) {
            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    // Deep link from the dashboard: pair without the user typing anything.
    LaunchedEffect(pendingOtp) {
        val code = pendingOtp ?: return@LaunchedEffect
        if (linked) { onOtpConsumed(); return@LaunchedEffect }
        linking = true
        linkError = null
        DeviceLinker.link(context, code)
            .onSuccess { completeLink() }
            .onFailure { linkError = "That link has expired. Generate a fresh one." }
        linking = false
        onOtpConsumed()
    }

    val healthPermissionLauncher = rememberLauncherForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted -> healthGranted = granted.containsAll(HealthSyncWorker.REQUIRED_PERMISSIONS) }

    val overlayLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        overlayOn = OverlayPermission.canDraw(context)
        if (!overlayOn) showBlockedHelp = true
    }

    val usageAccessLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        monitoringOn = UsageAccess.isGranted(context)
        // Came back without it: almost always the restricted-settings block,
        // so say so instead of leaving them to guess.
        if (!monitoringOn) showBlockedHelp = true
        startEngineIfReady()
    }

    if (paymentFailed) {
        SettleUpScreen(
            initialSettleUpUrl = Prefs.settleUpUrl(context),
            onOpenUrl = { url -> context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) },
        )
        return
    }

    if (!linked) {
        SignInScreen(
            email = email,
            onEmailChange = { email = it },
            password = password,
            onPasswordChange = { password = it },
            busy = linking,
            error = linkError,
            onGoogle = {
                linking = true
                linkError = null
                scope.launch {
                    DeviceLinker.signInWithGoogle(context)
                        .onSuccess { completeLink() }
                        .onFailure { linkError = "Google sign-in did not complete." }
                    linking = false
                }
            },
            onSignIn = {
                linking = true
                linkError = null
                scope.launch {
                    DeviceLinker.signIn(context, email, password)
                        .onSuccess { password = ""; completeLink() }
                        .onFailure { linkError = "Wrong email or password." }
                    linking = false
                }
            },
            onGodMode = {
                Prefs.setGodMode(context, true)
                monitoringOn = UsageAccess.isGranted(context)
                completeLink()
            },
        )
        return
    }

    // Usage Access is the only permission the meter genuinely cannot run
    // without; the rest degrade features, not correctness.
    val armed = monitoringOn
    val steps = listOf(monitoringOn, overlayOn, healthGranted, batteryExempt)
    val doneCount = steps.count { it }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Eyebrow("COSTLY / COMPANION")

        if (Prefs.isGodMode(context)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "GOD MODE: local test only. Nothing is billed.",
                    color = Gold,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    modifier = Modifier.weight(1f),
                )
                // Without this there is no way back to a real account once the
                // flag is set, which would make the test mode a trap.
                TextButton(onClick = {
                    HeuristicSpyService.stop(context)
                    Prefs.setGodMode(context, false)
                    linked = Prefs.isLinked(context)
                }) { Text("Exit", color = Muted, fontSize = 12.sp) }
            }
        }

        Text(
            if (armed) "SYSTEM ARMED" else "ALMOST ARMED",
            color = if (armed) Accent else Gold,
            fontFamily = FontFamily.Monospace,
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            if (armed)
                "The meter is live. Every confirmed doomscroll is billed, and every 12 hours we phone home. You wrote these terms."
            else
                "One permission away. Until it's granted nothing is metered and nothing is proven.",
            color = Muted,
            fontSize = 14.sp,
            lineHeight = 20.sp,
        )

        // Progress: four setup chores, and how many are behind you.
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            steps.forEach { ok ->
                Box(
                    Modifier
                        .weight(1f)
                        .height(4.dp)
                        .background(if (ok) Accent else Line, RoundedCornerShape(2.dp)),
                )
            }
        }
        Text(
            "$doneCount of 4 complete",
            color = Faint,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
        )

        Spacer(Modifier.height(4.dp))

        Step(
            number = 1,
            title = "The eyes. Usage Access",
            done = monitoringOn,
            active = !monitoringOn,
            body = "Lets us see which app is in the foreground; the gyroscope decides whether " +
                "you're actually scrolling. We can't bill what we can't see, and revoking it " +
                "mid-lock-in counts as desertion.",
        ) {
            PrimaryButton("Grant Usage Access") {
                showBlockedHelp = false
                usageAccessLauncher.launch(UsageAccess.settingsIntent())
            }
            if (showBlockedHelp) {
                Spacer(Modifier.height(12.dp))
                RestrictedSettingsHelp(context)
            }
        }

        Step(
            number = 2,
            title = "The meter. draw over apps",
            done = overlayOn,
            active = monitoringOn && !overlayOn,
            body = "The live meter floats over whatever you're scrolling, ticking your money " +
                "away in real time. You can drag it aside. You cannot make it lie.",
        ) {
            PrimaryButton("Allow drawing over apps") {
                showBlockedHelp = false
                overlayLauncher.launch(OverlayPermission.requestIntent(context))
            }
            if (showBlockedHelp) {
                Spacer(Modifier.height(12.dp))
                RestrictedSettingsHelp(context)
            }
        }

        Step(
            number = 3,
            title = "The legs. Health Connect",
            done = healthGranted,
            active = monitoringOn && overlayOn && !healthGranted,
            body = "Proof you actually walked. No walk data, no refunds. your 80% sits in " +
                "purgatory until the deadline eats it.",
        ) {
            val available =
                HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
            PrimaryButton(
                if (available) "Grant health access" else "Health Connect not installed",
                enabled = available,
            ) { healthPermissionLauncher.launch(HealthSyncWorker.REQUIRED_PERMISSIONS) }
        }

        Step(
            number = 4,
            title = "Keep us alive. battery",
            done = batteryExempt,
            active = monitoringOn && overlayOn && healthGranted && !batteryExempt,
            body = "Doze delays our 12-hour proof-of-life ping. If Android silences us for 24 " +
                "hours during lock-in the server assumes you deleted us, and collects. This " +
                "protects you, not us.",
        ) {
            PrimaryButton("Exempt from battery optimisation") {
                context.startActivity(
                    Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:${context.packageName}"),
                    ),
                )
                batteryExempt = context.getSystemService(PowerManager::class.java)
                    .isIgnoringBatteryOptimizations(context.packageName)
            }
        }

        if (armed) {
            Spacer(Modifier.height(8.dp))
            PrimaryButton(
                if (syncRequested) "Syncing. check the dashboard" else "Sync my walk now",
                color = Gold,
            ) {
                HealthSyncWorker.syncNow(context)
                syncRequested = true
            }
        }

        Spacer(Modifier.height(8.dp))
        Text(
            "Deleting this app during lock-in does not delete the contract.",
            color = Faint,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
        )
    }
}

/**
 * Sign in.
 *
 * Google is the default and the only thing visible by default: one tap, no
 * password to invent, and Credential Manager shows the account sheet inside the
 * app so there is no browser hop. Email and password is folded away underneath
 * for anyone who would rather not hand Google another app.
 *
 * What this screen no longer does is send anyone to a website. Telling a person
 * holding your app to go and visit your web page to get a code, or to sign up,
 * is a dead end dressed as a step.
 */
@Composable
private fun SignInScreen(
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    busy: Boolean,
    error: String?,
    onGoogle: () -> Unit,
    onSignIn: () -> Unit,
    onGodMode: () -> Unit,
) {
    var showEmail by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(36.dp))
        Eyebrow("COSTLY / COMPANION")
        Text("Sign in", color = Fg, fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Text(
            "Use the account you signed the contract with. This app is the eyes and " +
                "the legs; the rate, the wishlist and the card live in your account.",
            color = Muted,
            fontSize = 14.sp,
            lineHeight = 20.sp,
        )

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().border(1.dp, Line, RoundedCornerShape(16.dp)),
        ) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (GoogleAuth.isConfigured) {
                    PrimaryButton(
                        if (busy) "Signing in..." else "Continue with Google",
                        enabled = !busy,
                        onClick = onGoogle,
                    )
                } else {
                    Text(
                        "Google sign-in is not configured in this build. Use email and " +
                            "password below.",
                        color = Danger,
                        fontSize = 13.sp,
                    )
                }

                error?.let { Text(it, color = Danger, fontSize = 13.sp) }

                if (!showEmail) {
                    TextButton(
                        onClick = { showEmail = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "Use an email and password instead",
                            color = Muted,
                            fontSize = 13.sp,
                        )
                    }
                } else {
                    OutlinedTextField(
                        value = email,
                        onValueChange = onEmailChange,
                        singleLine = true,
                        enabled = !busy,
                        label = { Text("Email") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Accent,
                            unfocusedBorderColor = Line,
                        ),
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = onPasswordChange,
                        singleLine = true,
                        enabled = !busy,
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Accent,
                            unfocusedBorderColor = Line,
                        ),
                    )
                    PrimaryButton(
                        if (busy) "Signing in..." else "Sign in",
                        enabled = !busy && email.contains("@") && password.isNotEmpty(),
                        onClick = onSignIn,
                    )
                }
            }
        }

        // ── Debug-only: skip everything and just test the meter ─────────────
        // Present only in debug builds, and Prefs.isGodMode is gated on
        // BuildConfig.DEBUG at the read too, so a release build cannot honour
        // the flag even if the preference is on disk. It grants NO server
        // access: there is no endpoint behind it to abuse.
        if (BuildConfig.DEBUG) {
            Spacer(Modifier.height(8.dp))
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Surface2, RoundedCornerShape(14.dp))
                    .border(1.dp, Gold.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Eyebrow("DEBUG BUILD", Gold)
                Text(
                    "God mode runs the detector, the meter and the overlay with no " +
                        "account and no server. Nothing is billed and no request is sent. " +
                        "Use it to check whether scrolling is actually detected on this phone.",
                    color = Muted,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                )
                PrimaryButton("Skip sign-in and test the meter", color = Gold, onClick = onGodMode)
            }
        }

        Spacer(Modifier.height(8.dp))
        Text(
            if (BuildConfig.DEBUG)
                "Nothing is metered until this phone is signed in, or god mode is on."
            else
                "Nothing is metered until this phone is signed in.",
            color = Faint,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/**
 * The Phase 2 hard-lock. Shown instead of the whole arming UI when a charge
 * has failed. There is no path back to arming from here — only settling.
 */
@Composable
fun SettleUpScreen(initialSettleUpUrl: String?, onOpenUrl: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(initialSettleUpUrl) }
    var generating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(28.dp))
        Eyebrow("PAYMENT FAILED", Burn)
        Text(
            "SETTLE UP",
            color = Burn,
            fontFamily = FontFamily.Monospace,
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "A charge didn't go through, so everything is frozen. No metering, " +
                "no arming, no mercy. until the balance clears. You knew the terms.",
            color = Muted,
            fontSize = 14.sp,
            lineHeight = 20.sp,
        )

        val existing = url
        if (existing != null) {
            PrimaryButton("Settle up now") { onOpenUrl(existing) }
        } else {
            PrimaryButton(
                if (generating) "Generating…" else "Generate payment link",
                enabled = !generating,
            ) {
                generating = true
                error = null
                scope.launch {
                    runCatching { Network.api.createCheckout().url }
                        .onSuccess { generated ->
                            generating = false
                            if (generated != null) {
                                url = generated
                                onOpenUrl(generated)
                            } else {
                                error = "Couldn't create a payment link. Try again."
                            }
                        }
                        .onFailure {
                            generating = false
                            error = "Couldn't reach the server. Try again."
                        }
                }
            }
        }

        error?.let { Text(it, color = Danger, fontSize = 13.sp) }

        Text(
            "Once you've paid, this unlocks itself.",
            color = Faint,
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
        )
    }
}
