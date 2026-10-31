# Cellular Android CCTV

## What This Is

A smart CCTV surveillance system that repurposes a spare Android smartphone equipped with a SIM card (cellular data) into a dedicated home security camera. It enables remote live viewing, two-way audio, motion recording, and hardware control from any browser or phone over the internet without requiring a home Wi-Fi network.

## Core Value

Reliable, low-latency remote video surveillance and security controls over cellular data (CGNAT) without requiring home Wi-Fi or paid subscription cloud locks.

## Requirements

### Validated

- ✓ WebRTC P2P live streaming engine capable of traversing mobile carrier CGNAT via STUN/TURN signaling — Phase 1

### Active

- [ ] Responsive browser-based viewer dashboard for live HD video and two-way audio (intercom)
- [ ] Cellular data optimizer: on-demand stream transmission (bandwidth consumed only while actively viewing)
- [ ] Motion detection engine with automated clip capture and snapshot generation
- [ ] Cloud backup integration (Google Drive / Telegram Bot) for automated motion clip offloading and local SD card storage
- [ ] Remote hardware control: front/rear camera switching, flashlight/torch toggle (night vision), and digital zoom
- [ ] Remote & motion-triggered alarm siren playback through the phone speaker
- [ ] 24/7 thermal and battery safety guards: OLED black screen overlay, screen lock prevention, and background service watchdog
- [ ] Customizable open-source Android client application paired with a modern web dashboard

### Out of Scope

- 24/7 continuous uncompressed cloud streaming — would exhaust monthly cellular mobile data quotas; on-demand live viewing and motion clip cloud backup are used instead.
- Proprietary subscription lock-in (e.g., Ring, Nest, Alfred premium tiers) — completely open-source, user-owned stack.
- Local Wi-Fi router dependency — must operate fully autonomously over a 4G/5G SIM card.

## Context

- **Hardware**: Spare Android phone plugged into continuous wall power, dedicated as a fixed security camera.
- **Network Environment**: No home broadband or Wi-Fi router; connectivity relies entirely on a mobile SIM card with Carrier-Grade NAT (CGNAT), where inbound port forwarding is impossible.
- **Access Pattern**: Remote monitoring from viewer's phone or computer from anywhere via browser, utilizing WebRTC peer-to-peer signaling or secure mesh tunnel.
- **Hardware Longevity**: Running camera sensors and processors 24/7 generates heat; screen must be powered down or display pure black (OLED saving) while background camera service runs uninterrupted.

## Constraints

- **Network**: Cellular data with CGNAT — requires STUN/TURN or P2P signaling server to negotiate direct peer connections without public IP.
- **Data Usage**: Mobile data bandwidth must be preserved; streaming should only activate when a remote client connects.
- **Thermal & Battery**: 24/7 operation requires minimizing screen backlight energy and CPU encoding overhead to prevent device overheating.
- **Android OS Restrictions**: Background service must be robust against aggressive OS battery management and memory kills (foreground service with persistent notification).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebRTC P2P Streaming | Works across cellular carrier CGNAT, provides sub-500ms latency, and consumes cellular data only when actively viewing | ✓ Good |
| Cloud Offload for Motion Clips (Telegram/GDrive) | Saves mobile data by uploading only triggered incident clips rather than continuous video streams | — Pending |
| Customizable Open-Source Android Base | Allows tailored control over camera features, OLED saver, siren, and web interface | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-30 after initialization*
