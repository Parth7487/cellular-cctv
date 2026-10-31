package com.cctv.android.webrtc

import android.content.Context
import android.util.Log
import org.webrtc.*
import org.webrtc.audio.JavaAudioDeviceModule

class WebRtcManager(
    private val context: Context,
    private val rootEglBase: EglBase,
    private val listener: Listener
) {
    private val TAG = "WebRtcManager"

    interface Listener {
        fun onIceCandidate(candidate: IceCandidate, targetPeerId: String?)
        fun onIceConnectionState(state: PeerConnection.IceConnectionState)
    }

    private var peerConnectionFactory: PeerConnectionFactory
    private val peerConnections = mutableMapOf<String, PeerConnection>()

    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var cameraCapturer: VideoCapturer? = null
    private var isCapturerRunning = false
    private var isTorchOn = false
    private var frontCameraName: String? = null
    private var backCameraName: String? = null
    private var isCurrentlyFront: Boolean = false

    private var iceServers: List<PeerConnection.IceServer> = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
        PeerConnection.IceServer.builder("turn:openrelay.metered.ca:80")
            .setUsername("openrelayproject")
            .setPassword("openrelayproject")
            .createIceServer(),
        PeerConnection.IceServer.builder("turns:openrelay.metered.ca:443?transport=tcp")
            .setUsername("openrelayproject")
            .setPassword("openrelayproject")
            .createIceServer()
    )

    init {
        val initOptions = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(initOptions)

        val audioDeviceModule = JavaAudioDeviceModule.builder(context)
            .setAudioSource(android.media.MediaRecorder.AudioSource.CAMCORDER)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(false)
            .createAudioDeviceModule()
        audioDeviceModule.setSpeakerMute(false)
        audioDeviceModule.setMicrophoneMute(false)

        val encoderFactory = DefaultVideoEncoderFactory(
            rootEglBase.eglBaseContext,
            true /* enableIntelVp8 */,
            true /* enableH264HighProfile */
        )
        val decoderFactory = DefaultVideoDecoderFactory(rootEglBase.eglBaseContext)

        val options = PeerConnectionFactory.Options()
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setOptions(options)
            .setAudioDeviceModule(audioDeviceModule)
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()

        createLocalMediaTracks()
    }

    fun updateIceServers(newConfigs: List<SignalingClient.IceServerConfig>) {
        val servers = mutableListOf<PeerConnection.IceServer>()
        for (cfg in newConfigs) {
            val builder = PeerConnection.IceServer.builder(cfg.urls)
            if (!cfg.username.isNullOrEmpty() && !cfg.credential.isNullOrEmpty()) {
                builder.setUsername(cfg.username)
                builder.setPassword(cfg.credential)
            }
            servers.add(builder.createIceServer())
        }
        if (servers.isNotEmpty()) {
            iceServers = servers
            Log.i(TAG, "Updated WebRTC ICE servers with ${servers.size} endpoints")
        }
    }

    private fun createLocalMediaTracks() {
        // Audio Track configured for clear ambient room audio without aggressive gating
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", "false"))
        }
        audioSource = peerConnectionFactory.createAudioSource(audioConstraints)
        audioTrack = peerConnectionFactory.createAudioTrack("ARDAMSa0", audioSource)
        audioTrack?.setEnabled(true)

        // Video Track
        videoSource = peerConnectionFactory.createVideoSource(false)
        cameraCapturer = createCameraCapturer()
        val surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", rootEglBase.eglBaseContext)
        cameraCapturer?.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        
        videoTrack = peerConnectionFactory.createVideoTrack("ARDAMSv0", videoSource)
        videoTrack?.setEnabled(false) // Start disabled (On-Demand mode)
    }

    fun startVideoCapturer(width: Int = 1280, height: Int = 720, fps: Int = 30) {
        if (isCapturerRunning) {
            Log.i(TAG, "WebRTC Video Capturer already running. Ensuring video track enabled.")
            videoTrack?.setEnabled(true)
            return
        }
        try {
            cameraCapturer?.startCapture(width, height, fps)
            isCapturerRunning = true
            videoTrack?.setEnabled(true)
            Log.i(TAG, "WebRTC Video Capturer started ($width x $height @ $fps fps)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start camera capturer", e)
        }
    }

    fun stopVideoCapturer() {
        if (!isCapturerRunning) return
        try {
            videoTrack?.setEnabled(false)
            cameraCapturer?.stopCapture()
            isCapturerRunning = false
            Log.i(TAG, "WebRTC Video Capturer paused (On-Demand sleep)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop camera capturer", e)
        }
    }

    fun switchCamera(onComplete: ((Boolean) -> Unit)? = null) {
        val capturer = cameraCapturer as? CameraVideoCapturer
        if (capturer == null) {
            Log.w(TAG, "Active camera capturer does not support camera switching")
            onComplete?.invoke(false)
            return
        }

        val targetName = if (isCurrentlyFront) backCameraName else frontCameraName
        if (targetName != null) {
            Log.i(TAG, "Switching WebRTC camera to explicitly targeted device: $targetName (was front: $isCurrentlyFront)")
            capturer.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
                override fun onCameraSwitchDone(isFrontCamera: Boolean) {
                    isCurrentlyFront = (targetName == frontCameraName)
                    Log.i(TAG, "Camera switch succeeded. Now using: target=$targetName, isFront=$isCurrentlyFront")
                    onComplete?.invoke(isCurrentlyFront)
                }
                override fun onCameraSwitchError(errorDescription: String?) {
                    Log.w(TAG, "Explicit camera switch failed ($errorDescription), falling back to generic switchCamera()")
                    capturer.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
                        override fun onCameraSwitchDone(isFront: Boolean) {
                            isCurrentlyFront = isFront
                            Log.i(TAG, "Generic camera switch succeeded. isFront=$isCurrentlyFront")
                            onComplete?.invoke(isCurrentlyFront)
                        }
                        override fun onCameraSwitchError(err: String?) {
                            Log.e(TAG, "Generic camera switch also failed: $err")
                            onComplete?.invoke(false)
                        }
                    })
                }
            }, targetName)
        } else {
            // Generic cycle fallback
            capturer.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
                override fun onCameraSwitchDone(isFrontCamera: Boolean) {
                    isCurrentlyFront = isFrontCamera
                    Log.i(TAG, "Camera switch succeeded. isFront=$isFrontCamera")
                    onComplete?.invoke(isFrontCamera)
                }
                override fun onCameraSwitchError(errorDescription: String?) {
                    Log.e(TAG, "Camera switch error: $errorDescription")
                    onComplete?.invoke(false)
                }
            })
        }
    }

    private var currentZoomFactor: Float = 1.0f

    fun setZoom(zoomNormalized: Float): Boolean {
        // Normalize zoom value: 0.0 to 1.0 (or 0 to 100)
        val norm = if (zoomNormalized > 1.0f) (zoomNormalized / 100.0f).coerceIn(0f, 1f) else zoomNormalized.coerceIn(0f, 1f)
        currentZoomFactor = 1.0f + (norm * 4.0f) // 1.0x to 5.0x
        Log.i(TAG, "Requesting WebRTC camera zoom factor: ${currentZoomFactor}x")
        return applyCameraSessionParameters()
    }

    fun toggleTorch(): Boolean {
        return setTorch(!isTorchOn)
    }

    fun setTorch(enable: Boolean): Boolean {
        isTorchOn = enable
        val applied = applyCameraSessionParameters()
        if (!applied && !isCapturerRunning) {
            // Fallback when camera is not in active WebRTC streaming session
            try {
                val camManager = context.getSystemService(Context.CAMERA_SERVICE) as android.hardware.camera2.CameraManager
                camManager.setTorchMode("0", enable)
                Log.i(TAG, "CameraManager setTorchMode fallback applied: $enable")
                return true
            } catch (e: Exception) {
                Log.w(TAG, "CameraManager setTorchMode fallback error: ${e.message}")
            }
        }
        return applied
    }

    private fun applyCameraSessionParameters(): Boolean {
        val capturer = cameraCapturer ?: return false
        try {
            val capturerClass = capturer.javaClass.superclass ?: Class.forName("org.webrtc.CameraCapturer")
            val sessionField = capturerClass.getDeclaredField("currentSession").apply { isAccessible = true }
            val session = sessionField.get(capturer) ?: return false

            val sessionClass = session.javaClass
            val handlerField = sessionClass.getDeclaredField("cameraThreadHandler").apply { isAccessible = true }
            val handler = handlerField.get(session) as? android.os.Handler ?: return false

            val sessionField2 = sessionClass.getDeclaredField("captureSession").apply { isAccessible = true }
            val captureSession = sessionField2.get(session) as? android.hardware.camera2.CameraCaptureSession ?: return false

            val deviceField = sessionClass.getDeclaredField("cameraDevice").apply { isAccessible = true }
            val cameraDevice = deviceField.get(session) as? android.hardware.camera2.CameraDevice ?: return false

            val surfaceField = sessionClass.getDeclaredField("surface").apply { isAccessible = true }
            val surface = surfaceField.get(session) as? android.view.Surface ?: return false

            val charsField = sessionClass.getDeclaredField("cameraCharacteristics").apply { isAccessible = true }
            val characteristics = charsField.get(session) as? android.hardware.camera2.CameraCharacteristics

            handler.post {
                try {
                    val requestBuilder = cameraDevice.createCaptureRequest(android.hardware.camera2.CameraDevice.TEMPLATE_RECORD)
                    requestBuilder.addTarget(surface)

                    // Torch control (rear camera only)
                    if (isTorchOn && !isCurrentlyFront) {
                        requestBuilder.set(android.hardware.camera2.CaptureRequest.FLASH_MODE, android.hardware.camera2.CaptureRequest.FLASH_MODE_TORCH)
                    } else {
                        requestBuilder.set(android.hardware.camera2.CaptureRequest.FLASH_MODE, android.hardware.camera2.CaptureRequest.FLASH_MODE_OFF)
                    }

                    // Digital crop zoom
                    if (currentZoomFactor > 1.0f && characteristics != null) {
                        val activeArray = characteristics.get(android.hardware.camera2.CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
                        val maxZoom = characteristics.get(android.hardware.camera2.CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1.0f
                        val clampedZoom = currentZoomFactor.coerceIn(1.0f, maxZoom)
                        if (activeArray != null) {
                            val cropW = (activeArray.width() / clampedZoom).toInt()
                            val cropH = (activeArray.height() / clampedZoom).toInt()
                            val cropX = (activeArray.width() - cropW) / 2
                            val cropY = (activeArray.height() - cropH) / 2
                            val cropRect = android.graphics.Rect(cropX, cropY, cropX + cropW, cropY + cropH)
                            requestBuilder.set(android.hardware.camera2.CaptureRequest.SCALER_CROP_REGION, cropRect)
                        }
                    }

                    requestBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AF_MODE, android.hardware.camera2.CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
                    requestBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AE_MODE, android.hardware.camera2.CaptureRequest.CONTROL_AE_MODE_ON)

                    captureSession.setRepeatingRequest(requestBuilder.build(), null, handler)
                    Log.i(TAG, "Applied camera parameters on active WebRTC session: torch=$isTorchOn, zoom=${currentZoomFactor}x")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to apply camera parameters to captureSession", e)
                }
            }
            return true
        } catch (e: Exception) {
            Log.w(TAG, "Could not access active Camera2Session via reflection: ${e.message}")
            return false
        }
    }

    private fun createCameraCapturer(): VideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        val deviceNames = enumerator.deviceNames

        // Scan and resolve back and front camera IDs
        for (deviceName in deviceNames) {
            if (enumerator.isBackFacing(deviceName) && backCameraName == null) {
                backCameraName = deviceName
            } else if (enumerator.isFrontFacing(deviceName) && frontCameraName == null) {
                frontCameraName = deviceName
            }
        }
        Log.i(TAG, "WebRTC Camera devices identified: Back='$backCameraName', Front='$frontCameraName'")

        // Prefer back camera for surveillance
        val initialCamera = backCameraName ?: frontCameraName ?: deviceNames.firstOrNull()
        if (initialCamera != null) {
            val capturer = enumerator.createCapturer(initialCamera, null)
            if (capturer != null) {
                isCurrentlyFront = (initialCamera == frontCameraName)
                return capturer
            }
        }
        return null
    }

    fun getOrCreatePeerConnection(peerId: String): PeerConnection? {
        if (peerConnections.containsKey(peerId)) {
            return peerConnections[peerId]
        }

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.ENABLED
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            keyType = PeerConnection.KeyType.ECDSA
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }

        val observer = object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                listener.onIceCandidate(candidate, peerId)
            }

            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState) {
                Log.i(TAG, "ICE Connection state for $peerId: $newState")
                listener.onIceConnectionState(newState)
            }

            override fun onSignalingChange(state: PeerConnection.SignalingState) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                val track = receiver?.track()
                if (track is AudioTrack) {
                    track.setEnabled(true)
                    track.setVolume(1.0)
                    Log.i(TAG, "Remote intercom AudioTrack received and enabled at full volume")
                    try {
                        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
                        audioManager.mode = android.media.AudioManager.MODE_IN_COMMUNICATION
                        audioManager.isSpeakerphoneOn = true
                        val maxCallVol = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_VOICE_CALL)
                        audioManager.setStreamVolume(android.media.AudioManager.STREAM_VOICE_CALL, maxCallVol, 0)
                        val maxMusicVol = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
                        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, maxMusicVol, 0)
                        Log.i(TAG, "Intercom audio mode configured: MODE_IN_COMMUNICATION, speakerphone=true, callVol=$maxCallVol")
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to configure audio manager for intercom: ${e.message}")
                    }
                }
            }
        }

        val pc = peerConnectionFactory.createPeerConnection(rtcConfig, observer)
        if (pc != null) {
            // Attach local video and audio tracks
            val mediaStreamLabels = listOf("ARDAMS")
            if (videoTrack != null) pc.addTrack(videoTrack, mediaStreamLabels)
            if (audioTrack != null) pc.addTrack(audioTrack, mediaStreamLabels)

            peerConnections[peerId] = pc
        }
        return pc
    }

    fun createOfferForPeer(peerId: String, onSdpCreated: (String) -> Unit) {
        val pc = getOrCreatePeerConnection(peerId) ?: return
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true")) // Allow two-way intercom
        }

        pc.createOffer(object : SdpObserver {
            override fun onCreateSuccess(desc: SessionDescription) {
                pc.setLocalDescription(object : SdpObserver {
                    override fun onCreateSuccess(d: SessionDescription) {}
                    override fun onSetSuccess() {
                        onSdpCreated(desc.description)
                    }
                    override fun onCreateFailure(s: String) {}
                    override fun onSetFailure(s: String) {
                        Log.e(TAG, "setLocalDescription failed: $s")
                    }
                }, desc)
            }

            override fun onSetSuccess() {}
            override fun onCreateFailure(s: String) {
                Log.e(TAG, "createOffer failed: $s")
            }
            override fun onSetFailure(s: String) {}
        }, constraints)
    }

    fun handleAnswer(peerId: String, sdp: String) {
        val pc = peerConnections[peerId] ?: return
        val desc = SessionDescription(SessionDescription.Type.ANSWER, sdp)
        pc.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(d: SessionDescription) {}
            override fun onSetSuccess() {
                Log.i(TAG, "Remote answer set successfully for $peerId")
            }
            override fun onCreateFailure(s: String) {}
            override fun onSetFailure(s: String) {
                Log.e(TAG, "Failed to set remote answer for $peerId: $s")
            }
        }, desc)
    }

    fun addRemoteIceCandidate(peerId: String, candidate: String, sdpMid: String?, sdpMLineIndex: Int) {
        val pc = peerConnections[peerId] ?: return
        val iceCandidate = IceCandidate(sdpMid ?: "0", sdpMLineIndex, candidate)
        pc.addIceCandidate(iceCandidate)
    }

    fun closePeer(peerId: String) {
        val pc = peerConnections.remove(peerId)
        pc?.close()
    }

    fun closeAllPeers() {
        for ((_, pc) in peerConnections) {
            pc.close()
        }
        peerConnections.clear()
    }

    fun hasActiveViewers(): Boolean {
        return peerConnections.isNotEmpty()
    }

    fun shutdown() {
        closeAllPeers()
        stopVideoCapturer()
        cameraCapturer?.dispose()
        videoSource?.dispose()
        audioSource?.dispose()
        peerConnectionFactory.dispose()
    }
}
