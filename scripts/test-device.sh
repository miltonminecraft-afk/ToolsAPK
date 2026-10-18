#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
result_dir="$project_root/device-results"
mkdir -p "$result_dir"
collect_results() {
  timeout 20s adb pull /sdcard/Android/data/nl.tools.app/files/screenshots "$result_dir/" || true
  timeout 20s adb logcat -d > "$result_dir/logcat.txt" || true
  timeout 20s adb shell dumpsys activity activities > "$result_dir/activities.txt" || true
}
trap collect_results EXIT
adb shell cmd overlay enable --user 0 com.android.internal.systemui.navbar.gestural
cd "$project_root/android"
./gradlew :app:connectedDebugAndroidTest --no-daemon
