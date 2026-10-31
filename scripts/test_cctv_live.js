import WebSocket from '../server/node_modules/ws/index.js';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('[TestViewer] Connected to signaling server');
  ws.send(JSON.stringify({ type: 'get_ice_config' }));
  ws.send(JSON.stringify({
    type: 'join',
    roomId: 'cctv-room-1',
    role: 'viewer'
  }));
});

let offerCount = 0;

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('[TestViewer] Received message type:', msg.type);

  if (msg.type === 'joined') {
    console.log('[TestViewer] Joined room:', msg.roomId, 'Peers:', msg.peers?.length);
  }

  if (msg.type === 'offer') {
    offerCount++;
    console.log(`[TestViewer] Received WebRTC OFFER #${offerCount} from camera (peer ${msg.fromPeerId})!`);
    console.log(`[TestViewer] Offer SDP preview: ${msg.payload?.sdp?.substring(0, 120)}...`);

    // Generate mock Unified Plan answer with bidirectional audio (sendrecv)
    const mockAnswer = `v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\n`;

    ws.send(JSON.stringify({
      type: 'answer',
      roomId: 'cctv-room-1',
      targetPeerId: msg.fromPeerId,
      payload: { sdp: mockAnswer }
    }));
    console.log('[TestViewer] Sent SDP Answer to camera');

    // After 2 seconds, test switch_camera command
    setTimeout(() => {
      console.log('[TestViewer] >>> Sending command: switch_camera');
      ws.send(JSON.stringify({
        type: 'command',
        roomId: 'cctv-room-1',
        payload: { action: 'switch_camera' }
      }));
    }, 2000);

    // After 4 seconds, test switch_camera again
    setTimeout(() => {
      console.log('[TestViewer] >>> Sending second switch_camera (switch back)');
      ws.send(JSON.stringify({
        type: 'command',
        roomId: 'cctv-room-1',
        payload: { action: 'switch_camera' }
      }));
    }, 4000);

    // After 6 seconds, test toggle_torch
    setTimeout(() => {
      console.log('[TestViewer] >>> Sending toggle_torch');
      ws.send(JSON.stringify({
        type: 'command',
        roomId: 'cctv-room-1',
        payload: { action: 'toggle_torch', enabled: true }
      }));
    }, 6000);

    // After 7 seconds, request device health
    setTimeout(() => {
      console.log('[TestViewer] >>> Requesting device_health');
      ws.send(JSON.stringify({
        type: 'get_device_health',
        roomId: 'cctv-room-1'
      }));
    }, 7000);

    // After 8 seconds, request sms history
    setTimeout(() => {
      console.log('[TestViewer] >>> Requesting sms_history');
      ws.send(JSON.stringify({
        type: 'get_sms_history',
        roomId: 'cctv-room-1'
      }));
    }, 8000);

    // Complete test after 11 seconds
    setTimeout(() => {
      console.log('[TestViewer] Test sequence finished! Closing.');
      ws.close();
      process.exit(0);
    }, 11000);
  }

  if (msg.type === 'device_health') {
    console.log('[TestViewer] >>> DEVICE HEALTH RECEIVED:', JSON.stringify(msg.payload));
  }

  if (msg.type === 'sms_history') {
    console.log('[TestViewer] >>> SMS HISTORY RECEIVED count:', msg.payload?.length);
  }
});
