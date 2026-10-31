---
phase: 2
slug: android-core-camera-webrtc-sender
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for Android camera streaming and APK generation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Gradle 8.x / Android Gradle Plugin / JUnit |
| **Config file** | `android/build.gradle` & `android/app/build.gradle` |
| **Quick run command** | `cd android && ./gradlew testDebugUnitTest` |
| **Full suite / APK build** | `cd android && ./gradlew assembleDebug && cp app/build/outputs/apk/debug/app-debug.apk ../APK/cctv-camera-debug.apk` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After task commit:** Run `./gradlew compileDebugSources` or unit tests
- **After plan wave:** Run full APK build and verify artifact in `APK/`
- **Before `/gsd-verify-work`:** `APK/cctv-camera-debug.apk` must exist and be non-empty

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STREAM-01 | — | Scaffolds Android project with CameraX and WebRTC | integration | `test -f android/app/build.gradle && test -f android/settings.gradle` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | STREAM-01 | — | Implements CameraX manager & UI setup view | unit | `cd android && ./gradlew compileDebugSources` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | STREAM-01, STREAM-03 | — | Implements WebRTC peer connection & signaling client | unit | `cd android && ./gradlew testDebugUnitTest` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | STREAM-01, STREAM-03 | — | Compiles debug APK and copies to CCTV/APK directory | e2e | `test -f APK/cctv-camera-debug.apk && ls -lh APK/cctv-camera-debug.apk` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `android/build.gradle` — Root project Gradle script
- [ ] `android/settings.gradle` — Subproject inclusion
- [ ] `android/app/build.gradle` — App module dependencies (CameraX, WebRTC, OkHttp)
- [ ] `android/gradlew` — Gradle wrapper executable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real hardware camera preview on phone | STREAM-01 | Requires installing on physical dummy phone | Transfer `APK/cctv-camera-debug.apk` via USB/adb to Android phone and launch app |

---

## Validation Sign-Off

- [x] All tasks have automated build and verify commands
- [x] Wave 0 dependencies documented
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-10-30
