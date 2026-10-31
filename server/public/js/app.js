import { SignalingClient } from './signaling.js';
import { WebRtcViewer } from './webrtc.js';
import { RemoteControls } from './controls.js';
import { StreamRecorder } from './recorder.js';
import { Intercom } from './intercom.js';
import { SmsManager } from './sms.js';
import { HealthManager } from './health.js';
import { CallManagerClient } from './calls.js';

// DOM Elements
const remoteVideo = document.getElementById('remoteVideo');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const placeholderText = document.getElementById('placeholderText');
const btnUnmuteOverlay = document.getElementById('btnUnmuteOverlay');
const statusPill = document.getElementById('statusPill');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const iceStatePill = document.getElementById('iceStatePill');
const feedLiveDot = document.getElementById('feedLiveDot');
const streamTimeCode = document.getElementById('streamTimeCode');
const peerCountBadge = document.getElementById('peerCountBadge');

const headerBatteryPill = document.getElementById('headerBatteryPill');
const headerBatteryIcon = document.getElementById('headerBatteryIcon');
const headerBatteryText = document.getElementById('headerBatteryText');

const btnHeaderConnect = document.getElementById('btnHeaderConnect');
const btnToggleAudio = document.getElementById('btnToggleAudio');
const audioIcon = document.getElementById('audioIcon');
const audioText = document.getElementById('audioText');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const btnSnapshot = document.getElementById('btnSnapshot');
const btnFullscreen = document.getElementById('btnFullscreen');

// Video Recording Elements
const btnRecordVideo = document.getElementById('btnRecordVideo');
const recordIcon = document.getElementById('recordIcon');
const recordText = document.getElementById('recordText');
const btnRecordAudioToggle = document.getElementById('btnRecordAudioToggle');
const recordingBadge = document.getElementById('recordingBadge');
const recTimerText = document.getElementById('recTimerText');

// Remote Message Broadcast Elements
const inputPopupMessage = document.getElementById('inputPopupMessage');
const selectPopupDuration = document.getElementById('selectPopupDuration');
const checkPopupChime = document.getElementById('checkPopupChime');
const btnSendPopupMsg = document.getElementById('btnSendPopupMsg');
const btnDismissPopupMsg = document.getElementById('btnDismissPopupMsg');
const quickChips = document.querySelectorAll('.quick-chip');

const btnTorch = document.getElementById('btnTorch');
const btnSwitchLens = document.getElementById('btnSwitchLens');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValueText = document.getElementById('zoomValueText');
const presetPills = document.querySelectorAll('.preset-pill');
const btnPtt = document.getElementById('btnPtt');
const pttLabel = document.getElementById('pttLabel');
const pttVolumeContainer = document.getElementById('pttVolumeContainer');
const pttVolumeVal = document.getElementById('pttVolumeVal');
const pttMeterFill = document.getElementById('pttMeterFill');
const btnSiren = document.getElementById('btnSiren');

const mobileNavBar = document.getElementById('mobileNavBar');
const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
const mobileSmsBadge = document.getElementById('mobileSmsBadge');

const inputServerUrl = document.getElementById('serverUrl');
const inputRoomId = document.getElementById('roomId');
const btnSaveConfig = document.getElementById('btnSaveConfig');

// State & Preferences
const STORAGE_SERVER = 'cctv_server_url';
const STORAGE_ROOM = 'cctv_room_id';

const defaultUrl = window.location.protocol === 'https:'
  ? `wss://${window.location.host}`
  : `ws://${window.location.host}`;

const savedServer = localStorage.getItem(STORAGE_SERVER) || defaultUrl;
const savedRoom = localStorage.getItem(STORAGE_ROOM) || 'cctv-room-1';

inputServerUrl.value = savedServer;
inputRoomId.value = savedRoom;

let timeCodeInterval = null;
let streamStartTime = null;

// Initialize Core Components
const signaling = new SignalingClient({
  serverUrl: savedServer,
  roomId: savedRoom,
});

const webrtc = new WebRtcViewer({
  videoElement: remoteVideo,
  onIceCandidate: (candidate, targetPeerId) => {
    signaling.sendCandidate(candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex, targetPeerId);
  },
  onIceConnectionState: (state) => {
    iceStatePill.textContent = `ICE: ${state.toUpperCase()}`;
    if (state === 'connected' || state === 'completed') {
      updateStatus('live', 'LIVE STREAM');
      videoPlaceholder.style.display = 'none';
      feedLiveDot.className = 'status-dot live';
      startTimer();
    } else if (state === 'failed' || state === 'disconnected') {
      updateStatus('idle', 'Connection Lost');
      videoPlaceholder.style.display = 'flex';
      placeholderText.textContent = 'Camera Disconnected';
      feedLiveDot.className = 'status-dot';
      stopTimer();
    }
  },
  onTrack: () => {
    videoPlaceholder.style.display = 'none';
  },
});

