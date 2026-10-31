# Phase 3 Research: Web Dashboard & Remote Controls

## 1. WebRTC in Modern Web Browsers
- Modern browsers (Chrome, Safari, Firefox, Edge on iOS/Android/macOS/Windows) support standard `RTCPeerConnection`.
- Browsers require user interaction or explicit unmuting before auto-playing audio with video (`videoElement.play()` requires `muted = true` initially, with an explicit "Unmute Audio" button).
- Two-way intercom requires calling `navigator.mediaDevices.getUserMedia({ audio: true, video: false })` and attaching `stream.getAudioTracks()[0]` to the `RTCPeerConnection` via `addTrack()` or replacing an existing audio transceiver track (`transceiver.sender.replaceTrack(track)`).

## 2. Low-Latency Media Playback
- HTML5 `<video>` element with `playsinline` and `autoplay`.
- For sub-second security camera viewing, WebRTC media stream handles adaptive jitter buffers automatically without HLS/DASH buffering latency.
- WebRTC ICE connection states (`connecting`, `connected`, `completed`, `failed`, `disconnected`) give immediate visual feedback on cellular NAT traversal.

## 3. Remote Control Protocol via Signaling
- When viewer clicks a control button in the dashboard, browser transmits:
  ```json
  {
    "type": "command",
    "roomId": "cctv-room-1",
    "payload": {
      "action": "toggle_torch",
      "enabled": true
    }
  }
  ```
- Android app's `OnDemandStreamController.kt` listener receives this command and executes `cameraXManager.setTorch(true)` or `cameraXManager.setZoom(zoom)`.

## 4. Serving Static Web UI from Node.js
- Node.js `http` server in `server/src/index.js` can serve static files from `server/public/` using lightweight native Node streams (`fs.createReadStream`) or serve MIME types for `.html`, `.css`, `.js`, `.svg`.
- This ensures single-port hosting: `npm start` serves both the WebSocket signaling backend, the REST ICE API, and the viewer web dashboard.
