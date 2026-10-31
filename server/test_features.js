import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('[Test] Connected to Signaling Server on port 8080');
  
  // Join room as viewer
  ws.send(JSON.stringify({
    type: 'join',
    roomId: 'cctv-room-1',
    role: 'viewer'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('[Test] Received message type:', msg.type);

  if (msg.type === 'joined') {
    console.log('[Test] Successfully joined room with peers:', msg.peers);
  }

  if (msg.type === 'offer') {
    console.log('[Test] Received WebRTC offer from camera peer!');
    // Send dummy answer to keep session established
    // (Android will activate the capturer and accept remote control commands)
  }
});

// Run a sequence of tests
setTimeout(() => {
  console.log('\n--- TEST 1: Sending Remote Message Popup ---');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: 'cctv-room-1',
    payload: {
      action: 'show_popup_message',
      text: '📦 Package arrived! Please leave at front door.',
      durationSeconds: 25,
      soundChime: true
    }
  }));
}, 1500);

setTimeout(() => {
  console.log('\n--- TEST 2: Sending Digital Zoom Command (3.0x) ---');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: 'cctv-room-1',
    payload: {
      action: 'set_zoom',
      zoom: 0.5
    }
  }));
}, 4000);

setTimeout(() => {
  console.log('\n--- TEST 3: Sending Torch Toggle (ON) ---');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: 'cctv-room-1',
    payload: {
      action: 'toggle_torch',
      enabled: true
    }
  }));
}, 6000);

setTimeout(() => {
  console.log('\n[Test] Tests dispatched. Closing in 3s...');
  setTimeout(() => process.exit(0), 3000);
}, 8000);