const controls = new RemoteControls(signaling, remoteVideo);
const recorder = new StreamRecorder(webrtc);
const intercom = new Intercom(webrtc);
const sms = new SmsManager(signaling);
const health = new HealthManager(signaling);
const calls = new CallManagerClient(signaling);

// Helpers
function updateStatus(dotClass, text) {
  statusDot.className = `status-dot ${dotClass}`;
  statusLabel.textContent = text;
}

function startTimer() {
  if (timeCodeInterval) clearInterval(timeCodeInterval);
  streamStartTime = Date.now();
  timeCodeInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - streamStartTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    streamTimeCode.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  if (timeCodeInterval) clearInterval(timeCodeInterval);
  streamTimeCode.textContent = '00:00:00';
}

// Signaling Event Handlers
signaling.on('connecting', () => {
  updateStatus('idle', 'Connecting...');
  btnHeaderConnect.textContent = 'Connecting...';
});

signaling.on('connected', () => {
  updateStatus('connected', 'Signaling Connected');
  btnHeaderConnect.textContent = 'Disconnect';
  placeholderText.textContent = 'Waiting for Camera Stream...';
});

signaling.on('disconnected', () => {
  updateStatus('idle', 'Offline');
  btnHeaderConnect.textContent = 'Connect';
  videoPlaceholder.style.display = 'flex';
  placeholderText.textContent = 'Signaling Disconnected';
  stopTimer();
});

signaling.on('joined', (data) => {
  const peers = data.peers || [];
  peerCountBadge.textContent = `${peers.length + 1} Peers in Room`;
  const cameraPeer = peers.find((p) => p.role === 'camera');
  if (cameraPeer) {
    placeholderText.textContent = 'Camera Found! Negotiating WebRTC...';
  } else {
    placeholderText.textContent = 'Camera is Offline (Waiting to turn on)';
  }
});

signaling.on('peer_joined', (data) => {
  if (data.role === 'camera') {
    placeholderText.textContent = 'Camera Connected! Negotiating WebRTC...';
  }
});

signaling.on('peer_left', (data) => {
  if (data.role === 'camera') {
    placeholderText.textContent = 'Camera Turned Off';
    webrtc.close();
    videoPlaceholder.style.display = 'flex';
    feedLiveDot.className = 'status-dot';
    stopTimer();
  }
});

signaling.on('offer', async ({ sdp, fromPeerId }) => {
  console.log('[App] Incoming WebRTC offer from camera:', fromPeerId);
  placeholderText.textContent = 'Processing Video Offer...';
  try {
    const answerSdp = await webrtc.handleOffer(sdp, fromPeerId);
    signaling.sendAnswer(answerSdp, fromPeerId);
  } catch (err) {
    console.error('[App] Failed to handle offer:', err);
    placeholderText.textContent = 'WebRTC Handshake Failed';
  }
});

signaling.on('candidate', (cand) => {
  webrtc.addRemoteCandidate({
    candidate: cand.candidate,
    sdpMid: cand.sdpMid,
    sdpMLineIndex: cand.sdpMLineIndex,
  });
});

signaling.on('ice_config', (servers) => {
  console.log('[App] Received ICE configuration from signaling:', servers);
  webrtc.setIceServers(servers);
});

// UI Event Bindings
btnHeaderConnect.addEventListener('click', () => {
  if (signaling.isConnected) {
    signaling.disconnect();
    webrtc.close();
  } else {
    signaling.connect(inputServerUrl.value.trim(), inputRoomId.value.trim());
  }
});

btnSaveConfig.addEventListener('click', () => {
  const server = inputServerUrl.value.trim();
  const room = inputRoomId.value.trim();
  localStorage.setItem(STORAGE_SERVER, server);
  localStorage.setItem(STORAGE_ROOM, room);
  alert('Configuration saved! Reconnecting...');
  signaling.disconnect();
  signaling.connect(server, room);
});

// Audio & Video Viewport Controls
function setAudioMuted(isMuted) {
  remoteVideo.muted = isMuted;
  if (isMuted) {
    audioIcon.textContent = '🔇';
    audioText.textContent = 'Unmute';
    if (btnUnmuteOverlay) btnUnmuteOverlay.style.display = 'flex';
  } else {
    audioIcon.textContent = '🔊';
    audioText.textContent = 'Mute';
    if (btnUnmuteOverlay) btnUnmuteOverlay.style.display = 'none';
    const playPromise = remoteVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[App] Unmuted play was blocked by browser policy:', err);
      });
    }
  }
}

