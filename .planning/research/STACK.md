# Stack Research

**Domain:** Cellular Android CCTV & WebRTC Surveillance
**Researched:** 2026-10-30
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Android SDK / Kotlin | Android API 26+ (8.0 Oreo to 14+) | Android Camera & Service Host | Native Android Camera2 / CameraX API provides direct hardware encoder access, flash controls, and foreground service lifecycle |
| WebRTC (Android & Web) | `io.getstream:stream-webrtc-android:1.2.2` / WebRTC Native | Low-latency P2P Media Streaming | Sub-second latency, built-in echo cancellation for 2-way audio, and ICE NAT hole punching |
| Coturn / Metered TURN Relay | TURN / TURNS (TCP 443 / UDP 3478) | Cellular NAT Traversal | Solves Carrier-Grade NAT (CGNAT) and Symmetric NAT across mobile 4G/5G carriers |
| Node.js / WebSocket Signaling Server | Node.js 20+ LTS / ws | WebRTC Handshake & Remote Control | Ultra-lightweight signaling server for SDP offer/answer exchange, ICE candidate routing, and remote hardware commands |
| Modern Web Dashboard (Vanilla HTML/CSS/JS) | Native ES Modules | Viewer Interface | Zero-bloat, responsive, mobile and desktop compatible browser dashboard for live monitoring and controls |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CameraX (`androidx.camera:*`) | 1.3+ | Camera Sensor & Lifecycle Management | Clean abstraction for frame analysis (motion detection), torch toggle, and video capture |
| Telegram Bot API | HTTPS REST | Instant Alert & Video Clip Offloading | Free unlimited cloud clip/photo storage with push notifications sent directly to user's daily messenger |
| OkHttp | 4.12+ | HTTP Client on Android | Fast multipart upload for Telegram clip offloading and signaling REST endpoints |
| OpenCV / Image Difference | Light YUV analysis | On-device Motion Detection | Extremely low CPU frame-differencing without heating up the phone |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Android Studio / Gradle | Android app build & APK packaging | Standard Android toolchain |
| Docker / Node runtime | Signaling & Web Dashboard hosting | Deployable locally, on free-tier Render/Fly.io/Railway, or lightweight VPS |
| Trickle ICE Test Tool | WebRTC connectivity verification | Validates STUN/TURN traversal over cellular network before app deployment |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WebRTC P2P + TURN | RTSP / RTMP Streaming Server | When streaming to a dedicated 24/7 NVR hardware box (Frigate/BlueIris), but requires massive continuous upload bandwidth |
| Telegram Bot API Storage | Google Drive API | When strictly organized folder hierarchy is needed, though Google Drive requires OAuth refresh token complexity |
| Native CameraX / Kotlin | Flutter / React Native | When writing a cross-platform mobile sender, but Kotlin yields lower memory overhead and superior foreground service stability |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| MJPEG HTTP streaming over mobile IP | Inefficient bandwidth, blocked by mobile carriers behind CGNAT with no public IP | WebRTC with H.264/VP8 hardware acceleration |
| Continuous 24/7 Cloud Video Upload | Burns mobile data allowances (gigabytes daily) and overheats phone | On-demand streaming (only streams when viewing) + Motion-triggered clip uploads |
| STUN-only WebRTC config | 4G/5G mobile carriers use Symmetric CGNAT; P2P direct connects will fail ~80% of the time without TURN relay | STUN + TURN (over UDP and TCP port 443) |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `androidx.camera:camera-core:1.3.x` | Android API 26+ | Fully supports hardware torch and image analysis |
| `io.getstream:stream-webrtc-android:1.2.2` | Android API 24+ | Maintained WebRTC Android binary distribution |

## Sources

- Official Android CameraX Documentation
- WebRTC W3C Specification & RFC 8489 (STUN) / RFC 8656 (TURN)
- Telegram Bot API Documentation: `sendPhoto` and `sendVideo`

---
*Stack research for: Cellular Android CCTV & WebRTC Surveillance*
*Researched: 2026-10-30*
