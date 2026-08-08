#!/usr/bin/env bash
# Put a debug build on a USB-connected phone and grant everything adb can grant.
#
# Android 13+ blocks sideloaded apps from holding Usage Access and the overlay
# permission until the user digs through "Allow restricted settings", so on a
# test device we set the app-ops directly and skip the whole dance.
#
#   ./test-on-device.sh                 # permissions + relaunch + logs
#   ./test-on-device.sh path/to.apk     # install that APK first
#
# Health Connect is deliberately NOT granted here. It is a real consent flow and
# it should stay one.
set -euo pipefail

P=app.costly.companion
APK="${1:-}"

# -d targets the single USB device, so a running emulator does not collide.
D=(adb -d)

echo "==> devices"
adb devices -l

if [[ -n "$APK" ]]; then
  echo "==> installing $APK"
  "${D[@]}" install -r "$APK"
fi

if ! "${D[@]}" shell pm list packages | grep -q "$P"; then
  echo "!! $P is not installed on this device. Pass an APK path as the first argument." >&2
  exit 1
fi

echo "==> granting what adb can grant"
"${D[@]}" shell appops set "$P" android:get_usage_stats allow
"${D[@]}" shell appops set "$P" android:system_alert_window allow
"${D[@]}" shell pm grant "$P" android.permission.POST_NOTIFICATIONS || true
"${D[@]}" shell dumpsys deviceidle whitelist +"$P" >/dev/null

echo "==> verifying"
"${D[@]}" shell appops get "$P" android:get_usage_stats
"${D[@]}" shell appops get "$P" android:system_alert_window

echo "==> relaunching"
"${D[@]}" shell am force-stop "$P"
"${D[@]}" shell monkey -p "$P" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

cat <<'EOF'

==> now, on the phone:
      1. tap "Skip sign-in and test the meter"  (the gold GOD MODE box)
      2. confirm the gold "GOD MODE: local test only" banner is showing
      3. open Instagram and scroll

    without god mode AND without a linked account, no session starts and no
    overlay appears — that is by design, and the log below now says so.

==> streaming logs (ctrl-c to stop)
EOF

"${D[@]}" logcat -c
exec "${D[@]}" logcat -s CostlySpy:* CostlyOverlay:* CostlyHealth:* CostlyNet:* AndroidRuntime:E
