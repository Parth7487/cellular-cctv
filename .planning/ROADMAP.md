# Roadmap: Cellular Android CCTV

## Overview

Transform a spare Android smartphone equipped with a SIM card into a complete, standalone CCTV home surveillance system. This roadmap guides the end-to-end implementation across five vertical MVP phases: establishing the cellular CGNAT-traversing signaling and relay backbone, building the Android CameraX WebRTC streaming engine, crafting the responsive web monitoring dashboard with remote hardware controls and two-way intercom, hardening the 24/7 background service with OLED thermal protection, and implementing autonomous motion detection with Telegram cloud alerts and remote deterrent sirens.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Signaling & Cellular CGNAT Relay** - Deploy lightweight WebSocket signaling hub with STUN/TURN relays for 4G/5G mobile traversal.
- [x] **Phase 2: Android Core Camera & WebRTC Sender** - Build Android CameraX video/audio capture with on-demand WebRTC transmission.
- [x] **Phase 3: Web Dashboard & Remote Controls** - Responsive browser viewer with two-way intercom, torch toggle, camera switcher, and zoom controls.
- [x] **Phase 4: 24/7 Reliability & Thermal Management** - Persistent Android foreground service, auto-boot recovery, and OLED black screen protector.
- [x] **Phase 5: Motion Detection, Siren & Telegram Alerts** - Real-time scene motion detection, automated clip capture, Telegram bot alerts, and siren deterrent.

## Phase Details

### Phase 1: Signaling & Cellular CGNAT Relay
**Goal**: Establish a reliable public rendezvous point with STUN and TURN relays to traverse cellular 4G/5G CGNAT without requiring a home Wi-Fi network.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: STREAM-02
**Success Criteria** (what must be TRUE):
  1. Node.js WebSocket signaling server accepts connections and brokers SDP offers/answers and ICE candidates securely between endpoints.
  2. STUN/TURN relay credentials successfully configure ICE agents and pass Trickle ICE tests across restrictive mobile 4G/5G connections.
  3. TURNS over TCP port 443 relay acts as a guaranteed fallback when mobile carriers restrict UDP traffic.
**Plans**: 2 plans

Plans:
- [x] 01-01: Implement Node.js WebSocket signaling server with room authentication and client session management.
- [x] 01-02: Configure dual-transport STUN/TURN relay integration (UDP 3478 + TURNS TCP 443) and build connectivity verification test suite.

### Phase 2: Android Core Camera & WebRTC Sender
**Goal**: Build the Android streaming sender using CameraX and WebRTC that captures video/audio and streams live on demand over cellular data.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: STREAM-01, STREAM-03
**Success Criteria** (what must be TRUE):
  1. Android app captures high-definition video frames and microphone audio with hardware acceleration.
  2. Android app connects to signaling server and negotiates WebRTC peer connection upon viewer connection.
  3. On-demand streaming pauses media encoding and network upload while no viewer is connected, preserving mobile SIM data.
**Plans**: 2 plans

Plans:
- [x] 02-01: Set up Android project with CameraX capture pipeline, audio input, and WebRTC streaming client library.
- [x] 02-02: Implement signaling client and on-demand stream controller to start/stop transmission based on viewer presence.

### Phase 3: Web Dashboard & Remote Controls
**Goal**: Deliver a responsive browser dashboard for viewing the live CCTV feed, two-way intercom, and controlling camera hardware remotely.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: VIEWER-01, VIEWER-02, VIEWER-03, VIEWER-04, VIEWER-05
**Success Criteria** (what must be TRUE):
  1. User can open the dashboard in desktop or mobile browsers to watch sub-second latency HD video with audio.
  2. Push-to-talk two-way intercom transmits browser microphone audio and plays it through the Android phone speaker.
  3. User can switch between front and rear cameras, toggle flashlight/torch, and adjust digital zoom remotely from the web dashboard.
**Plans**: 2 plans

Plans:
- [x] 03-01: Build responsive CCTV web viewer dashboard with WebRTC media playback and connection status indicators.
- [x] 03-02: Implement two-way push-to-talk intercom and remote hardware control command handlers (torch, camera switch, zoom).

### Phase 4: 24/7 Reliability & Thermal Management
**Goal**: Enable continuous unattended 24/7 operation without screen burn-in, battery overheating, or Android OS background kills.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: RELIABILITY-01, RELIABILITY-02, RELIABILITY-03
**Success Criteria** (what must be TRUE):
  1. App operates as a persistent Android Foreground Service with wake-lock, surviving Doze mode and memory pressure.
  2. OLED black screen overlay (`#000000`) dims the display completely while maintaining active camera capture and background streaming.
  3. App automatically starts up and reconnects to signaling after phone restart or unexpected power cycle.
**Plans**: 2 plans

Plans:
- [x] 04-01: Implement Android Foreground Service with persistent notification, partial wake-lock, and BOOT_COMPLETED receiver.
- [x] 04-02: Create OLED pure-black screen saver overlay and thermal management safeguards.

### Phase 5: Motion Detection, Siren & Telegram Alerts
**Goal**: Turn the phone into an active security device that detects motion, records event clips, dispatches instant Telegram alerts, and sounds alarm sirens.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: SECURITY-01, SECURITY-02, SECURITY-03, SECURITY-04, SECURITY-05
**Success Criteria** (what must be TRUE):
  1. Real-time frame differencing accurately identifies visual movement in the camera scene without excessive CPU load.
  2. System captures a high-resolution snapshot and encodes a 10-second compressed MP4 clip when motion is detected.
  3. Telegram bot delivers instant push notification with attached snapshot/video to the user's phone.
  4. User can trigger a loud alarm siren remotely from the dashboard or configure automatic siren sounding on motion.
**Plans**: 2 plans

Plans:
- [x] 05-01: Implement on-device camera frame motion detector with snapshot and 10-second MP4 clip recording.
- [x] 05-02: Implement Telegram Bot API alert dispatcher and remote/motion-triggered siren alarm playback.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Signaling & Cellular CGNAT Relay | 2/2 | Complete | 2026-10-30 |
| 2. Android Core Camera & WebRTC Sender | 2/2 | Complete | 2026-10-30 |
| 3. Web Dashboard & Remote Controls | 2/2 | Complete | 2026-10-30 |
| 4. 24/7 Reliability & Thermal Management | 2/2 | Complete | 2026-10-30 |
| 5. Motion Detection, Siren & Telegram Alerts | 2/2 | Complete | 2026-10-30 |
