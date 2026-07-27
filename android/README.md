# Costly — Android companion

Kotlin · Jetpack Compose · WorkManager · UsageStatsManager + Gyroscope ·
Health Connect · Retrofit/OkHttp. minSdk 26, targetSdk 35.

## Toolchain requirements (read first — this bites at "configure")

- **AGP 8.7.3** → requires **Gradle 8.9+** (this project pins **8.11.1** in
  `gradle/wrapper/gradle-wrapper.properties`) and **Android Studio Ladybug
  (2024.2.1) or newer**. An older Studio rejects the plugin at sync with an
  "incompatible Android Gradle plugin" error.
- **JDK 17** (AGP 8.x requirement).
- **compileSdk / targetSdk 35** → install the **Android 15 (API 35)** SDK
  platform in the SDK Manager, or configuration fails.

### Generate the Gradle wrapper jar

The wrapper `.properties` is committed, but the binary `gradle-wrapper.jar`
must be generated once (it can't be created in the CI sandbox that produced
this repo). Do ONE of:

```bash
# from android/ , with a local Gradle installed:
gradle wrapper --gradle-version 8.11.1
```

…or simply **open `android/` in Android Studio** — on first sync it generates
the missing wrapper jar automatically. After that, `./gradlew :app:assembleDebug`
works.

This app is the spy and the dead man's switch. It has no data of its own
beyond a `userId` (pasted from the web dashboard) — everything it learns
it POSTs to the live Next.js API.

**No AccessibilityService.** For Google Play compliance the foreground
detection uses the **Heuristic Spy Engine**: `UsageStatsManager` for which
app is open + the **gyroscope** to detect the physical motion of
doomscrolling. The billing contract with the backend is unchanged.

## What each piece does

| Component | File | Job |
| --- | --- | --- |
| Arming UI | `ui/MainActivity.kt` | Bind a `userId`, walk the permissions (Usage Access, overlay, Health Connect, battery exemption), manual "Sync my walk". |
| The Spy (engine) | `spy/HeuristicSpyService.kt` | Foreground service: poll Usage Access for the foreground app, run the multi-signal engagement vote (network + gyro + audio) behind hard gates, run the billable meter, POST session start/heartbeat/end. |
| Doomscroll algorithm | `spy/DoomscrollDetector.kt` | Pure logic: swipe-signature + rolling-window pattern match distinguishing scrolling from walking. Unit-testable. |
| Network engagement | `spy/NetworkEngagementDetector.kt` | Primary signal: polls the target app's UID via `NetworkStatsManager` for content-pulling bursts. Motion-independent. |
| Usage Access | `spy/UsageAccess.kt` | Permission check (AppOps) + foreground-package detection via `queryEvents`. |
| Dead man's switch | `work/HeartbeatWorker.kt` | 12h `PeriodicWorkRequest` → `POST /api/device/heartbeat`; opportunistic expedited pings on launch/boot; caches the meter config from the response. |
| Sweat equity | `work/HealthSyncWorker.kt` | Daily step aggregate + read walking from Health Connect, POST cumulative minutes to the pending redemption task. |
| Live meter overlay | `overlay/CostlyOverlayService.kt`, `overlay/MeterOverlay.kt` | Foreground service hosting a Compose bubble in a `WindowManager` window; per-second punch-clock ticker. |
| Meter bus | `spy/MeterState.kt` | In-process `StateFlow` the spy publishes and the overlay observes — one source of truth, no double-counting. |
| Wiring | `CostlyApp.kt`, `BootReceiver.kt`, `net/`, `notify/`, `Prefs.kt` | App init, reboot re-arm, Retrofit client + DTOs, taunt notifications, local state + cached meter config. |

## How the spy bills (session lifecycle)

```
App Watcher (poll UsageStatsManager every 2s) → target pkg (IG / TikTok) foregrounded
  POST /api/sessions/start → sessionId (persisted in Prefs, survives restart)
  Gates armed: gyroscope (SENSOR_DELAY_GAME) + network poll (5s, target UID)
  billing ticker (1s): count a second ONLY when screen ON + not dormant AND
      ≥2 of 3 engagement signals agree {network burst, gyro swipe rhythm, audio}
  every ~30s → POST /sessions/:id/heartbeat {activeSecondsDelta, scrolledSinceLast}
      response.taunts   → fire "Thank you for buying us [item]" notification
      response.capReached → freeze billing, keep session open (no force-HOME
                            without accessibility)
target pkg leaves foreground (next 2s poll)
  Sensor Gate OFF (unregister gyro), flush final delta, POST /sessions/:id/end
```

