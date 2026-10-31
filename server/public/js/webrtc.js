/**
 * WebRTC media stream manager for CCTV viewer.
 */
export class WebRtcViewer {
  constructor(options = {}) {
    this.videoElement = options.videoElement;
    this.onIceCandidate = options.onIceCandidate;
    this.onIceConnectionState = options.onIceConnectionState;
    this.onTrack = options.onTrack;

    this.peerConnection = null;
    this.remoteStream = new MediaStream();
    this.iceServers = [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['turn:openrelay.metered.ca:80'], username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: ['turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
    ];

    this.candidateQueue = [];
    this.listenAudioContext = null;
    this.gainNode = null;
    this.remoteAudioSource = null;

    if (this.videoElement) {
      this.videoElement.srcObject = this.remoteStream;
    }
  }

  setIceServers(servers) {
    if (servers && servers.length > 0) {
      this.iceServers = servers;
    }
  }

  setupAudioBooster() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.listenAudioContext) {
        this.listenAudioContext = new AudioCtx();
        this.gainNode = this.listenAudioContext.createGain();
        this.gainNode.gain.value = 1.0;
        this.gainNode.connect(this.listenAudioContext.destination);
      }
      if (this.remoteAudioSource) {
        try { this.remoteAudioSource.disconnect(); } catch (e) {}
      }
      this.remoteAudioSource = this.listenAudioContext.createMediaStreamSource(this.remoteStream);
      this.remoteAudioSource.connect(this.gainNode);
      console.log('[WebRTC] Connected audio booster gain node to incoming live phone stream');
    } catch (e) {
      console.warn('[WebRTC] Audio booster setup notice:', e);
    }
  }

  setVolume(factor) {
    // factor: 0.0 to 3.0 (0% to 300% volume amplification)
    if (this.gainNode) {
      this.gainNode.gain.value = factor;
    }
    if (this.videoElement) {
      this.videoElement.volume = Math.min(1.0, factor);
    }
    if (this.listenAudioContext && this.listenAudioContext.state === 'suspended' && factor > 0) {
      this.listenAudioContext.resume().catch(() => {});
    }
  }

  createPeerConnection(targetPeerId) {
    if (this.peerConnection) {
      this.close();
    }

    this.candidateQueue = [];
    console.log('[WebRTC] Initializing RTCPeerConnection with ICE servers:', this.iceServers);
    const config = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnection = pc;

    // Direct incoming tracks to video and audio booster
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind, event.track.id);
      this.remoteStream.addTrack(event.track);
      if (event.track.kind === 'audio') {
        this.setupAudioBooster();
      }
      if (this.videoElement) {
        if (this.videoElement.srcObject !== this.remoteStream) {
          this.videoElement.srcObject = this.remoteStream;
        }
        const playPromise = this.videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[WebRTC] Auto-play prevented by browser policy, forcing muted playback:', err);
            this.videoElement.muted = true;
            this.videoElement.play().catch((e) => {
              console.error('[WebRTC] Video play failed even with muted=true:', e);
            });
          });
        }
      }
      if (this.onTrack) this.onTrack(event);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate, targetPeerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState);
      if (this.onIceConnectionState) {
        this.onIceConnectionState(pc.iceConnectionState);
      }
    };

    return pc;
  }

  getOrCreateSilentTrack() {
    if (this.silentAudioTrack && this.silentAudioTrack.readyState === 'live') {
      return this.silentAudioTrack;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      const gain = ctx.createGain();
      gain.gain.value = 0; // Complete silence
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      this.silentAudioContext = ctx;
      this.silentAudioTrack = dst.stream.getAudioTracks()[0];
      return this.silentAudioTrack;
    } catch (e) {
      console.warn('[WebRTC] Web Audio silent track creation notice:', e);
      return null;
    }
  }

  getAudioTransceiver() {
    if (!this.peerConnection) return null;
    return this.peerConnection.getTransceivers().find(
      (t) => (t.receiver && t.receiver.track && t.receiver.track.kind === 'audio') ||
             (t.sender && t.sender.track && t.sender.track.kind === 'audio')
    );
  }

  async handleOffer(sdp, fromPeerId) {
    const pc = this.createPeerConnection(fromPeerId);

    console.log('[WebRTC] Setting Remote Description (Offer)');
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

    // Flush any early arriving ICE candidates immediately to establish connectivity in milliseconds
    await this.flushCandidateQueue();

    // Find the audio transceiver automatically created by WebRTC for the offer's audio m-line
    const audioTransceiver = this.getAudioTransceiver();
    if (audioTransceiver) {
      audioTransceiver.direction = 'sendrecv';
      const silentTrack = this.getOrCreateSilentTrack();
      if (silentTrack && audioTransceiver.sender) {
        try {
          await audioTransceiver.sender.replaceTrack(silentTrack);
          console.log('[WebRTC] Attached baseline silent audio track to audio transceiver (bidirectional intercom enabled)');
        } catch (e) {
          console.warn('[WebRTC] replaceTrack with baseline audio notice:', e);
        }
      }
    }

    console.log('[WebRTC] Creating Answer with bidirectional audio support');
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return answer.sdp;
  }

  async flushCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    if (this.candidateQueue.length > 0) {
      console.log(`[WebRTC] Flushing ${this.candidateQueue.length} queued early ICE candidates...`);
      while (this.candidateQueue.length > 0) {
        const cand = this.candidateQueue.shift();
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Error flushing queued candidate:', e);
        }
      }
    }
  }

  async addRemoteCandidate(candidateInit) {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      console.log('[WebRTC] Queued early candidate before remote description set');
      this.candidateQueue.push(candidateInit);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (err) {
      console.warn('[WebRTC] Error adding ICE candidate:', err);
    }
  }

  close() {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    // Clean tracks
    this.remoteStream.getTracks().forEach((track) => track.stop());
    this.remoteStream = new MediaStream();
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }
}
