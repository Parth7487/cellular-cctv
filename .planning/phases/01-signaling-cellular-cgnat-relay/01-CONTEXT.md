# Phase 1: Signaling & Cellular CGNAT Relay - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the networking and rendezvous backbone necessary for cellular WebRTC connectivity. Because the Android phone operates over a SIM card with Carrier-Grade NAT (CGNAT), traditional direct connections fail. This phase implements the Node.js WebSocket signaling server and STUN/TURN dual-transport relay integration (UDP 3478 + TLS/TCP 443 fallback) along with automated connection testing tools to verify traversal across 4G/5G mobile carriers.
</domain>

<decisions>
## Implementation Decisions

### Project Monorepo Structure & Local Location
- **D-01:** All project assets (server, android client, web dashboard) MUST be created and stored directly inside this repository (`/Users/parth/Downloads/Projects/Random/CCTV`).
- **D-02:** Signaling server lives in `server/` with independent `package.json`, environment configurations, and Dockerfile.

### Signaling Protocol & WebSocket Hub
- **D-03:** Built using lightweight Node.js and `ws` library.
- **D-04:** Provides secure room-based peer discovery, authentication token verification, and message routing for WebRTC SDP offers, answers, ICE candidates, and hardware control signals.

### NAT & Cellular Traversal (STUN / TURN)
- **D-05:** Dual-transport ICE servers: Google STUN for direct UDP hole punching + managed/self-hosted TURN relay (UDP 3478 and TURNS over TCP 443) to guarantee connection over strict mobile carrier firewalls.
- **D-06:** Include automated connectivity verification script (`test-ice.js`) using Trickle ICE logic to validate that `relay` candidates are properly generated.

### Discretion
- Token generation scheme, ping/pong heartbeat intervals, and CLI test scripts left to engineering best practices.
</decisions>

<specifics>
## Specific Ideas
- User emphasized: "make sure everything like app and everything we will save here" — all codebases (server, android, web) belong right inside the local repo tree.
</specifics>

<canonical_refs>
## Canonical References
- `.planning/PROJECT.md` — Project goals and constraints
- `.planning/REQUIREMENTS.md` — STREAM-02 specification
- `.planning/research/SUMMARY.md` — Architectural guidelines
</canonical_refs>
