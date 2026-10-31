# Architecture Research

**Domain:** Cellular Android CCTV & WebRTC Surveillance
**Researched:** 2026-10-30
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Viewer Tier (Web Dashboard)                     │
│  - Modern responsive UI (Video viewport, PTZ/Hardware controls)        │
│  - WebRTC PeerConnection (Receives Video/Audio, Sends Mic Audio)       │
│  - WebSocket Client (Sends control commands: Torch, Siren, Camera)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebRTC Media (RTP/SRTP via UDP/TCP)
                                    │ Signaling & Remote Controls
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Cloud / Relay Tier (Zero Inbound Server)            │
│  ┌─────────────────────────────────┐ ┌───────────────────────────────┐ │
│  │   Lightweight Signaling Server  │ │   STUN / TURN Relay Server    │ │
│  │  - Node.js WebSocket Hub        │ │  - Handles Symmetric NAT /   │ │
│  │  - Room / Device Authentication │ │    Cellular Carrier CGNAT     │ │
│  │  - Command Relay                │ │  - UDP 3478 & TURNS TCP 443   │ │
│  └─────────────────────────────────┘ └───────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebRTC Stream & Commands
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Sender Tier (Android Smartphone)                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Android App Foreground Service (CameraX + WebRTC Engine)         │  │
│  │  - Hardware Camera Capture (Back/Front, Flashlight/Torch)        │  │
│  │  - Motion Detection Analyzer (Frame differencing on YUV)         │  │
│  │  - Two-Way Audio Sink (Speaker playback) & Source (Mic capture)  │  │
│  │  - Siren Audio Player (Loud deterrent)                           │  │
│  │  - OLED Black Screen Display (Prevents burn-in & heat)           │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │ Cloud Clip Upload (HTTPS)         │
│                                    ▼                                   │
│                     Telegram Bot API / Cloud Storage                   │
│                     - Instant Push Notification with photo/clip        │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Android CCTV Service | Captures camera video/audio, runs background service with wake-lock, handles motion analysis and WebRTC encoding | Kotlin Foreground Service using CameraX and `stream-webrtc-android` |
| Signaling Server | Brokering SDP offers/answers, ICE candidate exchange, and real-time command routing between phone and viewer | Node.js WebSocket server (`ws`) deployable locally or free cloud host |
| STUN/TURN Relay | Traverses cellular carrier Carrier-Grade NAT (CGNAT) so browser and phone can exchange media packets | Free Metered.ca TURN API or open-source Coturn server |
| Web Dashboard | Provides live viewer interface, two-way intercom push-to-talk, hardware switch toggles (torch/siren/camera switch) | Clean, single-page responsive web dashboard |
| Alert Dispatcher | Uploads motion-triggered snapshots and MP4 clips to Telegram bot and notifies user | OkHttp multipart upload to `api.telegram.org` |

## Recommended Project Structure

```
cctv/
├── .planning/                  # Project memory, specs, and roadmaps
├── android/                    # Android application codebase
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/cctv/android/
│   │   │   │   ├── camera/     # CameraX manager, torch controller, lens switcher
│   │   │   │   ├── webrtc/     # PeerConnection manager, ICE handler, audio track
│   │   │   │   ├── motion/     # Frame analyzer for motion detection & clip recording
│   │   │   │   ├── alerts/     # Telegram bot uploader & alert dispatcher
│   │   │   │   ├── service/    # Android Foreground service & watchdog
│   │   │   │   └── ui/         # OLED black overlay & setup configuration screen
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle
│   └── build.gradle
├── server/                     # Lightweight signaling & control relay
│   ├── src/
│   │   ├── signaling.js        # WebSocket room management and SDP/ICE routing
│   │   └── config.js           # STUN/TURN credentials & environment settings
│   ├── package.json
│   └── Dockerfile
└── web/                        # Responsive browser dashboard
    ├── index.html              # Modern viewer UI
    ├── css/
    │   └── style.css           # Clean dark-mode CCTV surveillance theme
    └── js/
        ├── app.js              # Dashboard UI & command triggers
        └── webrtc-viewer.js    # WebRTC client, audio intercom & stream receiver
```

## Architectural Patterns

### Pattern 1: On-Demand Streaming over Mobile Data

**What:** The Android phone only activates WebRTC video encoding and network transmission when an active viewer connects to the signaling room.
**When to use:** Crucial for cellular SIM setups to prevent burning through mobile data limits while running 24/7.
**Trade-offs:** 1-2 second spin-up latency when opening the viewer, but saves 99% of idle mobile data.

### Pattern 2: Dual-Candidate STUN/TURN Traversal

**What:** Configure ICE servers with Google STUN for fast direct hole-punching, paired with TURNS over TCP port 443 as a fallback.
**When to use:** Always for cellular networks, where carrier CGNAT frequently blocks direct UDP packets.
**Trade-offs:** Minimal relay bandwidth used only if direct P2P is blocked by carrier firewalls.

### Pattern 3: OLED Screen Offsaver Overlay

**What:** When monitoring is active, the Android app renders a pure `#000000` view with screen brightness dimmed to minimum, maintaining full camera sensor operation without screen burn-in or battery thermal runaway.

---
*Architecture research for: Cellular Android CCTV*
*Researched: 2026-10-30*
