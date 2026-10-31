# Phase 2: Android Core Camera & WebRTC Sender - Research

**Researched:** 2026-10-30
**Domain:** Native Android CameraX & WebRTC Hardware Video Streaming
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full Android project source code is in `android/`.
- **D-02:** Built APK artifacts MUST be deposited into `/Users/parth/Downloads/Projects/Random/CCTV/APK/`.
- **D-03:** On-phone UI for setup and configuration (Server URL, Room ID, Camera selection, Torch toggle, and service switch).
- **D-04:** Built with CameraX for reliable hardware lifecycle abstraction.
- **D-05:** Native WebRTC media engine with hardware H.264/VP8 video encoding.
- **D-06:** On-demand streaming: video encodes and transmits only while an active viewer is watching.

### Claude's Discretion
- UI design styling (modern clean dark surveillance aesthetic).
- Internal WebRTC PeerConnection event listeners and reconnection exponential backoff.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera Sensor & Preview Capture | Android Client (`android/app`) | — | Native CameraX access to hardware sensors and lenses |
| Hardware Video & Audio Encoding | Android Client (`android/app`) | — | Uses Android MediaCodec for energy-efficient H.264/VP8 compression |
| Signaling WebSocket Client | Android Client (`android/app`) | Signaling Server (`server/`) | Exchanges SDP and ICE candidates via WebSockets |
| On-Demand Transmission Controller | Android Client (`android/app`) | — | Suspends video transmission when no remote viewers are present |
| Setup & Control UI | Android Client (`android/app`) | — | User interface on the phone to configure parameters |
</architectural_responsibility_map>

<research_summary>
## Summary

Running an Android smartphone as a 24/7 CCTV camera requires native access to camera hardware, hardware-accelerated video compression, and low-latency WebRTC media pipelines. Using Android's modern CameraX library simplifies camera selection (front vs. rear), torch flashlights, and resolution management while integrating smoothly with WebRTC's video tracks.

Because the device relies on cellular data, **On-Demand Streaming** is essential: the app maintains a lightweight WebSocket connection to the signaling server (using ~10 KB of data per hour in keepalives) and only initializes the video capturer and WebRTC media encoder when a viewer connects. When the viewer disconnects, media transmission immediately pauses, saving mobile data and preventing device overheating.

**Primary recommendation:** Build a clean native Android app using Kotlin, CameraX, and `stream-webrtc-android`, with automated Gradle build tasks that assemble the APK directly into `APK/`.
</research_summary>

<standard_stack>
## Standard Stack

### Core Android
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Android SDK | API 26 to 34 | Android Operating System | Supports Android 8.0 Oreo through Android 14+ |
| Kotlin | 1.9+ | Application Language | First-class Android development language |
| CameraX Core & Camera2 | `1.3.4` | Camera Sensor Control & Preview | Direct hardware encoder access, torch controls, and lifecycle handling |
| `io.getstream:stream-webrtc-android` | `1.2.2` | Native WebRTC Engine | Pre-compiled, modern, stable WebRTC binary distribution for Android |
| OkHttp | `4.12.0` | WebSocket Client | Resilient WebSocket connection to signaling server with automatic reconnection |

### Supporting UI
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Material Components | `1.12.0` | UI Design System | Dark mode cards, switches, text fields, and buttons |
| ConstraintLayout | `2.1.4` | Responsive Screen Layout | Clean UI layout on varying screen sizes |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Component Interaction Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       MainActivity                          │
│  - Settings UI (Server URL, Room ID, Lens selection)        │
│  - Camera Preview SurfaceView / TextureView                 │
│  - Status indicators (Connected / Streaming / Idle)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    CctvStreamManager                        │
│  - Manages WebRTC PeerConnectionFactory & PeerConnection     │
│  - Coordinates CameraCapturer & AudioRecord                 │
│  - Listens to SignalingClient events                        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│       CameraXManager        ││       SignalingClient        │
│  - Binds camera lifecycle   ││  - OkHttp WebSocket          │
│  - Controls torch & zoom    ││  - Handles join, offer,      │
│  - Supplies video frames    ││    answer, candidate         │
└─────────────────────────────┘└──────────────────────────────┘
```

### On-Demand State Machine

```
[Disconnected] ──(Start Service)──> [Signaling Connected (Idle)]
                                           │
                                     (Peer Joined)
                                           ▼
                                [WebRTC Streaming Active]
                                           │
                                      (Peer Left)
                                           ▼
                                [Signaling Connected (Idle)]
```
</architecture_patterns>

<validation_architecture>
## Validation Architecture

### Automated Verification
1. **Gradle Build Verification:**
   - Execute `./gradlew assembleDebug` inside `android/`.
   - Verify zero compilation errors and generated APK in `android/app/build/outputs/apk/debug/app-debug.apk`.
2. **APK Packaging & Export Verification:**
   - Verify copy task or script exports `APK/cctv-camera-debug.apk`.
   - Run `file APK/cctv-camera-debug.apk` to verify valid Zip/APK archive.
3. **Automated Unit Tests:**
   - Test signaling serialization, message envelope, and state transitions using JUnit 4/5.

### Test Commands
- **Build APK:** `cd android && ./gradlew assembleDebug && cp app/build/outputs/apk/debug/app-debug.apk ../APK/cctv-camera-debug.apk`
- **Verify APK exists:** `test -f APK/cctv-camera-debug.apk && ls -lh APK/cctv-camera-debug.apk`
</validation_architecture>

<sources>
## Sources
- Official Android CameraX Documentation (`androidx.camera`)
- Stream WebRTC Android GitHub (`GetStream/webrtc-android`)
- W3C WebRTC Specification
</sources>
