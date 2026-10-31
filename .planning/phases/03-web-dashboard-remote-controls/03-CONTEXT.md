# Phase 3 Context: Web Dashboard & Remote Controls

## Phase Goal
Deliver a responsive, low-latency browser monitoring dashboard that connects to the signaling server as a `viewer`, negotiates WebRTC peer connections with the Android CCTV phone, displays live sub-second video & audio, provides a push-to-talk two-way intercom, and issues remote hardware commands (front/rear lens toggle, torch/flashlight toggle, and digital zoom).

## Architecture & Design Decisions
1. **Frontend Architecture**:
   - Zero-bloat, modern Vanilla HTML5 / CSS3 / ES Modules.
   - Hosted statically either directly by Node.js server (in `server/public`) or standalone on Vercel/Cloudflare Pages/GitHub Pages.
   - Hosting statically through the existing Node.js server at `server/public/` ensures zero-CORS configuration, unified single-port deployment on Render/VPS/Docker, and effortless browser access.

2. **WebRTC Media Flow**:
   - Web viewer connects via WebSocket to Signaling Server and sends `join` message with `role: 'viewer'`.
   - The Android phone receives `peer_joined` (`viewer`) and immediately creates an SDP Offer with video + audio sendrecv.
   - Web browser receives the offer, sets RemoteDescription, creates SDP Answer, and adds local microphone track if intercom is engaged.
   - Direct encrypted media flows via WebRTC (relayed via TURN TCP 443 if cellular CGNAT restricts UDP).

3. **Remote Hardware Commands**:
   - Remote actions sent via WebSocket signaling as:
     - Torch toggle: `{ type: 'command', payload: { action: 'toggle_torch', enabled: boolean } }`
     - Camera switch: `{ type: 'command', payload: { action: 'switch_camera' } }`
     - Digital zoom: `{ type: 'command', payload: { action: 'set_zoom', zoom: float } }`
     - Alarm siren trigger: `{ type: 'command', payload: { action: 'trigger_siren' } }`

4. **UI & Aesthetic Requirements**:
   - Sleek security console dark mode (`#0c0d14` background, dark glassmorphism control panels).
   - Real-time connection status pill (Connecting / Live / CGNAT Relay / Disconnected).
   - Low-latency HTML5 `<video>` element with custom controls, fullscreen toggle, audio mute/unmute, and picture-in-picture.
   - Push-to-talk button with visual pulse animation while broadcasting.
   - Sliders and toggle switches for zoom, torch, and camera selection.
