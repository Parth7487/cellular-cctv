# Phase 1: Signaling & Cellular CGNAT Relay - Research

**Researched:** 2026-10-30
**Domain:** WebRTC Signaling & Cellular Carrier-Grade NAT (CGNAT) Traversal
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All project codebases (server, android, web) MUST be saved locally inside this repository (`/Users/parth/Downloads/Projects/Random/CCTV`).
- **D-02:** Signaling server lives in `server/` with independent `package.json`, environment configurations, and Dockerfile.
- **D-03:** Built using lightweight Node.js with `ws` library for sub-millisecond message delivery.
- **D-04:** Provides secure room-based peer discovery, authentication token verification, and message routing for SDP offer/answer, ICE candidates, and hardware control signals.
- **D-05:** Dual-transport ICE servers: Google STUN for direct UDP hole punching + managed/self-hosted TURN relay (UDP 3478 and TURNS over TCP 443) to guarantee connection over strict mobile carrier firewalls.
- **D-06:** Automated connectivity verification script (`test-ice.js`) using Trickle ICE logic to validate that `relay` candidates are generated.

### Claude's Discretion
- Heartbeat ping/pong intervals (recommended: 30s).
- Room ID generation scheme (recommended: alphanumeric room key or device ID).
- CLI test scripts and test fixtures.

### Deferred Ideas (OUT OF SCOPE)
- Continuous uncompressed 24/7 cloud recording.
- Local Wi-Fi router dependency (must work over cellular SIM).
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WebSocket Connection Hub | API / Relay Server (`server/`) | Client (`android/`, `web/`) | Central rendezvous for peers behind separate firewalls |
| Room & Client Authentication | API / Relay Server (`server/`) | — | Ensures only authorized viewers can connect to the CCTV camera |
| STUN/TURN Credential Provider | API / Relay Server (`server/`) | — | Distributes ephemeral or static ICE server configs to peers |
| ICE Candidate Routing | API / Relay Server (`server/`) | — | Transits NAT candidates between phone and browser |
</architectural_responsibility_map>

<research_summary>
## Summary

When an Android smartphone acts as a CCTV camera over cellular 4G/5G data (without home Wi-Fi), it sits behind Symmetric Carrier-Grade NAT (CGNAT). Traditional inbound IP connections are blocked by mobile carriers. WebRTC is the industry standard for sub-second, bi-directional media transmission, but STUN alone fails because carrier NAT mappings change per destination.

To guarantee 100% reliable cellular connectivity, the architecture pairs a lightweight Node.js WebSocket signaling server with a dual-transport TURN relay (supporting both standard UDP on port 3478 and TLS/TURNS over TCP port 443). The signaling server handles peer discovery, room isolation, and control signals, while the TURN relay bridges media packets when direct peer-to-peer UDP hole punching is blocked by the mobile carrier.

**Primary recommendation:** Build a zero-dependency (using only `ws` and Node.js built-ins) signaling service in `server/`, backed by configurable STUN/TURN configurations with an automated Trickle ICE validation script.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ws` | ^8.18.0 | WebSocket Server & Client | Industry standard for high-performance Node.js WebSockets; minimal overhead and zero vulnerabilities |
| Node.js Built-in `node:test` | Node 20+ LTS | Automated Unit & Integration Testing | Zero-dependency testing runner built directly into Node.js |
| `dotenv` | ^16.4.0 | Environment Configuration | Securely handles TURN secrets and port configurations |

### Supporting & Relay Infrastructure
| Service / Tool | Protocol / Port | Purpose | When to Use |
|----------------|-----------------|---------|-------------|
| Google STUN | `stun:stun.l.google.com:19302` | Direct NAT discovery | Always included first in ICE configuration |
| Metered.ca / Coturn | `turn:turnserver:3478` (UDP/TCP) | Cellular NAT traversal relay | Activated when mobile carrier uses Symmetric NAT |
| Secure TURNS | `turns:turnserver:443?transport=tcp` | Mobile firewall bypass | Bypasses restrictive carrier inspection disguised as HTTPS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ws` (plain WebSockets) | `socket.io` | `socket.io` introduces unnecessary protocol bloat, larger client bundles, and higher memory usage |
| Self-hosted Coturn | Metered.ca (Free TURN API) | Metered.ca provides 50 GB free monthly TURN relay with 0 server maintenance; ideal for MVP |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Signaling State Machine & Room Isolation

```
           [Android Camera (Sender)]
                       │
             ws://host:port (join room "camera-1", role "camera")
                       │
                       ▼
       ┌───────────────────────────────┐
       │   Signaling Server (ws hub)   │
       │   - Rooms map: roomId -> Room │
       │   - Peer roles: camera/viewer │
       │   - Forwarding logic          │
       └───────────────▲───────────────┘
                       │
             ws://host:port (join room "camera-1", role "viewer")
                       │
            [Web Browser (Viewer)]
```

### Message Exchange Protocol

All messages conform to a standard JSON envelope:
```json
{
  "type": "offer" | "answer" | "candidate" | "join" | "peer_joined" | "peer_left" | "command" | "ping" | "pong",
  "roomId": "living-room-cctv",
  "role": "camera" | "viewer",
  "payload": {}
}
```

### Anti-Patterns to Avoid
- **Hardcoding public IPs:** Mobile IP addresses change frequently; rely strictly on dynamic WebSockets and ICE candidates.
- **Omitting TURN TCP 443:** Cellular networks frequently throttle or block high-port UDP. Omitting TCP port 443 leads to mysterious connection drops.
- **Unbounded message broadcasting:** Always scope signaling messages to specific room IDs so streams do not collide.
</architecture_patterns>

<validation_architecture>
## Validation Architecture

### Automated Verification Plan
1. **Signaling Server Tests (`server/tests/signaling.test.js`)**:
   - Start server on ephemeral port.
   - Connect camera and viewer mock WebSocket clients.
   - Verify room joining, role assignment, and two-way SDP/ICE payload routing.
   - Verify heartbeat ping/pong disconnect detection.
2. **ICE & TURN Connectivity Verifier (`server/tests/verify-turn.js`)**:
   - Query configured STUN/TURN credentials.
   - Initialize headless WebRTC peer connection or UDP/TCP probe.
   - Validate that ICE gathering produces `srflx` (STUN) and `relay` (TURN) candidates.

### Test Commands
- **Quick run:** `node --test server/tests/signaling.test.js`
- **Full suite:** `npm test --prefix server`
- **Estimated runtime:** ~1.5 seconds.
</validation_architecture>

<sources>
## Sources
- WebRTC W3C RFC 8489 (STUN) & RFC 8656 (TURN)
- Node.js `ws` GitHub Documentation (websockets/ws)
- Metered.ca WebRTC STUN/TURN API specifications
</sources>
