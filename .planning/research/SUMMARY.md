# Project Research Summary

**Project:** Cellular Android CCTV
**Domain:** Cellular Android CCTV & WebRTC Surveillance
**Researched:** 2026-10-30
**Confidence:** HIGH

## Executive Summary

Repurposing an Android smartphone equipped with a SIM card into a standalone CCTV surveillance camera is a powerful, cost-effective security solution. Modern smartphones provide high-definition camera sensors, hardware H.264 video encoders, microphone and speaker hardware for two-way audio, and a built-in battery that acts as an integrated UPS in case of power failure.

Because the phone operates entirely on cellular mobile data (with no local Wi-Fi router), traditional LAN-based IP camera architectures fail. Cellular carriers use Carrier-Grade NAT (CGNAT) and Symmetric NAT, which prevent direct inbound connections. To solve this, the recommended architecture utilizes **WebRTC** with a dual STUN/TURN configuration. A lightweight signaling server negotiates connections, enabling direct, encrypted peer-to-peer streaming with sub-500ms latency, falling back to secure TURN relays (over TCP 443) when carrier firewalls block direct UDP.

To prevent mobile data exhaustion and battery thermal degradation in 24/7 plugged-in operation, the system employs **On-Demand streaming** (video is encoded and transmitted only when an authorized viewer is watching) and an **OLED Black Screen Mode** (dimming the display to 0% brightness while keeping camera and background services active). When motion is detected, the phone captures a short 10-second compressed incident clip or high-resolution photo and uploads it via the **Telegram Bot API**, delivering instant push alerts and free cloud clip storage.

## Key Findings

### Recommended Stack

- **Android Client**: Kotlin with CameraX (`androidx.camera:*`), `stream-webrtc-android`, and Android Foreground Service with WakeLock.
- **Signaling Server**: Node.js with WebSocket (`ws`), brokering SDP offer/answer exchange and remote hardware control commands.
- **NAT Traversal**: STUN + TURN relay (supporting UDP 3478 and TLS/TCP 443 via Coturn or Metered.ca) to guarantee cellular CGNAT traversal.
- **Web Dashboard**: Single-page modern responsive browser viewer featuring live video/audio, two-way intercom, and remote controls.
- **Cloud Alert Offloader**: Telegram Bot API for instant event push notifications and zero-cost cloud storage of motion clips.

### Expected Features

**Must have (table stakes):**
- Low-latency HD live video and audio streaming over cellular data.
- Remote camera controls: front/rear camera switch, flashlight/torch toggle (night vision), digital zoom.
- Two-way audio intercom (speak to room from browser, listen to room mic).
- OLED black screen saver mode to protect phone screen and thermals 24/7.
- Persistent background foreground service with boot auto-restart.
- On-device motion detection with instant photo snapshot / video clip upload to Telegram.
- Remote and motion-triggered alarm siren played through the phone speaker.

**Should have (competitive):**
- On-demand streaming mode (zero idle cellular data usage).
- Thermal & battery watchdog alerts.
- Local SD card rolling loop buffer.

**Defer (v2+):**
- On-device AI object classification (person vs pet vs vehicle).
- Multi-camera NVR dashboard aggregation.

### Architecture Approach

The architecture consists of three interconnected layers:
1. **The Android Sender**: Captures camera frames, runs frame differencing for motion detection, manages hardware controls (torch, siren, camera switch), and runs the WebRTC peer connection.
2. **The Cloud Signaling & Relay Hub**: A minimal Node.js WebSocket service and TURN relay hosted on a lightweight VPS or free cloud tier (Render/Railway/Fly.io), providing public rendezvous for cellular devices.
3. **The Web Viewer Dashboard**: A clean web app where the owner monitors the live feed, initiates push-to-talk two-way intercom, triggers the siren, and toggles hardware options.

### Critical Pitfalls

1. **Cellular CGNAT Black Hole**: Avoid STUN-only WebRTC setups; always configure TURN with TCP port 443 fallback for 100% cellular reliability.
2. **Battery Swelling & Heat in 24/7 Operation**: Always turn the screen black (OLED off) and use on-demand encoding so the phone runs cool.
3. **Android OS Background Kills**: Run as an explicit Foreground Service with persistent notification and partial wake-lock.
4. **Cellular Data Depletion**: Never stream 24/7 continuous uncompressed video; stream only when viewing, and upload only short motion clips to Telegram.

## Implications for Roadmap

Based on research findings, the suggested phase structure:

### Phase 1: Signaling Server & Network Relay Foundation
**Rationale:** The network backbone (WebSocket signaling + TURN relay) is the prerequisite for cellular CGNAT traversal.
**Delivers:** Working Node.js signaling server with STUN/TURN credentials and connection verification tests.
**Avoids:** CGNAT connection failures before touching Android code.

### Phase 2: Android Core & CameraX WebRTC Sender
**Rationale:** Captures live camera video and establishes real-time WebRTC media tracks.
**Delivers:** Android app module with CameraX integration, hardware torch toggle, front/rear switch, and WebRTC streaming client.
**Uses:** `androidx.camera` and `stream-webrtc-android`.

### Phase 3: Web Viewer Dashboard & Remote Controls
**Rationale:** The user needs an intuitive web interface to view the camera feed, talk back, and send remote commands.
**Delivers:** Responsive browser dashboard with live video/audio playback, two-way push-to-talk intercom, and hardware control buttons (torch, zoom, camera switch, siren).

### Phase 4: 24/7 Reliability & Thermal / Power Management
**Rationale:** The phone must run unattended 24/7 without burning the screen or being killed by Android battery optimization.
**Delivers:** Android Foreground Service, boot auto-start receiver, OLED pure-black screen overlay, and on-demand streaming power saver.
**Avoids:** Battery swelling, screen burn-in, and OS task termination.

### Phase 5: Motion Detection, Siren Deterrent & Telegram Cloud Alerts
**Rationale:** Adds autonomous surveillance capabilities so the user is instantly alerted when activity is detected.
**Delivers:** On-device frame motion detection, automatic 10-second clip recording, instant Telegram bot photo/video push alerts, and remote/motion siren alarm.

---
*Synthesized on: 2026-10-30*
