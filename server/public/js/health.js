/**
 * Device Health & Diagnostics Manager for Cellular CCTV Dashboard.
 * Monitors battery & thermals, storage space, top space-consuming apps, RAM, uptime, and system time.
 */

export class HealthManager {
  constructor(signalingClient) {
    this.signaling = signalingClient;
    this.isOpen = false;
    this.latestHealthData = null;

    // DOM Elements
    this.btnOpenHealth = document.getElementById('btnOpenHealth');
    this.healthDrawer = document.getElementById('healthDrawer');
    this.healthBackdrop = document.getElementById('healthBackdrop');
    this.btnCloseHealth = document.getElementById('btnCloseHealth');
    this.btnRefreshHealth = document.getElementById('btnRefreshHealth');

    // Telemetry fields
    this.batteryPercent = document.getElementById('healthBatteryPercent');
    this.batteryFill = document.getElementById('healthBatteryFill');
    this.batteryStatus = document.getElementById('healthBatteryStatus');
    this.batteryTemp = document.getElementById('healthBatteryTemp');
    this.batteryHealth = document.getElementById('healthBatteryHealth');

    this.storageUsedText = document.getElementById('healthStorageUsedText');
    this.storageTotalText = document.getElementById('healthStorageTotalText');
    this.storageFreeText = document.getElementById('healthStorageFreeText');
    this.storageFill = document.getElementById('healthStorageFill');
    this.topAppsList = document.getElementById('healthTopAppsList');

    this.memoryUsedText = document.getElementById('healthMemoryUsedText');
    this.memoryTotalText = document.getElementById('healthMemoryTotalText');
    this.memoryFill = document.getElementById('healthMemoryFill');

    this.systemModel = document.getElementById('healthSystemModel');
    this.systemAndroid = document.getElementById('healthSystemAndroid');
    this.systemUptime = document.getElementById('healthSystemUptime');
    this.systemTime = document.getElementById('healthSystemTime');

    this.bindEvents();
    this.setupSignalingListeners();
  }

  bindEvents() {
    if (this.btnOpenHealth) {
      this.btnOpenHealth.addEventListener('click', () => this.openDrawer());
    }

    if (this.btnCloseHealth) {
      this.btnCloseHealth.addEventListener('click', () => this.closeDrawer());
    }

    if (this.healthBackdrop) {
      this.healthBackdrop.addEventListener('click', () => this.closeDrawer());
    }

    if (this.btnRefreshHealth) {
      this.btnRefreshHealth.addEventListener('click', () => {
        this.btnRefreshHealth.classList.add('rotating');
        this.signaling.requestDeviceHealth();
        setTimeout(() => this.btnRefreshHealth.classList.remove('rotating'), 800);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeDrawer();
      }
    });
  }

  setupSignalingListeners() {
    this.signaling.on('device_health', (payload) => {
      if (!payload) return;
      this.latestHealthData = payload;
      this.renderHealth(payload);
    });

    // Auto-fetch on connect
    this.signaling.on('connected', () => {
      setTimeout(() => {
        this.signaling.requestDeviceHealth();
      }, 1000);
    });
  }

  openDrawer() {
    this.isOpen = true;
    if (this.healthDrawer) this.healthDrawer.classList.add('active');
    if (this.healthBackdrop) this.healthBackdrop.classList.add('active');

    // Always fetch latest data when opening
    this.signaling.requestDeviceHealth();
  }

  closeDrawer() {
    this.isOpen = false;
    if (this.healthDrawer) this.healthDrawer.classList.remove('active');
    if (this.healthBackdrop) this.healthBackdrop.classList.remove('active');
  }