### What "interactive doomscrolling" means (gates + engagement vote)

The meter ticks only when the **hard gates** hold AND the **engagement vote**
carries.

**Hard gates (all mandatory):**

1. **Screen on** — `PowerManager.isInteractive`. Closes the pocket-motion
   hole: a locked phone jostling with IG last-foregrounded bills nothing.
2. **Target app foreground** — `UsageStatsManager` (implied — the session
   only exists while a target is up).
3. **Not dormant** — the phone isn't propped/abandoned still on a table.

**Engagement vote — need ≥2 of 3, so no lone signal can charge a card:**

- **Network** (`NetworkEngagementDetector`) — the target app pulling content.
  The primary, motion-independent signal; reels stream continuously. Uses
  `NetworkStatsManager` on the app's UID (the `PACKAGE_USAGE_STATS` we already
  hold; target packages are in `<queries>` for UID visibility).
- **Gyro** (`DoomscrollDetector`) — the swipe-signature rhythm, the touch
  proxy (touch on another app is unobservable without AccessibilityService).
- **Audio** (`AudioManager.isMusicActive`) — media audio playing.

Two independent signal families must agree: network catches the gentle-thumb
scroll the gyro misses, the gyro catches the cached/low-traffic scroll the
network misses, and audio is the tie-breaker. Neither the gyro alone nor a
network blip alone bills.

### The doomscroll algorithm (`DoomscrollDetector`)

- **Swipe signature**: a sharp spike in angular velocity (primarily the
  X-axis) followed by 2–15s of relative stability (watching the reel).
  Touch-induced device rotation is real — swiping a touchscreen torques the
  phone in-hand — so with screen-on + in-app gating this is a strong touch
  proxy, not vibration guesswork.
- **Pattern match**: ≥2 swipe signatures inside a 20s rolling window ⇒
  confirmed doomscrolling → the meter ticks.
- **Walking rejection**: sustained mid-band motion never settles into the
  calm tail, so the stability timer keeps resetting and no swipe registers.
- **Dormancy**: angular velocity below a near-zero floor for 30s+ (phone on
  a table) pauses the meter.

> ⚠️ The `DoomscrollDetector` thresholds are still first-pass estimates and
> want on-device tuning before live cards. With the screen-on gate in place,
> the residual risk (screen genuinely on, in-app, ambient vibration but no
> touch — e.g. a car mount) is narrow and bounded by the server per-session
> cap.

Session state is guarded by a `Mutex` and the server `sessionId` is
persisted, so a process kill/restart resumes rather than orphaning an
ACTIVE session (the backend also returns the existing ACTIVE session from
`/start`).

## Guaranteed-execution reality (dead man's switch)

Android has no true "always runs" primitive — Doze defers periodic work,
OEM battery managers kill apps. The switch is defended in layers, not one
flag:

- 12h periodic work with a `CONNECTED` constraint and exponential backoff
  (a failed ping retries in minutes, not 12h);
- expedited one-shot pings on every launch, every boot, and — because the
  backend counts them as proof of life — every session heartbeat;
- the arming UI requests a battery-optimization exemption;
- the server only breaches after **two** missed windows (>24h), because a
  single deferred ping is normal Android weather.

## Health sync discovers its own task

The app knows only `userId`; redemption `taskId`s live server-side. So
`HealthSyncWorker` reads `GET /api/dashboard?userId=` for `PENDING` holds,
reads walking for `[session end → now]` from Health Connect (walking
`ExerciseSession`s authoritative; steps ÷ 100 as a conservative fallback),
and POSTs **cumulative** minutes to `/api/redemptions/:taskId/sync` (the
backend takes `max()`, so replays are harmless).

## Build & run

```bash
# from android/
./gradlew :app:assembleDebug            # needs Android SDK + JDK 17
./gradlew :app:testDebugUnitTest        # pure-JVM tests, no device needed
adb install app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:3000 tcp:3000           # or set API_BASE_URL to your LAN/deploy
```

### Build configuration (injected, not hardcoded)

`API_BASE_URL` and the signing key come from Gradle properties, so no
deployment URL or keystore password lives in the repo. Set them in
`~/.gradle/gradle.properties` (or pass `-P…` on the command line):

```properties
# Where the companion talks to the API. Trailing slash required.
costlyDebugApiBaseUrl=http://10.0.2.2:3000/          # optional; this is the default
costlyReleaseApiBaseUrl=https://your-deployment.example.com/

# Release signing. Omit ALL FOUR to fall back to the debug keystore.
costlyKeystorePath=/absolute/path/to/upload-keystore.jks
costlyKeystorePassword=…
costlyKeyAlias=upload
costlyKeyPassword=…
```

