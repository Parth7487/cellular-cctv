/**
 * Live Stream Video Recorder Module.
 * Supports recording with audio or video-only.
 */
export class StreamRecorder {
  constructor(webrtcViewer) {
    this.webrtcViewer = webrtcViewer;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordWithAudio = true; // default: with audio
    this.startTime = 0;
    this.timerInterval = null;
    this.onStateChange = null; // callback(isRecording, durationSeconds, recordWithAudio)
  }

  setAudioEnabled(enabled) {
    this.recordWithAudio = !!enabled;
    if (this.onStateChange) {
      this.onStateChange(this.isRecording, this.getElapsedSeconds(), this.recordWithAudio);
    }
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  start() {
    if (this.isRecording) return false;

    const stream = this.webrtcViewer.remoteStream;
    if (!stream || stream.getVideoTracks().length === 0) {
      alert('Cannot start recording: No active video stream available.');
      return false;
    }

    let streamToRecord;
    if (this.recordWithAudio && stream.getAudioTracks().length > 0) {
      // Record video and audio
      streamToRecord = new MediaStream([
        ...stream.getVideoTracks(),
        ...stream.getAudioTracks()
      ]);
      console.log('[Recorder] Recording WITH live audio stream');
    } else {
      // Record video only
      streamToRecord = new MediaStream([...stream.getVideoTracks()]);
      console.log('[Recorder] Recording VIDEO ONLY (no audio)');
    }

    const mimeTypes = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4'
    ];
    let selectedMime = '';
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(streamToRecord, selectedMime ? { mimeType: selectedMime } : {});
    } catch (e) {
      console.error('[Recorder] MediaRecorder initialization failed:', e);
      alert('Your browser does not support recording this video stream.');
      return false;
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.saveRecording(selectedMime);
    };

    this.mediaRecorder.start(1000); // 1-second chunks
    this.isRecording = true;
    this.startTime = Date.now();

    this.timerInterval = setInterval(() => {
      if (this.onStateChange) {
        this.onStateChange(this.isRecording, this.getElapsedSeconds(), this.recordWithAudio);
      }
    }, 1000);

    if (this.onStateChange) {
      this.onStateChange(true, 0, this.recordWithAudio);
    }

    console.log('[Recorder] Started recording live stream');
    return true;
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.onStateChange) {
      this.onStateChange(false, 0, this.recordWithAudio);
    }
    console.log('[Recorder] Stopped recording. Preparing download...');
  }

  saveRecording(mimeType) {
    if (this.recordedChunks.length === 0) {
      console.warn('[Recorder] No data chunks captured to save.');
      return;
    }

    const blob = new Blob(this.recordedChunks, { type: mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const audioLabel = this.recordWithAudio ? 'with-audio' : 'video-only';
    const filename = `cctv-${audioLabel}-${dateStr}.${ext}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);

    console.log(`[Recorder] Saved recording: ${filename} (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);
  }
}
