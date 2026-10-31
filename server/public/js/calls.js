/**
 * Calls, Dialer & Audio Recording Manager for Cellular CCTV Dashboard.
 * Enables remote outgoing SIM calls, incoming call alerts, speakerphone bridging,
 * call logs history, and call recording management.
 */

export class CallManagerClient {
  constructor(signalingClient) {
    this.signaling = signalingClient;
    this.isOpen = false;
    this.activeTab = 'dialer'; // 'dialer', 'logs', 'recordings'
    this.callState = 'idle'; // 'idle', 'ringing', 'offhook'
    this.activeCallNumber = '';
    this.activeCallName = '';
    this.callTimerInterval = null;
    this.callStartTime = null;
    this.speakerphoneEnabled = true;

    this.callLogs = [];
    this.recordings = [];

    // DOM Elements
    this.btnOpenCalls = document.getElementById('btnOpenCalls');
    this.callsDrawer = document.getElementById('callsDrawer');
    this.callsBackdrop = document.getElementById('callsBackdrop');
    this.btnCloseCalls = document.getElementById('btnCloseCalls');
    this.btnRefreshCalls = document.getElementById('btnRefreshCalls');

    // Tabs
    this.tabButtons = document.querySelectorAll('.calls-tab-pill');
    this.tabSections = {
      dialer: document.getElementById('callTabDialer'),
      logs: document.getElementById('callTabLogs'),
      recordings: document.getElementById('callTabRecordings'),
    };

    // Dialer UI
    this.dialerInput = document.getElementById('dialerInput');
    this.btnDialCall = document.getElementById('btnDialCall');
    this.btnDialClear = document.getElementById('btnDialClear');
    this.dialKeys = document.querySelectorAll('.dial-key');

    // Active Call HUD
    this.activeCallBanner = document.getElementById('activeCallBanner');
    this.activeCallTitle = document.getElementById('activeCallTitle');
    this.activeCallSubtitle = document.getElementById('activeCallSubtitle');
    this.activeCallTimer = document.getElementById('activeCallTimer');
    this.btnEndActiveCall = document.getElementById('btnEndActiveCall');
    this.btnSpeakerphoneToggle = document.getElementById('btnSpeakerphoneToggle');

    // Incoming Call Modal / Floating Alert
    this.incomingCallAlert = document.getElementById('incomingCallAlert');
    this.incomingCallName = document.getElementById('incomingCallName');
    this.incomingCallNumber = document.getElementById('incomingCallNumber');
    this.btnAnswerIncoming = document.getElementById('btnAnswerIncoming');
    this.btnRejectIncoming = document.getElementById('btnRejectIncoming');

    // Logs & Recordings Containers
    this.callLogsList = document.getElementById('callLogsList');
    this.callLogsFilterPills = document.querySelectorAll('.call-log-filter-pill');
    this.activeLogFilter = 'all';
    this.recordingsList = document.getElementById('recordingsList');

    this.bindEvents();
    this.setupSignalingListeners();
  }

