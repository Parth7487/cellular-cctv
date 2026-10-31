# Requirements: Cellular Android CCTV

**Defined:** 2026-10-30
**Core Value:** Reliable, low-latency remote video surveillance and security controls over cellular data (CGNAT) without requiring home Wi-Fi or paid subscription cloud locks.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Streaming & Cellular Networking (STREAM)

- [ ] **STREAM-01**: User can stream live video and audio from the Android phone to a web browser dashboard with sub-second latency.
- [x] **STREAM-02**: System establishes encrypted WebRTC media connections across cellular carrier CGNAT using STUN and TURN relays (supporting UDP 3478 and TCP 443).
- [ ] **STREAM-03**: System transmits camera media on-demand (encoding and sending video only when an active viewer connects) to preserve cellular data.

### Web Dashboard & Remote Controls (VIEWER)

- [ ] **VIEWER-01**: User can view the live CCTV video stream and audio feed via a responsive modern web dashboard accessible from any browser.
- [ ] **VIEWER-02**: User can speak into the browser microphone to broadcast two-way audio (intercom) through the phone's speaker.
- [ ] **VIEWER-03**: User can toggle between the rear and front camera sensors remotely from the web interface.
- [ ] **VIEWER-04**: User can remotely switch the phone's hardware flashlight/torch on or off for night-time visibility.
- [ ] **VIEWER-05**: User can control digital zoom in and zoom out directly from the web dashboard.

### Security, Motion Detection & Alerts (SECURITY)

- [ ] **SECURITY-01**: Android app analyzes camera frames in real time to detect physical motion within the scene.
- [ ] **SECURITY-02**: System automatically records a 10-second compressed video clip and captures a high-resolution snapshot when motion occurs.
- [ ] **SECURITY-03**: System offloads motion snapshots and video clips via the Telegram Bot API with instant push notifications.
- [ ] **SECURITY-04**: User can trigger a loud alarm siren sound through the phone speaker on-demand from the web dashboard.
- [ ] **SECURITY-05**: User can toggle auto-siren activation on motion detection to deter intruders.

### 24/7 Reliability & Device Protection (RELIABILITY)

- [ ] **RELIABILITY-01**: Android app operates as an unkillable Foreground Service with persistent status notification and wake-lock to survive OS background kills.
- [ ] **RELIABILITY-02**: User can activate an OLED pure-black screen saver overlay (`#000000`) that dims the display to 0% brightness while keeping camera capture running 24/7.
- [ ] **RELIABILITY-03**: Android app automatically resumes the CCTV service upon phone reboot or power restoration.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Local & Edge AI (FUTURE)

- **LOCAL-01**: Continuous rolling loop recording to phone internal storage or micro-SD card.
- **AI-01**: On-device AI object filtering (distinguish person vs pet vs shadows using MediaPipe).
- **MULTI-01**: Multi-camera grid viewer to monitor multiple spare phones from a single dashboard.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Continuous 24/7 Uncompressed Cloud Video Recording | Burns hundreds of gigabytes of cellular mobile data monthly and creates expensive cloud hosting bills; event/motion clip cloud uploads used instead. |
| Proprietary Subscription Cloud Ecosystems | Avoids vendor lock-in; system is 100% self-hosted and user-owned. |
| Requiring Fixed Home Broadband / Wi-Fi Router | System is purpose-built to operate autonomously over a cellular 4G/5G SIM card. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STREAM-01 | Phase 2 | Pending |
| STREAM-02 | Phase 1 | Completed |
| STREAM-03 | Phase 2 | Pending |
| VIEWER-01 | Phase 3 | Pending |
| VIEWER-02 | Phase 3 | Pending |
| VIEWER-03 | Phase 3 | Pending |
| VIEWER-04 | Phase 3 | Pending |
| VIEWER-05 | Phase 3 | Pending |
| SECURITY-01 | Phase 5 | Pending |
| SECURITY-02 | Phase 5 | Pending |
| SECURITY-03 | Phase 5 | Pending |
| SECURITY-04 | Phase 5 | Pending |
| SECURITY-05 | Phase 5 | Pending |
| RELIABILITY-01 | Phase 4 | Pending |
| RELIABILITY-02 | Phase 4 | Pending |
| RELIABILITY-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-10-30*
*Last updated: 2026-10-30 after initialization*
