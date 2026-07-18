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
| Dead man's switch | `work/HeartbeatWorker.kt` | 12h `PeriodicWorkRequest` → `POST /api/device/heartbeat`; opportunistic expedited pings on launch/boot. |
| Sweat equity | `work/HealthSyncWorker.kt` | Read walking from Health Connect, POST cumulative minutes to the pending redemption task. |
| Wiring | `CostlyApp.kt`, `BootReceiver.kt`, `net/`, `notify/`, `Prefs.kt` | App init, reboot re-arm, Retrofit client + DTOs, taunt notifications, local state. |

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

## Not wired yet

- `DEVICE_API_SECRET` header on requests (backend `TODO(auth)` too) — the
  interceptor stub is in `net/Network.kt`.
- Live overlay bubble (the ticking meter over the vice app) — the backend
  returns everything it needs; this is the next native surface.
