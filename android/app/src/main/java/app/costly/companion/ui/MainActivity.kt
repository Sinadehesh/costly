package app.costly.companion.ui

import android.Manifest
import android.content.Intent
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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import app.costly.companion.Prefs
import app.costly.companion.overlay.OverlayPermission
import app.costly.companion.ui.theme.Accent
import app.costly.companion.ui.theme.Bg
import app.costly.companion.ui.theme.Burn
import app.costly.companion.ui.theme.CostlyTheme
import app.costly.companion.ui.theme.Fg
import app.costly.companion.ui.theme.Gold
import app.costly.companion.ui.theme.Muted
import app.costly.companion.work.HealthSyncWorker
import app.costly.companion.work.HeartbeatWorker

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CostlyTheme { ArmingScreen() }
        }
    }
}

/**
 * The arming UI. One job: bind this device to a userId, walk the user
 * through the three permissions that make the system real, and let them
 * trigger a manual health sync when they want their money back sooner.
 */
@Composable
fun ArmingScreen() {
    val context = LocalContext.current
    var userId by remember { mutableStateOf(Prefs.userId(context) ?: "") }
    var armed by remember { mutableStateOf(Prefs.userId(context) != null) }
    var accessibilityOn by remember {
        mutableStateOf(HeartbeatWorker.isAccessibilityEnabled(context))
    }
    var healthGranted by remember { mutableStateOf(false) }
    var syncRequested by remember { mutableStateOf(false) }
    var overlayOn by remember { mutableStateOf(OverlayPermission.canDraw(context)) }
    var showRestrictedWarning by remember { mutableStateOf(false) }

    val healthPermissionLauncher = rememberLauncherForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted -> healthGranted = granted.containsAll(HealthSyncWorker.REQUIRED_PERMISSIONS) }

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* taunts are a bonus, not a dependency */ }

    // Returning from the overlay settings screen has no result payload; re-check.
    val overlayLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { overlayOn = OverlayPermission.canDraw(context) }

    if (showRestrictedWarning) {
        AlertDialog(
            onDismissRequest = { showRestrictedWarning = false },
            confirmButton = {
                TextButton(onClick = {
                    showRestrictedWarning = false
                    overlayLauncher.launch(OverlayPermission.requestIntent(context))
                }) { Text("I understand — continue", color = Accent) }
            },
            dismissButton = {
                TextButton(onClick = { showRestrictedWarning = false }) {
                    Text("Cancel", color = Muted)
                }
            },
            containerColor = MaterialTheme.colorScheme.surface,
            title = { Text("One Android 15 trap first", color = Fg) },
            text = {
                Text(
                    "If you sideloaded this APK, Android 15 hides the overlay toggle behind " +
                        "\"restricted settings\". If the switch is greyed out: go to App info → " +
                        "the ⋮ menu → \"Allow restricted settings\", then come back and grant it. " +
                        "We warned you the escape routes were closing.",
                    color = Muted,
                )
            },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "COSTLY / COMPANION",
            color = Accent,
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            letterSpacing = 4.sp,
        )

        Text(
            if (armed && accessibilityOn) "SYSTEM ARMED" else "SYSTEM UNARMED",
            color = if (armed && accessibilityOn) Accent else Burn,
            fontFamily = FontFamily.Monospace,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            if (armed && accessibilityOn)
                "Watching for user $userId. Every vice minute is billed. Every 12 hours we phone home. You know the terms — you wrote them."
            else
                "Nothing is being metered. Nothing is being proven. Your contract can still breach you for this. Finish the setup.",
            color = Muted,
            fontSize = 14.sp,
        )

        // ── Identity ──────────────────────────────────────────────────────
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("1 · Who are we billing?", color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold)
                Text(
                    "Paste the user ID from your web dashboard (Settings → device linking).",
                    color = Muted, fontSize = 12.sp,
                )
                OutlinedTextField(
                    value = userId,
                    onValueChange = { userId = it },
                    singleLine = true,
                    label = { Text("userId") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Accent,
                        unfocusedBorderColor = Muted,
                    ),
                )
                Button(
                    onClick = {
                        Prefs.setUserId(context, userId)
                        armed = true
                        HeartbeatWorker.schedule(context)
                        HealthSyncWorker.schedule(context)
                        HeartbeatWorker.pingNow(context) // first proof of life arms the switch
                        if (Build.VERSION.SDK_INT >= 33) {
                            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    },
                    enabled = userId.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (armed) "Re-arm" else "Arm the switch") }
            }
        }

        // ── Accessibility ─────────────────────────────────────────────────
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "2 · The eyes" + if (accessibilityOn) " — granted" else "",
                    color = if (accessibilityOn) Accent else MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Accessibility lets us see which app is in the foreground and whether " +
                        "you're scrolling. We can't bill what we can't see. Revoking this " +
                        "mid-lock-in counts as desertion.",
                    color = Muted, fontSize = 12.sp,
                )
                Button(
                    onClick = { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) },
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Open accessibility settings") }
            }
        }

        // ── Overlay ───────────────────────────────────────────────────────
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "3 · The meter" + if (overlayOn) " — granted" else "",
                    color = if (overlayOn) Accent else MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "The live meter floats over the app you're doomscrolling, ticking your " +
                        "money away in real time. You can drag it aside. You cannot make it lie.",
                    color = Muted, fontSize = 12.sp,
                )
                Button(
                    onClick = {
                        // Android 15 hides the toggle behind restricted settings for
                        // sideloaded apps — warn first, then bounce to settings.
                        if (Build.VERSION.SDK_INT >= 35 && !overlayOn) {
                            showRestrictedWarning = true
                        } else {
                            overlayLauncher.launch(OverlayPermission.requestIntent(context))
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Allow drawing over apps") }
            }
        }

        // ── Health Connect ────────────────────────────────────────────────
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "4 · The legs" + if (healthGranted) " — granted" else "",
                    color = if (healthGranted) Accent else MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Health Connect proves you actually walked. No walk data, no refunds — " +
                        "your 80% stays in purgatory until the deadline eats it.",
                    color = Muted, fontSize = 12.sp,
                )
                Button(
                    onClick = {
                        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
                            healthPermissionLauncher.launch(HealthSyncWorker.REQUIRED_PERMISSIONS)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Grant health access") }
            }
        }

        // ── Battery exemption + manual sync ───────────────────────────────
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("5 · Keep us alive", color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold)
                Text(
                    "Doze mode delays our 12-hour proof-of-life ping. If Android silences us " +
                        "for 24 hours during lock-in, the server assumes you deleted us — and " +
                        "collects. Exempt us from battery optimization. Protect yourself.",
                    color = Muted, fontSize = 12.sp,
                )
                Button(
                    onClick = {
                        val pm = context.getSystemService(PowerManager::class.java)
                        if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
                            context.startActivity(
                                Intent(
                                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                                    Uri.parse("package:${context.packageName}"),
                                ),
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Exempt from battery optimization") }

                Button(
                    onClick = {
                        HealthSyncWorker.syncNow(context)
                        syncRequested = true
                    },
                    enabled = armed,
                    colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Bg),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (syncRequested) "Syncing — check the dashboard" else "Sync my walk NOW") }
            }
        }

        Text(
            "Deleting this app during lock-in does not delete the contract.",
            color = Muted,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
        )
    }
}