// Ensure initial state shows unmute overlay banner
setAudioMuted(true);

if (btnUnmuteOverlay) {
  btnUnmuteOverlay.addEventListener('click', () => {
    setAudioMuted(false);
  });
}

btnToggleAudio.addEventListener('click', () => {
  setAudioMuted(!remoteVideo.muted);
});

// Live Audio Booster Slider (0% - 300%)
if (volumeSlider && volumeValue) {
  volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    volumeValue.textContent = `${val}%`;
    webrtc.setVolume(val / 100.0);
  });
}

// Stream Recorder Controls (With Sound / Video Only)
if (btnRecordAudioToggle) {
  btnRecordAudioToggle.addEventListener('click', () => {
    const current = recorder.recordWithAudio;
    recorder.setAudioEnabled(!current);
  });
}

if (btnRecordVideo) {
  btnRecordVideo.addEventListener('click', () => {
    if (recorder.isRecording) {
      recorder.stop();
    } else {
      recorder.start();
    }
  });
}

recorder.onStateChange = (isRecording, elapsedSeconds, recordWithAudio) => {
  if (btnRecordAudioToggle) {
    btnRecordAudioToggle.textContent = recordWithAudio ? '🎙️ Audio: ON' : '🔇 Audio: OFF';
    btnRecordAudioToggle.classList.toggle('off', !recordWithAudio);
  }
  if (recordingBadge && recTimerText) {
    if (isRecording) {
      recordingBadge.style.display = 'inline-flex';
      const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const s = String(elapsedSeconds % 60).padStart(2, '0');
      recTimerText.textContent = `REC ${m}:${s}`;
    } else {
      recordingBadge.style.display = 'none';
    }
  }
  if (btnRecordVideo && recordIcon && recordText) {
    if (isRecording) {
      btnRecordVideo.classList.add('recording');
      recordIcon.textContent = '⏹️';
      recordText.textContent = 'Stop';
    } else {
      btnRecordVideo.classList.remove('recording');
      recordIcon.textContent = '⏺️';
      recordText.textContent = 'Record';
    }
  }
};

// Remote Message Broadcast Controls
quickChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const msg = chip.getAttribute('data-msg');
    if (inputPopupMessage && msg) {
      inputPopupMessage.value = msg;
    }
  });
});

if (btnSendPopupMsg) {
  btnSendPopupMsg.addEventListener('click', () => {
    const text = inputPopupMessage ? inputPopupMessage.value.trim() : '';
    if (!text) {
      alert('Please enter a message to broadcast to the phone.');
      return;
    }
    const duration = selectPopupDuration ? parseInt(selectPopupDuration.value, 10) : 30;
    const chime = checkPopupChime ? checkPopupChime.checked : true;
    controls.showPopupMessage(text, duration, chime);
    if (btnDismissPopupMsg) btnDismissPopupMsg.style.display = 'inline-block';
  });
}

if (btnDismissPopupMsg) {
  btnDismissPopupMsg.addEventListener('click', () => {
    controls.dismissPopupMessage();
    btnDismissPopupMsg.style.display = 'none';
  });
}

btnSnapshot.addEventListener('click', () => {
  if (!remoteVideo.videoWidth) {
    alert('No active video feed to capture.');
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = remoteVideo.videoWidth;
  canvas.height = remoteVideo.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(remoteVideo, 0, 0);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/jpeg');
  a.download = `cctv-snapshot-${Date.now()}.jpg`;
  a.click();
});

btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    remoteVideo.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
});

// Hardware Controls
btnTorch.addEventListener('click', () => {
  controls.toggleTorch(btnTorch);
});

btnSwitchLens.addEventListener('click', () => {
  controls.switchCamera(btnSwitchLens);
});

zoomSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  zoomValueText.textContent = `${(1 + (val / 100) * 4).toFixed(1)}x`;
  controls.setZoom(val);
});

presetPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    const val = pill.getAttribute('data-zoom');
    zoomSlider.value = val;
    zoomValueText.textContent = `${(1 + (val / 100) * 4).toFixed(1)}x`;
    controls.setZoom(val);
  });
});

btnSiren.addEventListener('click', () => {
  if (confirm('Are you sure you want to sound the deterrent alarm on the phone?')) {
    controls.triggerSiren();
  }
});

