import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createSignalingServer } from '../src/signaling.js';
import { getIceServers } from '../src/config.js';

function waitForMessage(ws, predicate, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for message satisfying predicate after ${timeout}ms`));
    }, timeout);

    const onMessage = (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (predicate(parsed)) {
          clearTimeout(timer);
          ws.off('message', onMessage);
          resolve(parsed);
        }
      } catch (err) {
        // ignore parse errors for other messages
      }
    };

    ws.on('message', onMessage);
  });
}

test('Signaling Server - Room creation, peer discovery, and SDP/ICE routing', async (t) => {
  const server = http.createServer();
  const { wss, rooms } = createSignalingServer(server, { getIceServers });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const wsUrl = `ws://127.0.0.1:${port}`;

  t.after(() => {
    wss.close();
    server.close();
  });

  await t.test('Camera and Viewer join room and establish bidirectional signaling', async () => {
    const cameraWs = new WebSocket(wsUrl);
    const viewerWs = new WebSocket(wsUrl);

    await Promise.all([
      new Promise((res) => cameraWs.on('open', res)),
      new Promise((res) => viewerWs.on('open', res)),
    ]);

    // 1. Camera joins room
    const cameraJoinedPromise = waitForMessage(cameraWs, (msg) => msg.type === 'joined');
    cameraWs.send(JSON.stringify({ type: 'join', roomId: 'living-room', role: 'camera' }));
    const cameraJoined = await cameraJoinedPromise;
    assert.equal(cameraJoined.roomId, 'living-room');
    assert.equal(cameraJoined.role, 'camera');
    assert.ok(cameraJoined.peerId);

    // 2. Viewer joins same room
    const cameraSeesPeerJoined = waitForMessage(cameraWs, (msg) => msg.type === 'peer_joined');
    const viewerJoinedPromise = waitForMessage(viewerWs, (msg) => msg.type === 'joined');

    viewerWs.send(JSON.stringify({ type: 'join', roomId: 'living-room', role: 'viewer' }));
    const viewerJoined = await viewerJoinedPromise;
    assert.equal(viewerJoined.roomId, 'living-room');
    assert.equal(viewerJoined.role, 'viewer');
    assert.equal(viewerJoined.peers.length, 1);
    assert.equal(viewerJoined.peers[0].peerId, cameraJoined.peerId);

    const peerJoinedNotification = await cameraSeesPeerJoined;
    assert.equal(peerJoinedNotification.peerId, viewerJoined.peerId);
    assert.equal(peerJoinedNotification.role, 'viewer');

    // 3. Camera sends SDP offer -> Viewer receives it
    const viewerReceivesOffer = waitForMessage(viewerWs, (msg) => msg.type === 'offer');
    cameraWs.send(
      JSON.stringify({
        type: 'offer',
        roomId: 'living-room',
        payload: { sdp: 'v=0\r\no=camera 12345 2 IN IP4 127.0.0.1' },
      })
    );
    const offerMsg = await viewerReceivesOffer;
    assert.equal(offerMsg.fromPeerId, cameraJoined.peerId);
    assert.equal(offerMsg.payload.sdp, 'v=0\r\no=camera 12345 2 IN IP4 127.0.0.1');

    // 4. Viewer sends SDP answer -> Camera receives it
    const cameraReceivesAnswer = waitForMessage(cameraWs, (msg) => msg.type === 'answer');
    viewerWs.send(
      JSON.stringify({
        type: 'answer',
        roomId: 'living-room',
        payload: { sdp: 'v=0\r\no=viewer 67890 2 IN IP4 127.0.0.1' },
      })
    );
    const answerMsg = await cameraReceivesAnswer;
    assert.equal(answerMsg.fromPeerId, viewerJoined.peerId);
    assert.equal(answerMsg.payload.sdp, 'v=0\r\no=viewer 67890 2 IN IP4 127.0.0.1');

    // 5. ICE candidate exchange
    const viewerReceivesCandidate = waitForMessage(viewerWs, (msg) => msg.type === 'candidate');
    cameraWs.send(
      JSON.stringify({
        type: 'candidate',
        roomId: 'living-room',
        payload: { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host' },
      })
    );
    const candidateMsg = await viewerReceivesCandidate;
    assert.equal(candidateMsg.fromPeerId, cameraJoined.peerId);
    assert.ok(candidateMsg.payload.candidate.includes('192.168.1.100'));

    // 6. Remote command routing (e.g., torch toggle)
    const cameraReceivesCommand = waitForMessage(cameraWs, (msg) => msg.type === 'command');
    viewerWs.send(
      JSON.stringify({
        type: 'command',
        roomId: 'living-room',
        payload: { action: 'toggle_torch', enabled: true },
      })
    );
    const commandMsg = await cameraReceivesCommand;
    assert.equal(commandMsg.fromPeerId, viewerJoined.peerId);
    assert.equal(commandMsg.payload.action, 'toggle_torch');
    assert.equal(commandMsg.payload.enabled, true);

    // 7. Request ICE configuration
    const viewerReceivesIceConfig = waitForMessage(viewerWs, (msg) => msg.type === 'ice_config');
    viewerWs.send(JSON.stringify({ type: 'get_ice_config' }));
    const iceConfigMsg = await viewerReceivesIceConfig;
    assert.ok(Array.isArray(iceConfigMsg.iceServers));
    assert.ok(iceConfigMsg.iceServers.length > 0);

    // 8. Ping / Pong
    const pongPromise = waitForMessage(cameraWs, (msg) => msg.type === 'pong');
    cameraWs.send(JSON.stringify({ type: 'ping' }));
    const pongMsg = await pongPromise;
    assert.ok(pongMsg.timestamp);

    // 9. SMS Relay: Camera broadcasts incoming SMS -> Viewer receives it
    const viewerReceivesSms = waitForMessage(viewerWs, (msg) => msg.type === 'sms_received');
    cameraWs.send(
      JSON.stringify({
        type: 'sms_received',
        roomId: 'living-room',
        payload: {
          sender: 'VK-HDFCBK',
          body: 'Your OTP is 492019 for online transaction.',
          timestamp: 1730310000000,
        },
      })
    );
    const smsMsg = await viewerReceivesSms;
    assert.equal(smsMsg.fromPeerId, cameraJoined.peerId);
    assert.equal(smsMsg.payload.sender, 'VK-HDFCBK');
    assert.equal(smsMsg.payload.body, 'Your OTP is 492019 for online transaction.');

    // 10. SMS History: Viewer requests history -> Camera responds with list
    const cameraReceivesHistoryReq = waitForMessage(cameraWs, (msg) => msg.type === 'get_sms_history');
    viewerWs.send(JSON.stringify({ type: 'get_sms_history', roomId: 'living-room' }));
    await cameraReceivesHistoryReq;

    const viewerReceivesHistory = waitForMessage(viewerWs, (msg) => msg.type === 'sms_history');
    cameraWs.send(
      JSON.stringify({
        type: 'sms_history',
        roomId: 'living-room',
        payload: {
          messages: [{ sender: 'VK-HDFCBK', body: 'Old OTP 123456', timestamp: 1730300000000 }],
        },
      })
    );
    const historyMsg = await viewerReceivesHistory;
    assert.equal(historyMsg.payload.messages.length, 1);
    assert.equal(historyMsg.payload.messages[0].sender, 'VK-HDFCBK');

    // 11. Device Health: Viewer requests health diagnostics -> Camera responds
    const cameraReceivesHealthReq = waitForMessage(cameraWs, (msg) => msg.type === 'get_device_health');
    viewerWs.send(JSON.stringify({ type: 'get_device_health', roomId: 'living-room' }));
    await cameraReceivesHealthReq;

    const viewerReceivesHealth = waitForMessage(viewerWs, (msg) => msg.type === 'device_health');
    cameraWs.send(
      JSON.stringify({
        type: 'device_health',
        roomId: 'living-room',
        payload: {
          battery: { percentage: 94, isCharging: true, temperatureC: 33.5 },
          storage: { totalFormatted: '64 GB', usedFormatted: '40 GB', usedPercent: 62 },
          topApps: [{ name: 'WhatsApp', sizeFormatted: '2.4 GB' }],
        },
      })
    );
    const healthMsg = await viewerReceivesHealth;
    assert.equal(healthMsg.payload.battery.percentage, 94);
    assert.equal(healthMsg.payload.topApps[0].name, 'WhatsApp');

    // 12. Remote Call Trigger: Viewer sends make_call -> Camera receives it
    const cameraReceivesCallCmd = waitForMessage(cameraWs, (msg) => msg.type === 'make_call');
    viewerWs.send(JSON.stringify({ type: 'make_call', roomId: 'living-room', payload: { number: '+919876543210' } }));
    const callCmd = await cameraReceivesCallCmd;
    assert.equal(callCmd.payload.number, '+919876543210');

    // 13. Call State & Logs Relay: Camera sends call_state and call_logs -> Viewer receives them
    const viewerReceivesCallState = waitForMessage(viewerWs, (msg) => msg.type === 'call_state');
    cameraWs.send(JSON.stringify({ type: 'call_state', roomId: 'living-room', payload: { state: 'offhook', number: '+919876543210' } }));
    const callStateMsg = await viewerReceivesCallState;
    assert.equal(callStateMsg.payload.state, 'offhook');

    // 14. Peer disconnect notification
    const cameraSeesPeerLeft = waitForMessage(cameraWs, (msg) => msg.type === 'peer_left');
    viewerWs.close();
    const peerLeftMsg = await cameraSeesPeerLeft;
    assert.equal(peerLeftMsg.peerId, viewerJoined.peerId);
    assert.equal(peerLeftMsg.remainingPeers, 1);

    cameraWs.close();
  });
});
