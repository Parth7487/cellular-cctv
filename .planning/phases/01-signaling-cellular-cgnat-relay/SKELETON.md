# Walking Skeleton — Cellular Android CCTV

**Phase:** 1
**Generated:** 2026-10-30

## Capability Proven End-to-End

> The smallest verifiable capability that exercises the foundational stack:
"A client connects to the Node.js WebSocket signaling server over the network, joins an authenticated room, exchanges simulated WebRTC SDP offer/answer messages, and receives valid STUN/TURN ICE configurations for cellular CGNAT traversal."

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Project Structure | Monorepo inside `/Users/parth/Downloads/Projects/Random/CCTV` | Ensures all assets (server, android, web) are co-located in the user repository |
| Signaling Server | Node.js 20+ with native `ws` | Zero-dependency, low-latency, cross-platform WebSocket server |
| NAT Traversal | Dual STUN + TURN Relay (UDP 3478 + TURNS TCP 443) | Essential for punching through cellular Symmetric CGNAT |
| Configuration | Environment-based (`.env`) | Allows flexible deployment to local machine, VPS, or cloud hosts (Fly.io/Render) |
| Test Harness | Built-in `node:test` | Instant automated verification without heavy test dependencies |

## Stack Touched in Phase 1

- [x] Project scaffold (`server/package.json`, `server/src/`, `server/tests/`)
- [x] WebSocket routing — room joining, client role assignment (`camera` vs `viewer`)
- [x] WebRTC signaling — SDP offer/answer forwarding and ICE candidate exchange
- [x] STUN/TURN integration — relay configuration distributor and candidate validation
- [x] Test suite — automated integration tests validating multi-peer room messaging

## Out of Scope (Deferred to Later Slices)

- Android CameraX video capture (Phase 2)
- Browser UI dashboard & two-way intercom (Phase 3)
- OLED black screen & Android Foreground Service (Phase 4)
- On-device motion detection & Telegram alerts (Phase 5)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2:** Android Core Camera & WebRTC Sender (captures camera and connects to this signaling server)
- **Phase 3:** Web Dashboard & Remote Controls (browser connects to this signaling server and displays camera video)
- **Phase 4:** 24/7 Reliability & Thermal Management (keeps Android app streaming 24/7 in background)
- **Phase 5:** Motion Detection, Siren & Telegram Alerts (autonomous motion triggering and notifications)