// Push to Talk (Mouse + Touch + Keyboard)
intercom.onVolume = (volume) => {
  if (pttVolumeContainer && pttMeterFill && pttVolumeVal) {
    const pct = Math.min(100, Math.round(volume * 2.2));
    pttMeterFill.style.width = `${pct}%`;
    pttVolumeVal.textContent = `${pct}%`;
  }
};

let pttPressStartTime = 0;
let isPttLocked = false;

function startPtt() {
  btnPtt.classList.add('transmitting');
  pttLabel.textContent = '🎙️ TRANSMITTING...';
  if (pttVolumeContainer) pttVolumeContainer.style.display = 'block';
  intercom.startTalking();
}

function stopPtt() {
  isPttLocked = false;
  btnPtt.classList.remove('transmitting');
  pttLabel.textContent = 'HOLD OR TAP TO TALK';
  if (pttVolumeContainer) {
    setTimeout(() => {
      if (!intercom.isTransmitting) {
        pttVolumeContainer.style.display = 'none';
        if (pttMeterFill) pttMeterFill.style.width = '0%';
      }
    }, 400);
  }
  intercom.stopTalking();
}

function handlePttPress(e) {
  if (e) e.preventDefault();

  if (isPttLocked) {
    // If locked in talking mode, another tap stops talking
    stopPtt();
    return;
  }

  pttPressStartTime = Date.now();
  startPtt();
}

function handlePttRelease(e) {
  if (e) e.preventDefault();
  if (!intercom.isTransmitting && !isPttLocked) return;

  const pressDuration = Date.now() - pttPressStartTime;
  if (pressDuration < 350 && !isPttLocked) {
    // Quick tap: toggle locked talking mode
    isPttLocked = true;
    pttLabel.textContent = '🔴 TALKING (Tap to Stop)';
  } else {
    // User held and released
    stopPtt();
  }
}

// Touch, Mouse, and Mobile events
btnPtt.addEventListener('contextmenu', (e) => e.preventDefault());
btnPtt.addEventListener('mousedown', handlePttPress);
window.addEventListener('mouseup', handlePttRelease);

btnPtt.addEventListener('touchstart', handlePttPress, { passive: false });
window.addEventListener('touchend', handlePttRelease, { passive: false });

// Keyboard Spacebar PTT shortcut
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    handlePttPress();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    handlePttRelease();
  }
});

// Live Device Health & Battery Header Badge
signaling.on('device_health', (payload) => {
  if (payload && payload.battery && headerBatteryPill && headerBatteryText && headerBatteryIcon) {
    const b = payload.battery;
    headerBatteryPill.style.display = 'inline-flex';
    headerBatteryText.textContent = `${b.percentage}% (${b.temperatureC}°C)`;
    headerBatteryIcon.textContent = b.isCharging ? '⚡' : (b.percentage < 20 ? '🪫' : '🔋');
    if (b.isCharging) {
      headerBatteryPill.classList.add('charging');
    } else {
      headerBatteryPill.classList.remove('charging');
    }
  }
});

// Mobile Bottom Tab Navigation
function switchMobileTab(tabKey) {
  mobileNavItems.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
  });

  // Close existing drawers
  if (sms.isOpen) sms.closeDrawer();
  if (health.isOpen) health.closeDrawer();
  if (calls.isOpen) calls.closeDrawer();

  if (tabKey === 'live') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tabKey === 'sms') {
    sms.openDrawer();
  } else if (tabKey === 'calls') {
    calls.openDrawer();
  } else if (tabKey === 'health') {
    health.openDrawer();
  } else if (tabKey === 'settings') {
    const sidebar = document.getElementById('sidebarControls');
    if (sidebar) sidebar.scrollIntoView({ behavior: 'smooth' });
  }
}

mobileNavItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabKey = btn.getAttribute('data-tab');
    switchMobileTab(tabKey);
  });
});

// Reset active tab to 'live' when a drawer is dismissed
[sms.smsDrawer, health.healthDrawer, calls.callsDrawer].forEach((drawer) => {
  if (drawer) {
    const observer = new MutationObserver(() => {
      if (!drawer.classList.contains('active')) {
        const anyActive = sms.isOpen || health.isOpen || calls.isOpen;
        if (!anyActive) {
          mobileNavItems.forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === 'live');
          });
        }
      }
    });
    observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
  }
});

// Mirror SMS unread count to mobile bottom navigation
signaling.on('sms_received', () => {
  if (mobileSmsBadge) {
    mobileSmsBadge.style.display = sms.unreadCount > 0 ? 'inline-block' : 'none';
    mobileSmsBadge.textContent = sms.unreadCount;
  }
});

// Auto-connect on page load
signaling.connect();
