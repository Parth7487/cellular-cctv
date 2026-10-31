package com.cctv.android.telephony

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.media.AudioManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.cctv.android.sms.SmsRepository
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class CallManager(private val context: Context) {

    private val TAG = "CallManager"
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    private val mainHandler = Handler(Looper.getMainLooper())

    private var activeCallNumber: String? = null
    private var isSpeakerphoneRequested = true
    private var isRecording = false
    private var mediaRecorder: MediaRecorder? = null
    private var currentRecordingFile: File? = null

    var onCallStateChanged: ((state: String, number: String, name: String) -> Unit)? = null

    init {
        registerCallStateListener()
    }

    private fun registerCallStateListener() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            telephonyManager.registerTelephonyCallback(
                context.mainExecutor,
                object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) {
                        handleCallState(state, activeCallNumber)
                    }
                }
            )
        } else {
            @Suppress("DEPRECATION")
            telephonyManager.listen(object : PhoneStateListener() {
                @Deprecated("Deprecated in Java")
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    handleCallState(state, phoneNumber ?: activeCallNumber)
                }
            }, PhoneStateListener.LISTEN_CALL_STATE)
        }
    }

    private fun handleCallState(state: Int, number: String?) {
        val num = number ?: activeCallNumber ?: "Unknown"
        val contactName = SmsRepository.resolveContactName(context, num) ?: ""

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                activeCallNumber = num
                Log.i(TAG, "Incoming call ringing from: $num ($contactName)")
                onCallStateChanged?.invoke("ringing", num, contactName)
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                Log.i(TAG, "Call offhook / active with: $num")
                if (isSpeakerphoneRequested) {
                    mainHandler.postDelayed({ setSpeakerphone(true) }, 1200)
                }
                startCallRecording(num)
                onCallStateChanged?.invoke("offhook", num, contactName)
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                Log.i(TAG, "Call idle / ended")
                stopCallRecording()
                setSpeakerphone(false)
                onCallStateChanged?.invoke("idle", num, contactName)
                activeCallNumber = null
            }
        }
    }

    fun placeCall(phoneNumber: String): Boolean {
        val cleanNumber = phoneNumber.replace(Regex("[^0-9+]"), "")
        if (cleanNumber.isBlank()) {
            Log.e(TAG, "Cannot place call: phone number is blank")
            return false
        }

        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            Log.e(TAG, "Cannot place call: CALL_PHONE permission not granted")
            return false
        }

        activeCallNumber = cleanNumber
        isSpeakerphoneRequested = true

        try {
            Log.i(TAG, "Placing remote outgoing SIM call to: $cleanNumber")
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$cleanNumber")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)

            // Auto-enable speakerphone after dialer launch
            mainHandler.postDelayed({ setSpeakerphone(true) }, 2500)
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to place call to $cleanNumber: ${e.message}", e)
            return false
        }
    }

    fun endCall(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val tm = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
                val hasPermission = ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.ANSWER_PHONE_CALLS
                ) == PackageManager.PERMISSION_GRANTED
                if (hasPermission && tm != null) {
                    tm.endCall()
                    Log.i(TAG, "Ended call via TelecomManager")
                    true
                } else false
            } else false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to end call: ${e.message}")
            false
        }
    }

    fun answerCall(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val tm = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
                val hasPermission = ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.ANSWER_PHONE_CALLS
                ) == PackageManager.PERMISSION_GRANTED
                if (hasPermission && tm != null) {
                    tm.acceptRingingCall()
                    setSpeakerphone(true)
                    Log.i(TAG, "Answered incoming call on speakerphone")
                    true
                } else false
            } else false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to answer call: ${e.message}")
            false
        }
    }

    fun setSpeakerphone(enable: Boolean) {
        try {
            audioManager.mode = if (enable) AudioManager.MODE_IN_CALL else AudioManager.MODE_NORMAL
            audioManager.isSpeakerphoneOn = enable
            Log.i(TAG, "Speakerphone set to: $enable (mode: ${audioManager.mode})")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to toggle speakerphone: ${e.message}")
        }
    }

    fun getCallLogs(limit: Int = 35): JSONArray {
        val result = JSONArray()
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            Log.w(TAG, "READ_CALL_LOG permission not granted")
            return result
        }

        try {
            val uri = CallLog.Calls.CONTENT_URI
            val projection = arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION
            )

            val cursor: Cursor? = context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                "${CallLog.Calls.DATE} DESC LIMIT $limit"
            )

            val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault())

            cursor?.use {
                val numIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)
                val durIdx = it.getColumnIndex(CallLog.Calls.DURATION)

                while (it.moveToNext()) {
                    val rawNum = if (numIdx >= 0) it.getString(numIdx) ?: "Unknown" else "Unknown"
                    var name = if (nameIdx >= 0) it.getString(nameIdx) ?: "" else ""
                    if (name.isBlank()) {
                        name = SmsRepository.resolveContactName(context, rawNum) ?: ""
                    }

                    val typeInt = if (typeIdx >= 0) it.getInt(typeIdx) else CallLog.Calls.INCOMING_TYPE
                    val dateLong = if (dateIdx >= 0) it.getLong(dateIdx) else System.currentTimeMillis()
                    val durationSec = if (durIdx >= 0) it.getLong(durIdx) else 0L

                    val typeStr = when (typeInt) {
                        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                        CallLog.Calls.MISSED_TYPE -> "missed"
                        CallLog.Calls.REJECTED_TYPE -> "rejected"
                        else -> "incoming"
                    }

                    val durationFormatted = if (durationSec > 0) {
                        val m = durationSec / 60
                        val s = durationSec % 60
                        if (m > 0) "${m}m ${s}s" else "${s}s"
                    } else if (typeStr == "missed" || typeStr == "rejected") {
                        "Missed"
                    } else {
                        "0s"
                    }

                    val obj = JSONObject().apply {
                        put("number", rawNum)
                        put("name", name)
                        put("type", typeStr)
                        put("date", dateLong)
                        put("dateTime", sdf.format(Date(dateLong)))
                        put("durationSeconds", durationSec)
                        put("durationFormatted", durationFormatted)
                    }
                    result.put(obj)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying call logs: ${e.message}", e)
        }

        return result
    }

    private fun startCallRecording(number: String) {
        if (isRecording) return
        try {
            val recDir = File(context.getExternalFilesDir(null), "recordings")
            if (!recDir.exists()) recDir.mkdirs()

            val cleanNum = number.replace(Regex("[^0-9+]"), "")
            val timeCode = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val file = File(recDir, "call_${timeCode}_${cleanNum}.m4a")
            currentRecordingFile = file

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128000)
                setAudioSamplingRate(44100)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }

            mediaRecorder = recorder
            isRecording = true
            Log.i(TAG, "Call recording started: ${file.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start call recording: ${e.message}")
            mediaRecorder = null
            isRecording = false
        }
    }

    private fun stopCallRecording() {
        if (!isRecording) return
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            Log.i(TAG, "Call recording finished: ${currentRecordingFile?.length() ?: 0} bytes")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping call recording: ${e.message}")
        } finally {
            mediaRecorder = null
            isRecording = false
        }
    }

    fun getRecordingsList(): JSONArray {
        val result = JSONArray()
        try {
            val recDir = File(context.getExternalFilesDir(null), "recordings")
            if (recDir.exists() && recDir.isDirectory) {
                val files = recDir.listFiles()?.filter { it.extension == "m4a" }?.sortedByDescending { it.lastModified() }
                files?.forEach { f ->
                    val obj = JSONObject().apply {
                        put("filename", f.name)
                        put("sizeBytes", f.length())
                        put("timestamp", f.lastModified())
                        put("dateTime", SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(Date(f.lastModified())))
                    }
                    result.put(obj)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error listing call recordings: ${e.message}")
        }
        return result
    }
}
