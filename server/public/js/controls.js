/**
 * Remote Hardware Controls Module.
 */
export class RemoteControls {
  constructor(signaling, videoElement = null) {
    this.signaling = signaling;
    this.videoElement = videoElement;
    this.isTorchOn = false;
    this.currentLens = 'back'; // 'back' or 'front'
    this.zoomLevel = 0.0;
  }

  toggleTorch(buttonElement) {
    this.isTorchOn = !this.isTorchOn;
    console.log('[Controls] Toggling torch:', this.isTorchOn);
    this.signaling.sendCommand('toggle_torch', { enabled: this.isTorchOn });

    if (buttonElement) {
      if (this.isTorchOn) {
        buttonElement.classList.add('active');
        buttonElement.textContent = '🔦 Flashlight: ON';
      } else {
        buttonElement.classList.remove('active');
        buttonElement.textContent = '🔦 Flashlight: OFF';
      }
    }
    return this.isTorchOn;
  }

  switchCamera(buttonElement) {
    this.currentLens = this.currentLens === 'back' ? 'front' : 'back';
    console.log('[Controls] Switching camera to:', this.currentLens);
    this.signaling.sendCommand('switch_camera');

    if (buttonElement) {
      buttonElement.textContent = this.currentLens === 'back' ? '🔄 Switch to Front Camera' : '🔄 Switch to Rear Camera';
    }
  }

  setZoom(zoomPercent) {
    // zoomPercent from 0 to 100 maps to 1.0x to 5.0x zoom
    this.zoomLevel = Math.max(0, Math.min(100, zoomPercent)) / 100.0;
    const scaleFactor = 1.0 + (this.zoomLevel * 4.0); // 1.0x to 5.0x
    console.log(`[Controls] Setting zoom: ${scaleFactor.toFixed(1)}x (normalized: ${this.zoomLevel})`);

    // 1. Instant hardware-accelerated CSS viewport zoom on video element
    if (this.videoElement) {
      this.videoElement.style.transform = `scale(${scaleFactor})`;
      this.videoElement.style.transformOrigin = 'center center';
      this.videoElement.style.transition = 'transform 0.15s ease-out';
    }

    // 2. Hardware crop zoom request to camera on phone
    this.signaling.sendCommand('set_zoom', { zoom: this.zoomLevel });
  }

  triggerSiren() {
    console.log('[Controls] Triggering security siren');
    this.signaling.sendCommand('trigger_siren');
  }

  pushOtaUpdate() {
    console.log('[Controls] Dispatching OTA update command to camera');
    this.signaling.sendCommand('check_update', { force: true });
    alert('🚀 OTA update command sent! The camera phone will download and apply the update over cellular data / Wi-Fi.');
  }


  showPopupMessage(text, durationSeconds = 30, soundChime = true) {
    console.log(`[Controls] Broadcasting message to phone screen: "${text}" (${durationSeconds}s)`);
    this.signaling.sendCommand('show_popup_message', {
      text,
      durationSeconds: parseInt(durationSeconds, 10) || 30,
      soundChime: !!soundChime
    });
  }

  dismissPopupMessage() {
    console.log('[Controls] Dismissing popup message from phone screen');
    this.signaling.sendCommand('dismiss_popup_message');
  }
}

