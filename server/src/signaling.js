import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';

/**
 * Creates and mounts a WebSocket signaling server onto an existing HTTP server or port.
 *
 * @param {import('node:http').Server} [server] - Optional existing HTTP server
 * @param {object} [options] - Configuration options
 * @param {Function} [options.getIceServers] - Function returning ICE server configuration
 * @returns {{ wss: WebSocketServer, rooms: Map<string, Set<WebSocket>> }}
 */
export function createSignalingServer(server, options = {}) {
  const wss = server ? new WebSocketServer({ server }) : new WebSocketServer({ noServer: true });
  const rooms = new Map();

  function getRoom(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    return rooms.get(roomId);
  }

  function leaveRoom(ws) {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (room) {
      room.delete(ws);
      const leaveMessage = JSON.stringify({
        type: 'peer_left',
        peerId: ws.peerId,
        role: ws.role,
        roomId: ws.roomId,
        remainingPeers: room.size,
      });

      for (const client of room) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(leaveMessage);
        }
      }

      if (room.size === 0) {
        rooms.delete(ws.roomId);
      }
    }
    ws.roomId = null;
  }

  function broadcastToRoom(ws, messageData, targetPeerId = null) {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const payload = JSON.stringify({
      ...messageData,
      fromPeerId: ws.peerId,
      fromRole: ws.role,
    });

    for (const client of room) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        if (!targetPeerId || client.peerId === targetPeerId) {
          client.send(payload);
        }
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.peerId = crypto.randomUUID();
    ws.role = 'unknown';
    ws.roomId = null;
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
        return;
      }

      const { type, roomId, role, payload, targetPeerId } = message;

      switch (type) {
        case 'join': {
          if (!roomId) {
            ws.send(JSON.stringify({ type: 'error', message: 'roomId is required' }));
            return;
          }

          leaveRoom(ws);

          ws.roomId = roomId;
          ws.role = role || 'viewer';

          const room = getRoom(roomId);
          room.add(ws);

          // Confirm join to the connected client
          const existingPeers = Array.from(room)
            .filter((p) => p !== ws)
            .map((p) => ({ peerId: p.peerId, role: p.role }));

          ws.send(
            JSON.stringify({
              type: 'joined',
              roomId: ws.roomId,
              peerId: ws.peerId,
              role: ws.role,
              peers: existingPeers,
            })
          );

          // Notify existing peers
          broadcastToRoom(ws, {
            type: 'peer_joined',
            peerId: ws.peerId,
            role: ws.role,
            roomId: ws.roomId,
          });
          break;
        }

        case 'offer':
        case 'answer':
        case 'candidate':
        case 'command':
        case 'sms_received':
        case 'sms_history':
        case 'get_sms_history':
        case 'get_device_health':
        case 'device_health':
        case 'make_call':
        case 'end_call':
        case 'answer_call':
        case 'toggle_speakerphone':
        case 'get_call_logs':
        case 'call_logs':
        case 'call_state':
        case 'get_recordings':
        case 'call_recordings': {
          if (!ws.roomId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Must join a room first' }));
            return;
          }
          broadcastToRoom(ws, { type, payload, roomId: ws.roomId }, targetPeerId);
          break;
        }

        case 'get_ice_config': {
          const iceServers = options.getIceServers ? options.getIceServers() : [];
          ws.send(JSON.stringify({ type: 'ice_config', iceServers }));
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        }

        default: {
          ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
        }
      }
    });

    ws.on('close', () => {
      leaveRoom(ws);
    });

    ws.on('error', () => {
      leaveRoom(ws);
    });
  });

  // Heartbeat keepalive every 30s
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        leaveRoom(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return { wss, rooms };
}
