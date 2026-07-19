# Costly — Android companion

Kotlin · Jetpack Compose · WorkManager · AccessibilityService · Health
Connect · Retrofit/OkHttp. minSdk 26, targetSdk 35.

This app is the spy and the dead man's switch. It has no data of its own
beyond a `userId` (pasted from the web dashboard) — everything it learns
it POSTs to the live Next.js API.

## What each piece does

| Component | File | Job |
| --- | --- | --- |
| Arming UI | `ui/MainActivity.kt` | Bind a `userId`, walk the 3 permissions (Accessibility, Health Connect, battery exemption), manual "Sync my walk". |
| The Spy | `spy/CostlyAccessibilityService.kt` | Detect foregrounded vice apps, run the idle-aware billable timer, POST session start/heartbeat/end. |
| Dead man's switch | `work/HeartbeatWorker.kt` | 12h `PeriodicWorkRequest` → `POST /api/device/heartbeat`; opportunistic expedited pings on launch/boot; caches the meter config from the response. |
| Sweat equity | `work/HealthSyncWorker.kt` | Read walking from Health Connect, POST cumulative minutes to the pending redemption task. |
| Live meter overlay | `overlay/CostlyOverlayService.kt`, `overlay/MeterOverlay.kt` | Foreground service hosting a Compose bubble in a `WindowManager` window; per-second punch-clock ticker. |
| Meter bus | `spy/MeterState.kt` | In-process `StateFlow` the spy publishes and the overlay observes — one source of truth, no double-counting. |
| Wiring | `CostlyApp.kt`, `BootReceiver.kt`, `net/`, `notify/`, `Prefs.kt` | App init, reboot re-arm, Retrofit client + DTOs, taunt notifications, local state + cached meter config. |

## How the spy bills (session lifecycle)

```
TYPE_WINDOW_STATE_CHANGED → blocked pkg foregrounded
  POST /api/sessions/start → sessionId (persisted in Prefs, survives rebind)
  ticker: +5s billable time, but ONLY while last scroll < 60s ago (idle pause)
  TYPE_VIEW_SCROLLED resets the idle clock
  every ~30s → POST /sessions/:id/heartbeat {activeSecondsDelta, scrolledSinceLast}
      response.taunts   → fire "Thank you for buying us [item]" notification
      response.capReached → force HOME + end session
TYPE_WINDOW_STATE_CHANGED → non-blocked pkg (3s debounce absorbs keyboards/dialogs)
  flush final delta, POST /sessions/:id/end  ← the Stripe moment
```

Session state is guarded by a `Mutex` and the server `sessionId` is
persisted, so a system kill/rebind of the service resumes rather than
orphaning an ACTIVE session (the backend also returns the existing ACTIVE
session from `/start`).

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
adb install app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:3000 tcp:3000           # or set API_BASE_URL to your LAN/deploy
```

`API_BASE_URL` is a `buildConfigField` in `app/build.gradle.kts` — debug
defaults to `http://10.0.2.2:3000/` (emulator → host). Set the release
URL before shipping an APK.

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
interceptor) whose value is the `DEVICE_API_SECRET` build config field,
sourced from the `costlyDeviceApiSecret` Gradle property (set it in
`~/.gradle/gradle.properties` or pass `-PcostlyDeviceApiSecret=…`; defaults
to `change-me`, matching `web/.env.example`). The backend routes still carry
`TODO(auth)` and don't verify it yet — the header is forward-compatible: it
must match the web `DEVICE_API_SECRET` env var the moment those checks land.

## Not wired yet

- Backend enforcement of the `x-device-secret` header — the app already
  sends it; the Next.js routes still `TODO(auth)` the verification.
- Tap-to-expand on the bubble (session window remaining + "End session"
  button) — `performClick` is already routed; the expanded content is TODO.
