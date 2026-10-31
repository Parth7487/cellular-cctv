import WebSocket from 'ws';

const SERVER_URL = 'wss://cellular-cctv.onrender.com';
const ROOM_ID = 'cctv-room-1';

console.log(`[TEST SUITE] Connecting to ${SERVER_URL}...`);
const ws = new WebSocket(SERVER_URL);

let cameraPeerId = null;
let offerReceived = false;
let audioTrackPresent = false;
let videoTrackPresent = false;
let candidatesCount = 0;

function sendCommand(action, payload = {}) {
  console.log(`[TEST SUITE] Sending command: ${action}`, payload);
  ws.send(JSON.stringify({
    type: 'command',
    roomId: ROOM_ID,
    payload: { action, ...payload }
  }));
}

ws.on('open', () => {
  console.log('[TEST SUITE] Connected to signaling server. Joining room as viewer...');
  ws.send(JSON.stringify({
    type: 'join',
    roomId: ROOM_ID,
    role: 'viewer'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  // console.log('[MSG]', msg.type);

  if (msg.type === 'joined') {
    console.log(`[TEST SUITE] Successfully joined room ${ROOM_ID}`);
    const camera = msg.peers.find(p => p.role === 'camera');
    if (camera) {
      cameraPeerId = camera.peerId;
      console.log(`[TEST SUITE] Found active camera peer: ${cameraPeerId}`);
    } else {
      console.warn('[TEST SUITE] No camera currently in room');
    }
  }

  if (msg.type === 'peer_joined' && msg.role === 'camera') {
    cameraPeerId = msg.peerId;
    console.log(`[TEST SUITE] Camera joined: ${cameraPeerId}`);
  }

  if (msg.type === 'offer') {
    offerReceived = true;
    const sdp = msg.payload.sdp;
    videoTrackPresent = sdp.includes('m=video');
    audioTrackPresent = sdp.includes('m=audio');
    console.log(`[TEST SUITE] WebRTC Offer received! Video: ${videoTrackPresent}, Audio: ${audioTrackPresent}`);
  }

  if (msg.type === 'candidate') {
    candidatesCount++;
  }
});

// Run through tests sequentially
async function runTests() {
  // Wait for initial WebRTC negotiation
  await new Promise(r => setTimeout(r, 4000));
  console.log('\n--- TEST 1: WebRTC Streaming & Media Tracks ---');
  console.log(`Offer received: ${offerReceived ? 'PASS' : 'FAIL'}`);
  console.log(`Video track in SDP: ${videoTrackPresent ? 'PASS' : 'FAIL'}`);
  console.log(`Audio track in SDP (2-way listening): ${audioTrackPresent ? 'PASS' : 'FAIL'}`);
  console.log(`ICE Candidates gathered: ${candidatesCount} candidates (${candidatesCount > 0 ? 'PASS' : 'FAIL'})`);

  console.log('\n--- TEST 2: Torch / Flashlight Control ---');
  sendCommand('toggle_torch', { enabled: true });
  await new Promise(r => setTimeout(r, 2500));
  sendCommand('toggle_torch', { enabled: false });
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n--- TEST 3: Camera Zoom Control ---');
  sendCommand('set_zoom', { zoom: 0.5 }); // 50% linear zoom
  await new Promise(r => setTimeout(r, 2500));
  sendCommand('set_zoom', { zoom: 0.0 }); // 0% reset
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n--- TEST 4: Remote Popup Message ---');
  sendCommand('show_popup_message', {
    text: 'CCTV SYSTEM OPERATIONAL\nAll Security Features Verified',
    durationSeconds: 5,
    soundChime: true
  });
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- TEST 5: OTA Update Check ---');
  sendCommand('check_update', {});
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n[TEST SUITE] Completed all commands. Disconnecting.');
  ws.close();
  process.exit(0);
}

runTests();
