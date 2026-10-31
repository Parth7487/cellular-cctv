/**
 * Push-to-Talk (PTT) Two-Way Audio Intercom.
 */
export class Intercom {
  constructor(webrtcViewer) {
    this.webrtcViewer = webrtcViewer;
    this.localStream = null;
    this.audioTrack = null;
    this.isTransmitting = false;
    this.audioContext = null;
    this.analyser = null;
    this.animFrame = null;
    this.onVolume = null; // optional callback for visual volume feedback
  }

  async initMic() {
    if (this.localStream && this.audioTrack && this.audioTrack.readyState === 'live') {
      return this.localStream;
    }
    try {
      console.log('[Intercom] Requesting microphone access...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.audioTrack = this.localStream.getAudioTracks()[0];
      this.audioTrack.enabled = false; // Muted by default until PTT pressed
      console.log('[Intercom] Microphone initialized (muted standby).');

      // Setup audio analyzer for volume meter
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          const source = this.audioContext.createMediaStreamSource(this.localStream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          source.connect(this.analyser);
        }
      } catch (e) {
        console.warn('[Intercom] Web Audio analyzer setup warning:', e);
      }

      this.attachTrackToPeer();
      return this.localStream;
    } catch (err) {
      console.error('[Intercom] Microphone access denied or unavailable:', err);
      throw err;
    }
  }

  attachTrackToPeer() {
    const pc = this.webrtcViewer.peerConnection;
    if (!pc || !this.audioTrack) return;

    // First try replacing track on existing audio sender
    const senders = pc.getSenders();
    const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');

    if (audioSender) {
      audioSender.replaceTrack(this.audioTrack);
      console.log('[Intercom] Bound audio track to existing sender');
      return;
    }

    // Try finding an audio transceiver without a track
    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find((t) => t.sender && (!t.sender.track || t.sender.track.kind === 'audio'));
    if (audioTransceiver && audioTransceiver.sender) {
      audioTransceiver.sender.replaceTrack(this.audioTrack);
      audioTransceiver.direction = 'sendrecv';
      console.log('[Intercom] Bound audio track to transceiver sender');
      return;
    }

    // Fallback: addTrack
    try {
      pc.addTrack(this.audioTrack, this.localStream);
      console.log('[Intercom] Added audio track to peer connection');
    } catch (e) {
      console.warn('[Intercom] addTrack notice:', e);
    }
  }

  async startTalking() {
    if (this.isTransmitting) return;

    try {
      await this.initMic();
    } catch (err) {
      alert('Microphone access is required for Push-to-Talk.\nPlease allow microphone permission in your browser address bar.');
      return;
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (this.audioTrack) {
      this.audioTrack.enabled = true;
    }

    const audioTransceiver = this.webrtcViewer.getAudioTransceiver();
    if (audioTransceiver && audioTransceiver.sender && this.audioTrack) {
      try {
        await audioTransceiver.sender.replaceTrack(this.audioTrack);
        console.log('[Intercom] Active mic track swapped into WebRTC sender (live voice to speakerphone)');
      } catch (e) {
        console.warn('[Intercom] Error replacing track on audio sender:', e);
        this.attachTrackToPeer();
      }
    } else {
      this.attachTrackToPeer();
    }

    this.isTransmitting = true;
    console.log('[Intercom] TRANSMITTING audio to camera phone speaker...');
    this.startVolumeMeter();
  }

  stopTalking() {
    if (!this.isTransmitting) return;

    if (this.audioTrack) {
      this.audioTrack.enabled = false;
    }

    const audioTransceiver = this.webrtcViewer.getAudioTransceiver();
    const silentTrack = this.webrtcViewer.getOrCreateSilentTrack();
    if (audioTransceiver && audioTransceiver.sender && silentTrack) {
      audioTransceiver.sender.replaceTrack(silentTrack).catch(() => {});
      console.log('[Intercom] Swapped silent track back into WebRTC sender (muted)');
    }

    this.isTransmitting = false;
    this.stopVolumeMeter();
    console.log('[Intercom] Stopped transmitting. Mic muted.');
  }

  startVolumeMeter() {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const loop = () => {
      if (!this.isTransmitting) return;
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      if (this.onVolume) this.onVolume(avg);
      this.animFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  stopVolumeMeter() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.onVolume) this.onVolume(0);
  }
}
