# Feature Research

**Domain:** Cellular Android CCTV & Security
**Researched:** 2026-10-30
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Low-latency Live Video Streaming | Core purpose of a CCTV camera | MEDIUM | Must work across cellular 4G/5G CGNAT with sub-second delay |
| Remote Camera Hardware Controls | Adjust camera view when installed in a fixed spot | LOW | Toggle front vs. rear camera, remote flashlight/torch for night vision, digital zoom |
| Two-Way Audio (Intercom) | Speak to people near the camera or listen to room audio | MEDIUM | Uses WebRTC bidirectional audio stream with acoustic echo cancellation |
| Motion Detection & Alerts | CCTV cameras must alert owner when intruder enters | MEDIUM | Lightweight on-device pixel delta analysis to trigger immediate alert |
| Cloud Clip Backup | Remote proof of incident even if phone is stolen/damaged | MEDIUM | Upload 10s video clip or photo snapshot to Telegram bot / cloud storage |
| Low Power / Black Screen Mode | Prevents screen burn-in and phone overheating running 24/7 | LOW | OLED full-black overlay keeps camera sensor active while display pixels emit 0 light |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Siren / Alarm Sound Trigger | Deter intruders immediately from the viewer dashboard | LOW | Play high-decibel alarm audio through the phone speaker on demand or on motion |
| On-Demand Cellular Bandwidth Saver | Conserves mobile data allowances when no one is watching | MEDIUM | Video encoding and network transmission pause when no viewer is connected |
| Thermal & Battery Health Watchdog | Protects device longevity plugged into wall power 24/7 | MEDIUM | Monitors battery temperature, limits frame rates if phone gets hot, auto-recovers |
| Telegram Bot Integration | No need to install another viewer app for notifications | LOW | Telegram push notifications with preview gif/photo and direct link to live viewer |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Continuous 24/7 Cloud Recording | Desired by some traditional NVR users | Burns 100+ GB of mobile data monthly, overheats cellular modem, triggers cloud storage fees | On-demand live viewing + motion-triggered cloud clip uploads |
| Local Inbound HTTP Server | Easy to build on local Wi-Fi | Completely inaccessible on cellular data because mobile carriers block all inbound ports (CGNAT) | WebRTC with TURN relay or WebSocket signaling |
| Heavy Cloud AI Processing | People want object classification | High ongoing API costs and excessive upload bandwidth | Lightweight on-device motion/frame differencing |

## Feature Dependencies

```
[WebRTC Streaming Engine]
    └──requires──> [Signaling Server & STUN/TURN Relay]
                        └──requires──> [Network Connection (Cellular SIM)]

[Two-Way Intercom] ──enhances──> [WebRTC Streaming Engine]
[Remote Controls (Flash/Camera)] ──enhances──> [WebRTC Streaming Engine]
[Motion Detection] ──triggers──> [Cloud Clip Backup] & [Siren Alarm]
[OLED Black Screen] ──protects──> [Phone Hardware (24/7 Run)]
```

## MVP Definition

### Launch With (v1)

- [ ] WebRTC live video & audio streaming between Android phone and browser dashboard
- [ ] Signaling server with STUN/TURN integration for 4G/5G cellular CGNAT traversal
- [ ] Remote camera hardware controls (rear/front toggle, torch/flashlight toggle, digital zoom)
- [ ] Two-way audio communication (browser mic to phone speaker)
- [ ] Remote siren/alarm audio trigger
- [ ] OLED black screen mode and persistent Android foreground service
- [ ] Motion detection engine with automated snapshot / clip upload to Telegram Bot

### Add After Validation (v1.x)

- [ ] Local SD card rolling buffer recording
- [ ] Battery temperature safety warnings and adaptive bitrate reduction
- [ ] Multi-viewer support with password authentication

### Future Consideration (v2+)

- [ ] On-device AI object detection (Person / Vehicle / Pet filtering via MediaPipe)
- [ ] Home Assistant / Frigate integration via WebRTC bridge

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| WebRTC Cellular Streaming | HIGH | MEDIUM | P1 |
| STUN/TURN NAT Traversal | HIGH | LOW | P1 |
| Remote Camera Controls & Torch | HIGH | LOW | P1 |
| Two-Way Audio Intercom | HIGH | MEDIUM | P1 |
| OLED Saver & 24/7 Background Service | HIGH | LOW | P1 |
| Motion Detection & Telegram Alerts | HIGH | MEDIUM | P1 |
| Remote Siren Trigger | MEDIUM | LOW | P1 |
| Local SD Card Loop Recording | MEDIUM | MEDIUM | P2 |
| Advanced AI Person Filtering | LOW | HIGH | P3 |

---
*Feature research for: Cellular Android CCTV*
*Researched: 2026-10-30*
