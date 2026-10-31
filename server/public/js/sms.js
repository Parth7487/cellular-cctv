/**
 * SMS & OTP Manager for Cellular CCTV Dashboard.
 * Displays SIM messages relayed live from the Android phone over WebRTC/WebSocket.
 * Provides instant OTP detection and 1-click clipboard copy.
 * Tracks message type (Sent / Received), contact name or phone number, and exact date & time.
 */

export class SmsManager {
  constructor(signalingClient) {
    this.signaling = signalingClient;
    this.messages = [];
    this.unreadCount = 0;
    this.isOpen = false;
    this.activeFilter = 'all'; // 'all', 'received', 'sent'

    // DOM Elements
    this.btnOpenSms = document.getElementById('btnOpenSms');
    this.smsUnreadBadge = document.getElementById('smsUnreadBadge');
    this.smsDrawer = document.getElementById('smsDrawer');
    this.smsBackdrop = document.getElementById('smsBackdrop');
    this.btnCloseSms = document.getElementById('btnCloseSms');
    this.btnRefreshSms = document.getElementById('btnRefreshSms');
    this.smsSearchInput = document.getElementById('smsSearchInput');
    this.smsListContainer = document.getElementById('smsListContainer');
    this.toastContainer = document.getElementById('smsToastContainer');
    this.filterPills = document.querySelectorAll('.sms-filter-pill');

    this.bindEvents();
    this.setupSignalingListeners();
  }

