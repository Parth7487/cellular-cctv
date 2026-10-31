/**
 * Browser WebSocket client for CCTV signaling server.
 */
export class SignalingClient {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || this.getDefaultUrl();
    this.roomId = options.roomId || 'cctv-room-1';
    this.role = 'viewer';
    this.ws = null;
    this.isConnected = false;
    this.shouldReconnect = true;
    this.reconnectTimer = null;
    this.handlers = new Map();
  }

  getDefaultUrl() {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${loc.host}`;
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);
  }

  emit(event, data) {
    const listeners = this.handlers.get(event);
    if (listeners) {
      listeners.forEach((fn) => fn(data));
    }
  }

  connect(serverUrl, roomId) {
    if (serverUrl) this.serverUrl = serverUrl;
    if (roomId) this.roomId = roomId;
    this.shouldReconnect = true;

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    console.log(`[Signaling] Connecting to ${this.serverUrl} for room ${this.roomId}`);
    this.emit('connecting');

    try {
      this.ws = new WebSocket(this.serverUrl);
    } catch (err) {
      this.emit('error', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[Signaling] WebSocket Connected. Joining room as viewer...');
      this.isConnected = true;
      this.emit('connected');

      // Request ICE server configurations
      this.send({ type: 'get_ice_config' });

      // Join room
      this.send({
        type: 'join',
        roomId: this.roomId,
        role: this.role,
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[Signaling] Message parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[Signaling] WebSocket Disconnected');
      this.isConnected = false;
      this.emit('disconnected');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('[Signaling] WebSocket Error:', err);
      this.emit('error', err);
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.isConnected = false;
    this.emit('disconnected');
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        console.log('[Signaling] Attempting reconnection...');
        this.connect();
      }
    }, 3000);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendAnswer(sdp, targetPeerId) {
    this.send({
      type: 'answer',
      roomId: this.roomId,
      targetPeerId,
      payload: { sdp },
    });
  }

  sendCandidate(candidate, sdpMid, sdpMLineIndex, targetPeerId) {
    this.send({
      type: 'candidate',
      roomId: this.roomId,
      targetPeerId,
      payload: { candidate, sdpMid, sdpMLineIndex },
    });
  }

  sendCommand(action, payload = {}) {
    this.send({
      type: 'command',
      roomId: this.roomId,
      payload: { action, ...payload },
    });
  }

  handleMessage(msg) {
    const { type, payload, fromPeerId, role } = msg;

    switch (type) {
      case 'joined':
        this.emit('joined', msg);
        break;
      case 'peer_joined':
        this.emit('peer_joined', msg);
        break;
      case 'peer_left':
        this.emit('peer_left', msg);
        break;
      case 'offer':
        this.emit('offer', { sdp: payload?.sdp, fromPeerId });
        break;
      case 'candidate':
        this.emit('candidate', {
          candidate: payload?.candidate,
          sdpMid: payload?.sdpMid,
          sdpMLineIndex: payload?.sdpMLineIndex,
          fromPeerId,
        });
        break;
      case 'sms_received':
        this.emit('sms_received', payload);
        break;
      case 'sms_history':
        this.emit('sms_history', payload);
        break;
      case 'device_health':
        this.emit('device_health', payload);
        break;
      case 'call_state':
        this.emit('call_state', payload);
        break;
      case 'call_logs':
        this.emit('call_logs', payload);
        break;
      case 'call_recordings':
        this.emit('call_recordings', payload);
        break;
      case 'ice_config':
        this.emit('ice_config', msg.iceServers || []);
        break;
      case 'error':
        this.emit('error', msg.message);
        break;
      default:
        break;
    }
  }

  requestSmsHistory() {
    this.send({
      type: 'get_sms_history',
      roomId: this.roomId,
    });
  }

  requestDeviceHealth() {
    this.send({
      type: 'get_device_health',
      roomId: this.roomId,
    });
  }

  makeCall(number) {
    this.send({
      type: 'make_call',
      roomId: this.roomId,
      payload: { number },
    });
  }

  endCall() {
    this.send({
      type: 'end_call',
      roomId: this.roomId,
    });
  }

  answerCall() {
    this.send({
      type: 'answer_call',
      roomId: this.roomId,
    });
  }

  toggleSpeakerphone(enabled) {
    this.send({
      type: 'toggle_speakerphone',
      roomId: this.roomId,
      payload: { enabled },
    });
  }

  requestCallLogs() {
    this.send({
      type: 'get_call_logs',
      roomId: this.roomId,
    });
  }

  requestCallRecordings() {
    this.send({
      type: 'get_recordings',
      roomId: this.roomId,
    });
  }
}