  bindEvents() {
    if (this.btnOpenCalls) {
      this.btnOpenCalls.addEventListener('click', () => this.openDrawer());
    }

    if (this.btnCloseCalls) {
      this.btnCloseCalls.addEventListener('click', () => this.closeDrawer());
    }

    if (this.callsBackdrop) {
      this.callsBackdrop.addEventListener('click', () => this.closeDrawer());
    }

    if (this.btnRefreshCalls) {
      this.btnRefreshCalls.addEventListener('click', () => {
        this.btnRefreshCalls.classList.add('rotating');
        this.fetchData();
        setTimeout(() => this.btnRefreshCalls.classList.remove('rotating'), 800);
      });
    }

    // Tab switching
    if (this.tabButtons) {
      this.tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.tabButtons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeTab = btn.getAttribute('data-tab');
          this.switchTab(this.activeTab);
        });
      });
    }

    // Dialpad digits
    if (this.dialKeys) {
      this.dialKeys.forEach((key) => {
        key.addEventListener('click', () => {
          const val = key.getAttribute('data-val');
          if (this.dialerInput) {
            this.dialerInput.value += val;
          }
        });
      });
    }

    // Clear dialer
    if (this.btnDialClear) {
      this.btnDialClear.addEventListener('click', () => {
        if (this.dialerInput) this.dialerInput.value = '';
      });
    }

    // Make call button
    if (this.btnDialCall) {
      this.btnDialCall.addEventListener('click', () => {
        const number = this.dialerInput?.value?.trim();
        if (number) {
          this.makeCall(number);
        }
      });
    }

    // End active call button
    if (this.btnEndActiveCall) {
      this.btnEndActiveCall.addEventListener('click', () => {
        this.signaling.endCall();
        this.setCallState('idle');
      });
    }

    // Toggle Speakerphone
    if (this.btnSpeakerphoneToggle) {
      this.btnSpeakerphoneToggle.addEventListener('click', () => {
        this.speakerphoneEnabled = !this.speakerphoneEnabled;
        this.signaling.toggleSpeakerphone(this.speakerphoneEnabled);
        this.btnSpeakerphoneToggle.textContent = this.speakerphoneEnabled
          ? '🔊 Speakerphone: ON'
          : '🔈 Speakerphone: OFF';
      });
    }

    // Answer incoming call
    if (this.btnAnswerIncoming) {
      this.btnAnswerIncoming.addEventListener('click', () => {
        this.signaling.answerCall();
        if (this.incomingCallAlert) this.incomingCallAlert.style.display = 'none';
        this.setCallState('offhook', this.activeCallNumber, this.activeCallName);
      });
    }

    // Reject incoming call
    if (this.btnRejectIncoming) {
      this.btnRejectIncoming.addEventListener('click', () => {
        this.signaling.endCall();
        if (this.incomingCallAlert) this.incomingCallAlert.style.display = 'none';
        this.setCallState('idle');
      });
    }

    // Call logs filter pills
    if (this.callLogsFilterPills) {
      this.callLogsFilterPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          this.callLogsFilterPills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeLogFilter = pill.getAttribute('data-filter') || 'all';
          this.renderCallLogs();
        });
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeDrawer();
      }
    });
  }

  setupSignalingListeners() {
    this.signaling.on('call_state', (payload) => {
      if (!payload) return;
      this.setCallState(payload.state, payload.number, payload.name);
    });

    this.signaling.on('call_logs', (payload) => {
      if (!payload || !Array.isArray(payload.logs)) return;
      this.callLogs = payload.logs;
      this.renderCallLogs();
    });

    this.signaling.on('call_recordings', (payload) => {
      if (!payload || !Array.isArray(payload.recordings)) return;
      this.recordings = payload.recordings;
      this.renderRecordings();
    });

    this.signaling.on('connected', () => {
      this.signaling.requestCallLogs();
    });
  }

  openDrawer() {
    this.isOpen = true;
    if (this.callsDrawer) this.callsDrawer.classList.add('active');
    if (this.callsBackdrop) this.callsBackdrop.classList.add('active');
    this.fetchData();
  }

  closeDrawer() {
    this.isOpen = false;
    if (this.callsDrawer) this.callsDrawer.classList.remove('active');
    if (this.callsBackdrop) this.callsBackdrop.classList.remove('active');
  }

  fetchData() {
    this.signaling.requestCallLogs();
    this.signaling.requestCallRecordings();
  }

  switchTab(tabName) {
    Object.keys(this.tabSections).forEach((key) => {
      const section = this.tabSections[key];
      if (section) {
        section.style.display = key === tabName ? 'block' : 'none';
      }
    });
    if (tabName === 'logs') this.signaling.requestCallLogs();
    if (tabName === 'recordings') this.signaling.requestCallRecordings();
  }

  makeCall(number) {
    this.activeCallNumber = number;
    this.activeCallName = '';
    this.signaling.makeCall(number);
    this.setCallState('ringing', number, '');
  }

  setCallState(state, number = '', name = '') {
    this.callState = state;
    this.activeCallNumber = number || this.activeCallNumber;
    this.activeCallName = name || this.activeCallName;

    const displayName = this.activeCallName || this.activeCallNumber || 'Unknown';

    if (state === 'ringing') {
      // Show incoming modal alert
      if (this.incomingCallAlert) {
        if (this.incomingCallName) this.incomingCallName.textContent = displayName;
        if (this.incomingCallNumber) this.incomingCallNumber.textContent = this.activeCallNumber;
        this.incomingCallAlert.style.display = 'flex';
      }
      this.showActiveCallBanner('RINGING...', displayName, false);
      this.stopTimer();
    } else if (state === 'offhook') {
      if (this.incomingCallAlert) this.incomingCallAlert.style.display = 'none';
      this.showActiveCallBanner('CALL ACTIVE (SPEAKERPHONE)', displayName, true);
      this.startTimer();
    } else {
      // idle
      if (this.incomingCallAlert) this.incomingCallAlert.style.display = 'none';
      this.hideActiveCallBanner();
      this.stopTimer();
      // Auto refresh logs when call ends
      setTimeout(() => this.signaling.requestCallLogs(), 2000);
    }
  }

  showActiveCallBanner(title, subtitle, isConnected) {
    if (!this.activeCallBanner) return;
    this.activeCallBanner.style.display = 'flex';
    if (this.activeCallTitle) this.activeCallTitle.textContent = title;
    if (this.activeCallSubtitle) this.activeCallSubtitle.textContent = subtitle;
    this.activeCallBanner.className = isConnected
      ? 'active-call-banner connected animate-pulse'
      : 'active-call-banner ringing';
  }

  hideActiveCallBanner() {
    if (this.activeCallBanner) this.activeCallBanner.style.display = 'none';
  }

  startTimer() {
    this.stopTimer();
    this.callStartTime = Date.now();
    this.callTimerInterval = setInterval(() => {
      if (!this.callStartTime || !this.activeCallTimer) return;
      const elapsedSec = Math.floor((Date.now() - this.callStartTime) / 1000);
      const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const s = String(elapsedSec % 60).padStart(2, '0');
      this.activeCallTimer.textContent = `${m}:${s}`;
    }, 1000);
  }

  stopTimer() {
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    this.callTimerInterval = null;
    this.callStartTime = null;
    if (this.activeCallTimer) this.activeCallTimer.textContent = '00:00';
  }

  renderCallLogs() {
    if (!this.callLogsList) return;

    const filtered = this.callLogs.filter((log) => {
      if (this.activeLogFilter === 'all') return true;
      return log.type === this.activeLogFilter;
    });

    if (filtered.length === 0) {
      this.callLogsList.innerHTML = `
        <div class="call-empty-state">
          <div class="call-empty-icon">📞</div>
          <p class="call-empty-title">No call logs found</p>
          <p class="call-empty-desc">Your SIM call history will appear here.</p>
        </div>
      `;
      return;
    }

    this.callLogsList.innerHTML = filtered
      .map((log) => {
        const typeBadge =
          log.type === 'incoming'
            ? '<span class="call-badge badge-incoming">📥 INCOMING</span>'
            : log.type === 'outgoing'
            ? '<span class="call-badge badge-outgoing">📤 OUTGOING</span>'
            : '<span class="call-badge badge-missed">❌ MISSED</span>';

        const displayName = log.name || log.number;

        return `
          <div class="call-card ${log.type}">
            <div class="call-card-top">
              <div class="call-party-details">
                ${typeBadge}
                <strong class="call-contact-name">${this.escapeHtml(displayName)}</strong>
                ${
                  log.name
                    ? `<span class="call-phone-pill">${this.escapeHtml(log.number)}</span>`
                    : ''
                }
              </div>
              <button class="call-redial-btn" data-number="${this.escapeHtml(log.number)}" title="Dial this number">
                📞 Redial
              </button>
            </div>
            <div class="call-card-bottom">
              <span>🕒 ${this.escapeHtml(log.dateTime)}</span>
              <span>⏱️ Duration: <strong>${this.escapeHtml(log.durationFormatted)}</strong></span>
            </div>
          </div>
        `;
      })
      .join('');

    // Redial button handlers
    this.callLogsList.querySelectorAll('.call-redial-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-number');
        if (num) {
          if (this.dialerInput) this.dialerInput.value = num;
          this.switchTab('dialer');
          const tabBtn = document.querySelector('.calls-tab-pill[data-tab="dialer"]');
          if (tabBtn) {
            this.tabButtons.forEach((b) => b.classList.remove('active'));
            tabBtn.classList.add('active');
          }
        }
      });
    });
  }

  renderRecordings() {
    if (!this.recordingsList) return;

    if (this.recordings.length === 0) {
      this.recordingsList.innerHTML = `
        <div class="call-empty-state">
          <div class="call-empty-icon">🎙️</div>
          <p class="call-empty-title">No recordings yet</p>
          <p class="call-empty-desc">Calls answered or made on speakerphone are automatically recorded and saved on the phone.</p>
        </div>
      `;
      return;
    }

    this.recordingsList.innerHTML = this.recordings
      .map((rec) => {
        const sizeMb = (rec.sizeBytes / (1024 * 1024)).toFixed(2);
        return `
          <div class="recording-card">
            <div class="recording-header">
              <span class="recording-name">${this.escapeHtml(rec.filename)}</span>
              <span class="recording-size">${sizeMb} MB</span>
            </div>
            <div class="recording-meta">
              <span>Recorded: ${this.escapeHtml(rec.dateTime)}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