Two deliberate behaviours:

- **A release build with no `costlyReleaseApiBaseUrl` fails at configure
  time.** It used to hardcode `https://YOUR-DEPLOYMENT.vercel.app/`, which
  produced an APK that installed, ran, and silently failed every network call.
  A loud build failure beats a quietly broken app.
- **A release build with no keystore is debug-signed, with a warning.** That's
  fine for sideloading and correct for today, but Play rejects debug-signed
  uploads — set the four `costlyKeystore*` properties to sign with a real
  upload key. The point is that this is now a visible choice rather than AGP
  silently leaving the release unsigned.

### Unit tests

`app/src/test/` holds pure-JVM tests (JUnit 4) for the two modules that decide
money: `DoomscrollDetector` (swipe-signature pattern match, dormancy timeout,
and the negative cases — walking, shaking, off-axis rotation must never bill)
and `MeterMath` (display seconds, cent rounding that matches the server,
hostage-ladder escalation). They need no device or emulator and run in CI on
every push.

## The live meter overlay

`overlay/CostlyOverlayService` is a foreground service (Android 15+ requires
one behind a persistent overlay) that hosts a Compose bubble in a
`TYPE_APPLICATION_OVERLAY` window. The window is `FLAG_NOT_FOCUSABLE` +
`FLAG_NOT_TOUCH_MODAL` so it never steals input from the app underneath, and
drag-to-move lets the user flick it aside.

Because a `ComposeView` added straight to `WindowManager` has no Activity
behind it, `overlay/OverlayLifecycleOwner` supplies the three ViewTree owners
Compose demands (Lifecycle, ViewModelStore, SavedStateRegistry) — without
them Compose throws "ViewTreeLifecycleOwner not found".

The overlay never re-derives billable time. The spy publishes an
authoritative baseline to `MeterBus` every 5s (`activeSeconds` +
`runningSince`, null while idle); `MeterOverlay` runs its own 1s ticker and
interpolates from that baseline, snapping to truth on each publish — so the
digits punch every second with no drift and no double-counting. Euros and
hostage-% are computed on-device from the rate + anchor ladder cached from
each `/api/device/heartbeat` response (`overlay/MeterMath`, pure/testable).

Permission: `overlay/OverlayPermission` checks `canDrawOverlays` and bounces
to settings; on Android 15 the arming UI first shows the "Allow restricted
settings" warning for sideloaded installs (the toggle is hidden otherwise).
The spy only starts the overlay once the permission is held — which is also
the exemption that lets it start a foreground service from the background.

## Local dev networking

The debug build talks plain HTTP to a dev server, which Android blocks by
default on API 28+. `app/src/debug/` carries a **debug-only** network security
config (`res/xml/network_security_config.xml`, applied via
`src/debug/AndroidManifest.xml`) that permits cleartext for the debug APK
only — the release APK has no such exemption and stays HTTPS-only.

Reach the dev server one of two ways:

- **Emulator**: the default `API_BASE_URL` `http://10.0.2.2:3000/` already
  points at the host.
- **Physical device**: run `adb reverse tcp:3000 tcp:3000` and set
  `API_BASE_URL` to `http://127.0.0.1:3000/`, or leave it and point
  `API_BASE_URL` at your laptop's LAN IP. The debug config's `base-config`
  permits any host, so a LAN IP needs no further edit.

## Device auth

Every request carries an `x-device-secret` header (`net/Network.kt`
interceptor) whose value is a **per-device secret issued at runtime** — there
is no build-time shared secret (the old `DEVICE_API_SECRET` /
`costlyDeviceApiSecret` Gradle property is retired).

The flow:

1. The web dashboard shows a one-time OTP.
2. The user types it into the arming screen; `net/DeviceLinker` POSTs it to
   `/api/device/link` (the only call that carries no secret — the OTP in the
   body authorizes it).
3. The server returns `{deviceSecret, userId}`, stored in `Prefs` and held in
   `Network.deviceSecret`; the server keeps only a SHA-256 hash.
4. Every subsequent request sends that secret, and the backend's
   `requireDevice()` wrapper resolves it to the user — **the device never
   sends a `userId`**, so one device can't bill another user's card.

Backend enforcement is live (`web/src/lib/deviceAuth.ts`); a request with a
missing, unknown, or revoked secret gets a 401.

## Not wired yet

- Tap-to-expand on the bubble (session window remaining + "End session"
  button) — `performClick` is already routed; the expanded content is TODO.
