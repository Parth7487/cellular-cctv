# Phase 2: Android Core Camera & WebRTC Sender - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 builds the native Android application that turns the spare smartphone into an active CCTV camera sender. It establishes the CameraX capture pipeline (video & audio), integrates the native WebRTC media engine, connects to the Phase 1 signaling server, provides an on-phone UI for setup and monitoring, and automatically outputs a compiled APK into `/Users/parth/Downloads/Projects/Random/CCTV/APK/`.
</domain>

<decisions>
## Implementation Decisions

### Project Location & APK Distribution
- **D-01:** Full Android project source code is housed in `android/` with standard Gradle build configuration.
- **D-02:** Built APK artifacts MUST be placed in `/Users/parth/Downloads/Projects/Random/CCTV/APK/` (e.g., `app-release.apk` / `app-debug.apk`) for easy sideloading onto the user's dummy phone.

### On-Phone UI & Configuration
- **D-03:** Modern dark-themed setup screen allowing the user to configure:
  - Signaling Server URL (defaults to online Render deployment or custom URL like `wss://...` / `ws://...`)
  - CCTV Room ID (e.g., `living-room`)
  - Camera selection (Back / Front lens)
  - Torch / Flashlight test toggle
  - Live local camera preview with quick "Start CCTV Service" toggle

### Media & Cellular WebRTC Streaming
- **D-04:** Built with CameraX (`androidx.camera:camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`) for rock-solid camera hardware lifecycle handling.
- **D-05:** Uses `io.getstream:stream-webrtc-android:1.2.2` (or WebRTC Android native) with hardware H.264/VP8 video encoder.
- **D-06:** Implements **On-Demand Streaming (STREAM-03)**:
  - Phone stays connected to WebSocket signaling server in idle listening mode.
  - Camera video track encoding and WebRTC transmission activate ONLY when a viewer joins the room.
  - Automatically suspends video transmission when all viewers leave, conserving cellular SIM data allowances and device thermals.

### Discretion
- Code architecture (MVVM / clean architecture) and Gradle build scripts chosen for maximum stability and speed.
</decisions>

<specifics>
## Specific Ideas
- User instruction: "we will build an APK `/Users/parth/Downloads/Projects/Random/CCTV/APK` and UI Which will be installed in my dummy phone which will be connected to supabase or render online so i can stream it whenever i want".
</specifics>

<canonical_refs>
## Canonical References
- `.planning/PROJECT.md` — Project core value and constraints
- `.planning/REQUIREMENTS.md` — STREAM-01 and STREAM-03
- `.planning/phases/01-signaling-cellular-cgnat-relay/01-01-SUMMARY.md` — Signaling server protocol & envelope
- `.planning/phases/01-signaling-cellular-cgnat-relay/01-02-SUMMARY.md` — STUN/TURN ICE config
</canonical_refs>
