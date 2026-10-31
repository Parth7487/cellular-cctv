#!/usr/bin/env bash
set -euo pipefail

# Build script for Cellular Android CCTV APK
# Exports installable APK to CCTV/APK/cctv-camera-debug.apk

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
APK_OUTPUT_DIR="$PROJECT_ROOT/APK"
DEST_APK="$APK_OUTPUT_DIR/cctv-camera-debug.apk"

# Detect Java 17 location
if [ -d "/Users/parth/.local/jdks/jdk-17.0.21+9/Contents/Home" ]; then
    export JAVA_HOME="/Users/parth/.local/jdks/jdk-17.0.21+9/Contents/Home"
fi

echo "================================================="
echo " Building Cellular Android CCTV APK"
echo " Java Home: ${JAVA_HOME:-default}"
echo " Project Directory: $ANDROID_DIR"
echo "================================================="

cd "$ANDROID_DIR"

# Build debug APK
./gradlew assembleDebug --no-daemon

# Locate output APK
BUILT_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "$BUILT_APK" ]; then
    echo "ERROR: Built APK not found at $BUILT_APK"
    exit 1
fi

mkdir -p "$APK_OUTPUT_DIR"
cp "$BUILT_APK" "$DEST_APK"

echo "================================================="
echo " Build Succeeded!"
echo " Exported APK: $DEST_APK"
ls -lh "$DEST_APK"
echo "================================================="
