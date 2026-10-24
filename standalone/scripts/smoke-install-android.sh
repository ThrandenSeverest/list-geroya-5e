#!/usr/bin/env bash
# Check the actual APK file that will be uploaded, not a Gradle intermediate.
# The workflow must fail if the package installer rejects the APK.
set -euo pipefail
if [[ "${HEROLIST_ANDROID_BUILD:-}" == "release" ]]; then
  apk="release/android/HeroList-Android-Offline.apk"
  package="fun.superaistory.herolist"
else
  apk="release/android/HeroList-Android-Preview.apk"
  package="fun.superaistory.herolist.preview"
fi

test -s "$apk"
echo "Installing the published APK on Android emulator: $apk"
adb wait-for-device
adb shell getprop ro.build.version.release
# Never use -t here: we want to reject testOnly packages on normal installs.
adb install "$apk"
adb shell pm path "$package" | grep -F 'package:'
adb shell am start -W -n "$package/fun.superaistory.herolist.MainActivity"
sleep 3
if ! adb shell pidof "$package" >/dev/null; then
  echo "Application stopped immediately after launch."
  adb logcat -d -s AndroidRuntime:E PackageManager:E | tail -100
  exit 1
fi
echo "Install and first launch succeeded for $package."