  bindEvents() {
    if (this.btnOpenSms) {
      this.btnOpenSms.addEventListener('click', () => this.openDrawer());
    }

    if (this.btnCloseSms) {
      this.btnCloseSms.addEventListener('click', () => this.closeDrawer());
    }

    if (this.smsBackdrop) {
      this.smsBackdrop.addEventListener('click', () => this.closeDrawer());
    }

    if (this.btnRefreshSms) {
      this.btnRefreshSms.addEventListener('click', () => {
        this.btnRefreshSms.classList.add('rotating');
        this.signaling.requestSmsHistory();
        setTimeout(() => this.btnRefreshSms.classList.remove('rotating'), 800);
      });
    }

    if (this.smsSearchInput) {
      this.smsSearchInput.addEventListener('input', () => this.renderList());
    }

    if (this.filterPills) {
      this.filterPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          this.filterPills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeFilter = pill.getAttribute('data-filter') || 'all';
          this.renderList();
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
    // When a single new SMS arrives live
    this.signaling.on('sms_received', (payload) => {
      if (!payload) return;
      this.addMessage(payload, true);
    });

    // When phone returns full history
    this.signaling.on('sms_history', (payload) => {
      if (!payload || !Array.isArray(payload.messages)) return;
      payload.messages.forEach((msg) => this.addMessage(msg, false));
      this.renderList();
    });

    // When connection is established, auto-fetch history
    this.signaling.on('connected', () => {
      setTimeout(() => {
        this.signaling.requestSmsHistory();
      }, 1500);
    });
  }

  openDrawer() {
    this.isOpen = true;
    if (this.smsDrawer) this.smsDrawer.classList.add('active');
    if (this.smsBackdrop) this.smsBackdrop.classList.add('active');
    this.clearUnread();
    this.renderList();
  }

  closeDrawer() {
    this.isOpen = false;
    if (this.smsDrawer) this.smsDrawer.classList.remove('active');
    if (this.smsBackdrop) this.smsBackdrop.classList.remove('active');
  }

  addMessage(rawMsg, isNewLive = false) {
    if (!rawMsg) return;

    const msg = this.normalizeMessage(rawMsg);
    if (!msg.address && !msg.sender) return;

    // Check for duplicate by signature
    const exists = this.messages.some(
      (m) =>
        m.address === msg.address &&
        m.type === msg.type &&
        Math.abs(m.timestamp - msg.timestamp) < 2500
    );
    if (exists) return;

    this.messages.unshift(msg);
    // Sort descending by timestamp
    this.messages.sort((a, b) => b.timestamp - a.timestamp);

    // Keep max 150 messages
    if (this.messages.length > 150) this.messages.pop();

    if (isNewLive) {
      if (!this.isOpen) {
        this.unreadCount++;
        this.updateUnreadBadge();
      }
      this.showLiveToast(msg);
      this.renderList();
    }
  }

  normalizeMessage(raw) {
    const address = raw.address || raw.sender || 'Unknown';
    const name = raw.name || '';
    const type = raw.type === 'sent' ? 'sent' : 'received';
    const timestamp = raw.timestamp || Date.now();
    const dateTime = raw.dateTime || this.formatFullDateTime(timestamp);
    const body = raw.body || '';

    return {
      id: raw.id || `msg_${timestamp}`,
      type,
      address,
      name,
      sender: name ? `${name} (${address})` : address,
      body,
      timestamp,
      dateTime,
    };
  }

  updateUnreadBadge() {
    if (!this.smsUnreadBadge) return;
    if (this.unreadCount > 0) {
      this.smsUnreadBadge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      this.smsUnreadBadge.style.display = 'inline-flex';
    } else {
      this.smsUnreadBadge.style.display = 'none';
    }
  }

  clearUnread() {
    this.unreadCount = 0;
    this.updateUnreadBadge();
  }

  /**
   * Extracts OTP or verification code from SMS message text.
   */
  extractOtp(text) {
    if (!text) return null;
    const contextRegex = /(?:otp|code|pin|passcode|verification|secret|cctv)[:\s-]*([0-9]{4,8})\b/i;
    const match = text.match(contextRegex);
    if (match && match[1]) return match[1];

    const standaloneRegex = /\b([0-9]{4,8})\b/;
    const fallbackMatch = text.match(standaloneRegex);
    if (fallbackMatch && fallbackMatch[1]) {
      const val = parseInt(fallbackMatch[1], 10);
      if (val >= 2020 && val <= 2030 && fallbackMatch[1].length === 4) return null;
      return fallbackMatch[1];
    }
    return null;
  }

  formatFullDateTime(ts) {
    if (!ts) return 'Unknown Time';
    const d = new Date(ts);
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  formatRelativeTime(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diffSec = Math.floor((now - ts) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    return `${days}d ago`;
  }

  renderList() {
    if (!this.smsListContainer) return;

    const query = (this.smsSearchInput?.value || '').toLowerCase().trim();

    const filtered = this.messages.filter((m) => {
      // 1. Filter by direction/type
      if (this.activeFilter === 'received' && m.type !== 'received') return false;
      if (this.activeFilter === 'sent' && m.type !== 'sent') return false;

      // 2. Search query filter
      if (!query) return true;
      return (
        m.address.toLowerCase().includes(query) ||
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.body && m.body.toLowerCase().includes(query)) ||
        (m.dateTime && m.dateTime.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      this.smsListContainer.innerHTML = `
        <div class="sms-empty-state">
          <div class="sms-empty-icon">📬</div>
          <p class="sms-empty-title">${query ? 'No matching messages' : 'No messages found'}</p>
          <p class="sms-empty-desc">${
            query
              ? 'Try a different search term.'
              : this.activeFilter !== 'all'
              ? `No ${this.activeFilter} messages found.`
              : 'Incoming SIM SMS and OTPs will appear here in real-time. Click Refresh to pull existing messages.'
          }</p>
        </div>
      `;
      return;
    }

    this.smsListContainer.innerHTML = filtered
      .map((msg) => {
        const otp = this.extractOtp(msg.body);
        const relativeTime = this.formatRelativeTime(msg.timestamp);
        const isReceived = msg.type === 'received';
        const typeBadgeText = isReceived ? '📥 RECEIVED' : '📤 SENT';
        const typeBadgeClass = isReceived ? 'badge-received' : 'badge-sent';
        const partyLabel = isReceived ? 'From' : 'To';
        const displayName = msg.name || msg.address;

        return `
          <div class="sms-card ${isReceived ? 'type-received' : 'type-sent'}">
            <div class="sms-card-header">
              <div class="sms-party-info">
                <span class="sms-type-badge ${typeBadgeClass}">${typeBadgeText}</span>
                <span class="sms-party-label">${partyLabel}:</span>
                <span class="sms-contact-name" title="${this.escapeHtml(displayName)}">
                  ${this.escapeHtml(displayName)}
                </span>
                ${
                  msg.name
                    ? `<span class="sms-phone-pill">${this.escapeHtml(msg.address)}</span>`
                    : ''
                }
              </div>
              <span class="sms-relative-time">${relativeTime}</span>
            </div>

            <!-- Content of each SMS / MMS -->
            <div class="sms-body">${this.highlightOtpInText(this.escapeHtml(msg.body), otp)}</div>

            <!-- Full Date & Time footer -->
            <div class="sms-card-footer">
              <span class="sms-exact-time" title="Exact timestamp">
                🕒 ${this.escapeHtml(msg.dateTime || this.formatFullDateTime(msg.timestamp))}
              </span>
              ${
                otp
                  ? `<button class="sms-copy-btn" data-otp="${otp}" title="Copy OTP to clipboard">
                       📋 Copy OTP: <strong>${otp}</strong>
                     </button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    // Attach copy button listeners
    this.smsListContainer.querySelectorAll('.sms-copy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const otp = btn.getAttribute('data-otp');
        this.copyToClipboard(otp, btn);
      });
    });
  }

  showLiveToast(msg) {
    if (!this.toastContainer) return;

    const otp = this.extractOtp(msg.body);
    const toast = document.createElement('div');
    const isReceived = msg.type === 'received';
    toast.className = `sms-toast animate-slide-in ${isReceived ? 'toast-received' : 'toast-sent'}`;

    const partyLabel = isReceived ? 'From' : 'To';
    const displayName = msg.name || msg.address;

    toast.innerHTML = `
      <div class="sms-toast-icon">${isReceived ? '📥' : '📤'}</div>
      <div class="sms-toast-content">
        <div class="sms-toast-header">
          <div>
            <span class="sms-toast-type">${isReceived ? 'NEW INCOMING SMS' : 'SENT SMS'}</span>
            <strong class="sms-toast-party">${partyLabel}: ${this.escapeHtml(displayName)}</strong>
          </div>
          <span class="sms-toast-time">Just now</span>
        </div>
        <div class="sms-toast-body">${this.escapeHtml(msg.body)}</div>
        <div class="sms-toast-meta">
          <span>🕒 ${this.escapeHtml(msg.dateTime || this.formatFullDateTime(msg.timestamp))}</span>
        </div>
        ${
          otp
            ? `<div class="sms-toast-action">
                 <button class="sms-toast-copy-btn" data-otp="${otp}">
                   📋 Copy OTP: <strong>${otp}</strong>
                 </button>
               </div>`
            : ''
        }
      </div>
      <button class="sms-toast-close" title="Dismiss">✕</button>
    `;

    // Toast copy action
    const copyBtn = toast.querySelector('.sms-toast-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(otp, copyBtn);
      });
    }

    // Dismiss
    const closeBtn = toast.querySelector('.sms-toast-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toast.remove();
    });

    // Clicking toast opens drawer
    toast.addEventListener('click', () => {
      this.openDrawer();
      toast.remove();
    });

    this.toastContainer.appendChild(toast);

    // Auto-remove after 9 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 400);
      }
    }, 9000);
  }

  copyToClipboard(text, buttonElement) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (buttonElement) {
        const originalHtml = buttonElement.innerHTML;
        buttonElement.innerHTML = '✓ Copied!';
        buttonElement.classList.add('copied');
        setTimeout(() => {
          buttonElement.innerHTML = originalHtml;
          buttonElement.classList.remove('copied');
        }, 2000);
      }
    }).catch((err) => {
      console.error('Failed to copy OTP: ', err);
    });
  }

  highlightOtpInText(escapedText, otp) {
    if (!otp) return escapedText;
    const regex = new RegExp(`\\b(${otp})\\b`, 'g');
    return escapedText.replace(regex, '<mark class="sms-otp-highlight">$1</mark>');
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
