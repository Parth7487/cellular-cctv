package com.cctv.android.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.cctv.android.MainActivity
import com.cctv.android.R
import com.cctv.android.camera.CameraXManager
import com.cctv.android.webrtc.OnDemandStreamController

class CctvForegroundService : Service(), OnDemandStreamController.StatusListener {

    companion object {
        const val TAG = "CctvService"
        const val CHANNEL_ID = "cctv_foreground_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.cctv.android.action.START"
        const val ACTION_STOP = "com.cctv.android.action.STOP"

        const val EXTRA_SERVER_URL = "extra_server_url"
        const val EXTRA_ROOM_ID = "extra_room_id"

        var isRunning = false
            private set

        var statusListener: OnDemandStreamController.StatusListener? = null
        var activeController: OnDemandStreamController? = null
            private set

        var messagePopupListener: ((text: String, durationSeconds: Int, soundChime: Boolean) -> Unit)? = null
        var messageDismissListener: (() -> Unit)? = null
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var streamController: OnDemandStreamController? = null
    private var notificationManager: NotificationManager? = null
    private var sirenManager: com.cctv.android.siren.SirenManager? = null

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        sirenManager = com.cctv.android.siren.SirenManager(this)
        createNotificationChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START

        if (action == ACTION_STOP) {
            Log.i(TAG, "Stopping CCTV Foreground Service via Intent")
            stopCctv()
            stopSelf()
            return START_NOT_STICKY
        }

        val serverUrl = intent?.getStringExtra(EXTRA_SERVER_URL) ?: "wss://cellular-cctv.onrender.com"
        val roomId = intent?.getStringExtra(EXTRA_ROOM_ID) ?: "cctv-room-1"

        Log.i(TAG, "Starting CCTV Foreground Service: room=$roomId")
        startForegroundWithNotification("CCTV Service Active (Waiting for Viewers)")

        isRunning = true

        // Initialize streaming controller
        streamController?.stop()
        val dummyCameraManager = CameraXManager(this, null)
        streamController = OnDemandStreamController(
            context = this,
            serverUrl = serverUrl,
            roomId = roomId,
            cameraXManager = dummyCameraManager,
            listener = this
        )
        activeController = streamController
        streamController?.start()

        // Check for OTA updates on service launch
        try {
            com.cctv.android.update.AppUpdateManager(this).checkForUpdate(serverUrl)
        } catch (e: Exception) {
            Log.w(TAG, "OTA update check on start failed", e)
        }

        return START_STICKY
    }


    private fun startForegroundWithNotification(statusText: String) {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Cellular CCTV Active")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        val foregroundServiceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            }
        } else {
            0
        }

        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, foregroundServiceType)
    }

    private fun updateNotification(statusText: String) {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Cellular CCTV Active")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        notificationManager?.notify(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "CCTV Surveillance Channel",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps CCTV camera stream alive in the background 24/7"
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "CellularCCTV:ForegroundWakeLock"
        ).apply {
            setReferenceCounted(false)
            acquire()
        }
        Log.i(TAG, "Partial WakeLock acquired for 24/7 reliability")
    }

    private fun stopCctv() {
        isRunning = false
        sirenManager?.stopSiren()
        streamController?.stop()
        streamController = null
        activeController = null
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    override fun onDestroy() {
        super.onDestroy()
        stopCctv()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // --- OnDemandStreamController.StatusListener ---

    override fun onStatusChanged(status: String, isStreaming: Boolean, activeViewers: Int) {
        if (status == "SIREN TRIGGERED") {
            sirenManager?.playSiren(10)
        }
        val text = if (isStreaming) "LIVE STREAMING ($activeViewers Viewers)" else status
        updateNotification(text)
        statusListener?.onStatusChanged(status, isStreaming, activeViewers)
    }

    override fun onError(message: String) {
        updateNotification("Error: $message")
        statusListener?.onError(message)
    }
}