  renderHealth(data) {
    if (!data) return;

    // 1. Battery & Thermals
    const battery = data.battery || {};
    const percent = battery.percentage !== undefined ? battery.percentage : '--';
    if (this.batteryPercent) this.batteryPercent.textContent = `${percent}%`;
    if (this.batteryFill) {
      this.batteryFill.style.width = `${Math.max(5, Math.min(100, percent))}%`;
      if (battery.isCharging) {
        this.batteryFill.style.background = 'linear-gradient(90deg, #00e676, #00e5ff)';
      } else if (percent < 20) {
        this.batteryFill.style.background = '#ff1744';
      } else {
        this.batteryFill.style.background = 'var(--accent-cyan)';
      }
    }

    if (this.batteryStatus) {
      const chargeText = battery.isCharging
        ? `⚡ Charging (${battery.chargeSource || 'Plugged'})`
        : `🔋 ${battery.chargeSource || 'Discharging'}`;
      this.batteryStatus.textContent = chargeText;
    }

    if (this.batteryTemp) {
      const tempC = battery.temperatureC !== undefined ? battery.temperatureC.toFixed(1) : '--';
      this.batteryTemp.textContent = `${tempC}°C`;
      if (tempC > 44) {
        this.batteryTemp.style.color = '#ff1744';
      } else if (tempC > 38) {
        this.batteryTemp.style.color = '#ffab00';
      } else {
        this.batteryTemp.style.color = '#00e676';
      }
    }

    if (this.batteryHealth) {
      this.batteryHealth.textContent = battery.health || 'Good';
    }

    // 2. Storage
    const storage = data.storage || {};
    if (this.storageUsedText) this.storageUsedText.textContent = storage.usedFormatted || '--';
    if (this.storageTotalText) this.storageTotalText.textContent = storage.totalFormatted || '--';
    if (this.storageFreeText) this.storageFreeText.textContent = `${storage.freeFormatted || '--'} free`;
    if (this.storageFill) {
      const usedPct = storage.usedPercent || 0;
      this.storageFill.style.width = `${usedPct}%`;
      if (usedPct > 90) {
        this.storageFill.style.background = '#ff1744';
      } else if (usedPct > 75) {
        this.storageFill.style.background = '#ffab00';
      } else {
        this.storageFill.style.background = 'var(--accent-cyan)';
      }
    }

    // 3. Top Space Consuming Apps
    const topApps = data.topApps || [];
    if (this.topAppsList) {
      if (topApps.length === 0) {
        this.topAppsList.innerHTML = `<div class="health-empty-apps">No app space data available</div>`;
      } else {
        const maxAppSize = topApps[0]?.sizeBytes || 1;
        this.topAppsList.innerHTML = topApps
          .map((app, index) => {
            const pctOfMax = Math.round((app.sizeBytes / maxAppSize) * 100);
            return `
              <div class="health-app-row">
                <div class="health-app-rank">#${index + 1}</div>
                <div class="health-app-info">
                  <div class="health-app-header">
                    <span class="health-app-name" title="${this.escapeHtml(app.packageName)}">
                      ${this.escapeHtml(app.name)}
                    </span>
                    <span class="health-app-size">${app.sizeFormatted}</span>
                  </div>
                  <div class="health-app-bar-bg">
                    <div class="health-app-bar-fill" style="width: ${pctOfMax}%;"></div>
                  </div>
                  <div class="health-app-pkg">${this.escapeHtml(app.packageName)}</div>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    // 4. Memory / RAM
    const memory = data.memory || {};
    if (this.memoryUsedText) this.memoryUsedText.textContent = memory.usedFormatted || '--';
    if (this.memoryTotalText) this.memoryTotalText.textContent = memory.totalFormatted || '--';
    if (this.memoryFill) {
      const ramPct = memory.usedPercent || 0;
      this.memoryFill.style.width = `${ramPct}%`;
      if (ramPct > 85) {
        this.memoryFill.style.background = '#ff1744';
      } else {
        this.memoryFill.style.background = '#b388ff';
      }
    }

    // 5. System & Uptime
    const sys = data.system || {};
    if (this.systemModel) this.systemModel.textContent = sys.deviceModel || '--';
    if (this.systemAndroid) this.systemAndroid.textContent = sys.androidVersion || '--';
    if (this.systemUptime) this.systemUptime.textContent = sys.uptimeFormatted || '--';
    if (this.systemTime) {
      this.systemTime.textContent = `${sys.localTime || '--'} (${sys.timezone || ''})`;
    }
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
