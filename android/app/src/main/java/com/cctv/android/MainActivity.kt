package com.cctv.android

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.cctv.android.alerts.TelegramDispatcher
import com.cctv.android.camera.CameraXManager
import com.cctv.android.motion.MotionDetector
import com.cctv.android.motion.SecurityEventManager
import com.cctv.android.service.CctvForegroundService
import com.cctv.android.siren.SirenManager
import com.cctv.android.thermal.ThermalManager
import com.cctv.android.webrtc.OnDemandStreamController
import com.google.android.material.button.MaterialButton
import com.google.android.material.checkbox.MaterialCheckBox
import com.google.android.material.textfield.TextInputEditText
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity(), 
    OnDemandStreamController.StatusListener, 
    ThermalManager.ThermalListener,
    MotionDetector.MotionListener,
    SecurityEventManager.EventListener {

    private val TAG = "MainActivity"
    private val PREFS_NAME = "cctv_prefs"
    private val KEY_SERVICE_ENABLED = "key_service_enabled"
    private val KEY_SERVER_URL = "key_server_url"
    private val KEY_ROOM_ID = "key_room_id"
    private val KEY_TELEGRAM_TOKEN = "key_telegram_token"
    private val KEY_TELEGRAM_CHAT_ID = "key_telegram_chat_id"
    private val KEY_AUTO_SIREN = "key_auto_siren"

    private val DEFAULT_SERVER_URL = "wss://cellular-cctv.onrender.com"
    private val DEFAULT_ROOM_ID = "cctv-room-1"

    private lateinit var prefs: SharedPreferences
    private lateinit var cameraXManager: CameraXManager
    private lateinit var thermalManager: ThermalManager
    private lateinit var sirenManager: SirenManager
    private lateinit var motionDetector: MotionDetector
    private lateinit var securityEventManager: SecurityEventManager
    private var telegramDispatcher: TelegramDispatcher? = null

    // UI elements
    private lateinit var previewView: PreviewView
    private lateinit var statusIndicator: View
    private lateinit var statusText: TextView
    private lateinit var viewerCountBadge: TextView
    private lateinit var btnSwitchLens: MaterialButton
    private lateinit var btnTorch: MaterialButton
    private lateinit var btnOledSaver: MaterialButton
    private lateinit var inputServerUrl: TextInputEditText
    private lateinit var inputRoomId: TextInputEditText
    private lateinit var inputTelegramToken: TextInputEditText
    private lateinit var inputTelegramChatId: TextInputEditText
    private lateinit var checkAutoSiren: MaterialCheckBox
    private lateinit var btnToggleService: MaterialButton
    private lateinit var oledBlackOverlay: FrameLayout

    // Remote Message Broadcast Views
    private lateinit var remoteMessageOverlay: FrameLayout
    private lateinit var popupMessageBody: TextView
    private lateinit var popupMessageTimer: TextView
    private lateinit var btnDismissPopupPhone: MaterialButton
    private var countdownTimer: android.os.CountDownTimer? = null

    private var previousBrightness: Float = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        val audioGranted = permissions[Manifest.permission.RECORD_AUDIO] ?: false

        if (cameraGranted && audioGranted) {
            initCamera()
        } else {
            Toast.makeText(this, "Camera and Audio permissions are required for CCTV operation", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Allow CCTV and remote alerts to show and turn screen on over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        bindViews()
        loadPreferences()
        setupListeners()

        sirenManager = SirenManager(this)
        cameraXManager = CameraXManager(this, this)
        motionDetector = MotionDetector(sensitivityPercent = 15, cooldownMillis = 30_000L, listener = this)
        cameraXManager.setMotionAnalyzer(motionDetector)
        securityEventManager = SecurityEventManager(this, cameraXManager, this)

        thermalManager = ThermalManager(this, this)
        thermalManager.start()

        checkAndRequestPermissions()
        syncServiceState()

        if (intent?.getBooleanExtra("extra_boot_auto_start", false) == true) {
            enableOledSaver()
        }
    }


    private fun bindViews() {
        previewView = findViewById(R.id.previewView)
        statusIndicator = findViewById(R.id.statusIndicator)
        statusText = findViewById(R.id.statusText)
        viewerCountBadge = findViewById(R.id.viewerCountBadge)
        btnSwitchLens = findViewById(R.id.btnSwitchLens)
        btnTorch = findViewById(R.id.btnTorch)
        btnOledSaver = findViewById(R.id.btnOledSaver)
        inputServerUrl = findViewById(R.id.inputServerUrl)
        inputRoomId = findViewById(R.id.inputRoomId)
        inputTelegramToken = findViewById(R.id.inputTelegramToken)
        inputTelegramChatId = findViewById(R.id.inputTelegramChatId)
        checkAutoSiren = findViewById(R.id.checkAutoSiren)
        btnToggleService = findViewById(R.id.btnToggleService)
        oledBlackOverlay = findViewById(R.id.oledBlackOverlay)
        remoteMessageOverlay = findViewById(R.id.remoteMessageOverlay)
        popupMessageBody = findViewById(R.id.popupMessageBody)
        popupMessageTimer = findViewById(R.id.popupMessageTimer)
        btnDismissPopupPhone = findViewById(R.id.btnDismissPopupPhone)
    }

    private fun loadPreferences() {
        val savedServer = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
        val savedRoom = prefs.getString(KEY_ROOM_ID, DEFAULT_ROOM_ID)
        val savedToken = prefs.getString(KEY_TELEGRAM_TOKEN, "")
        val savedChatId = prefs.getString(KEY_TELEGRAM_CHAT_ID, "")
        val autoSiren = prefs.getBoolean(KEY_AUTO_SIREN, false)

        inputServerUrl.setText(savedServer)
        inputRoomId.setText(savedRoom)
        inputTelegramToken.setText(savedToken)
        inputTelegramChatId.setText(savedChatId)
        checkAutoSiren.isChecked = autoSiren

        telegramDispatcher = TelegramDispatcher(savedToken ?: "", savedChatId ?: "")
    }

    private fun savePreferences(enabled: Boolean) {
        val token = inputTelegramToken.text.toString().trim()
        val chatId = inputTelegramChatId.text.toString().trim()
        val autoSiren = checkAutoSiren.isChecked

        prefs.edit().apply {
            putBoolean(KEY_SERVICE_ENABLED, enabled)
            putString(KEY_SERVER_URL, inputServerUrl.text.toString().trim())
            putString(KEY_ROOM_ID, inputRoomId.text.toString().trim())
            putString(KEY_TELEGRAM_TOKEN, token)
            putString(KEY_TELEGRAM_CHAT_ID, chatId)
            putBoolean(KEY_AUTO_SIREN, autoSiren)
            apply()
        }

        telegramDispatcher = TelegramDispatcher(token, chatId)
    }

    private fun setupListeners() {
        btnSwitchLens.setOnClickListener {
            cameraXManager.switchCamera(previewView)
        }

        btnTorch.setOnClickListener {
            val isOn = cameraXManager.toggleTorch()
            btnTorch.text = if (isOn) "Torch: ON" else "Flashlight"
        }

        btnOledSaver.setOnClickListener {
            enableOledSaver()
        }

        // Double-tap on OLED black overlay wakes the screen back to controls
        val gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDoubleTap(e: MotionEvent): Boolean {
                disableOledSaver()
                return true
            }
        })
        oledBlackOverlay.setOnTouchListener { _, event ->
            gestureDetector.onTouchEvent(event)
            true
        }

        btnDismissPopupPhone.setOnClickListener {
            dismissRemoteMessage()
        }

        btnToggleService.setOnClickListener {
            if (CctvForegroundService.isRunning) {
                stopCctvService()
            } else {
                startCctvService()
            }
        }
    }

    private fun enableOledSaver() {
        previousBrightness = window.attributes.screenBrightness
        val layoutParams = window.attributes
        layoutParams.screenBrightness = 0.01f
        window.attributes = layoutParams

        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        oledBlackOverlay.visibility = View.VISIBLE
    }

    private fun disableOledSaver() {
        val layoutParams = window.attributes
        layoutParams.screenBrightness = if (previousBrightness >= 0) previousBrightness else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        window.attributes = layoutParams

        WindowCompat.getInsetsController(window, window.decorView).apply {
            show(WindowInsetsCompat.Type.systemBars())
        }

        oledBlackOverlay.visibility = View.GONE
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            permissions.add(Manifest.permission.ANSWER_PHONE_CALLS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isEmpty()) {
            initCamera()
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun initCamera() {
        if (CctvForegroundService.isRunning) {
            android.util.Log.i(TAG, "CCTV service is already running, unbinding CameraX so WebRTC has exclusive camera access")
            cameraXManager.unbind()
            return
        }
        cameraXManager.startCamera(previewView) {
            runOnUiThread {
                if (!CctvForegroundService.isRunning) {
                    statusText.text = getString(R.string.status_idle)
                }
            }
        }
    }

    private fun syncServiceState() {
        CctvForegroundService.statusListener = this
        CctvForegroundService.messagePopupListener = { text, duration, chime ->
            showRemoteMessage(text, duration, chime)
        }
        CctvForegroundService.messageDismissListener = {
            dismissRemoteMessage()
        }
        if (CctvForegroundService.isRunning) {
            cameraXManager.unbind()
            btnToggleService.text = getString(R.string.stop_service)
            btnToggleService.setBackgroundColor(ContextCompat.getColor(this, R.color.live_red))
            inputServerUrl.isEnabled = false
            inputRoomId.isEnabled = false
            inputTelegramToken.isEnabled = false
            inputTelegramChatId.isEnabled = false
            statusText.text = "CCTV Service Running (24/7)"
        }
    }

    private fun startCctvService() {
        val serverUrl = inputServerUrl.text.toString().trim()
        val roomId = inputRoomId.text.toString().trim()

        if (serverUrl.isEmpty() || roomId.isEmpty()) {
            Toast.makeText(this, "Please enter Server URL and Room ID", Toast.LENGTH_SHORT).show()
            return
        }

        savePreferences(enabled = true)

        // Release CameraX from Camera 0 before WebRTC initializes
        cameraXManager.unbind()

        btnToggleService.text = getString(R.string.stop_service)
        btnToggleService.setBackgroundColor(ContextCompat.getColor(this, R.color.live_red))
        inputServerUrl.isEnabled = false
        inputRoomId.isEnabled = false
        inputTelegramToken.isEnabled = false
        inputTelegramChatId.isEnabled = false

        val serviceIntent = Intent(this, CctvForegroundService::class.java).apply {
            action = CctvForegroundService.ACTION_START
            putExtra(CctvForegroundService.EXTRA_SERVER_URL, serverUrl)
            putExtra(CctvForegroundService.EXTRA_ROOM_ID, roomId)
        }

        CctvForegroundService.statusListener = this
        CctvForegroundService.messagePopupListener = { text, duration, chime ->
            showRemoteMessage(text, duration, chime)
        }
        CctvForegroundService.messageDismissListener = {
            dismissRemoteMessage()
        }
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    private fun stopCctvService() {
        savePreferences(enabled = false)

        val serviceIntent = Intent(this, CctvForegroundService::class.java).apply {
            action = CctvForegroundService.ACTION_STOP
        }
        startService(serviceIntent)

        btnToggleService.text = getString(R.string.start_service)
        btnToggleService.setBackgroundColor(ContextCompat.getColor(this, R.color.primary))
        inputServerUrl.isEnabled = true
        inputRoomId.isEnabled = true
        inputTelegramToken.isEnabled = true
        inputTelegramChatId.isEnabled = true

        onStatusChanged("Idle", false, 0)

        // Re-bind local CameraX preview
        initCamera()
    }

    // --- MotionDetector.MotionListener ---

    override fun onMotionDetected() {
        runOnUiThread {
            statusText.text = "⚠️ MOTION DETECTED!"
            statusIndicator.setBackgroundColor(ContextCompat.getColor(this, R.color.live_red))
            
            // Auto-siren if configured
            if (checkAutoSiren.isChecked) {
                sirenManager.playSiren(durationSeconds = 10)
            }

            // Capture photo and offload
            securityEventManager.handleMotionEvent()
        }
    }

    // --- SecurityEventManager.EventListener ---

    override fun onEventCaptured(photoFile: File?, videoFile: File?) {
        if (photoFile != null) {
            val roomId = inputRoomId.text.toString().trim()
            val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
            val caption = "🚨 *Motion Detected!*\n📍 Room: `$roomId`\n⏰ Time: `$time`"
            telegramDispatcher?.sendPhotoAlert(photoFile, caption)
        }
    }

    // --- OnDemandStreamController.StatusListener ---

    override fun onStatusChanged(status: String, isStreaming: Boolean, activeViewers: Int) {
        runOnUiThread {
            statusText.text = status
            viewerCountBadge.text = "$activeViewers Viewers"

            if (status == "SIREN TRIGGERED") {
                sirenManager.playSiren(durationSeconds = 10)
            }

            if (isStreaming) {
                statusIndicator.setBackgroundColor(ContextCompat.getColor(this, R.color.live_red))
                viewerCountBadge.setBackgroundColor(ContextCompat.getColor(this, R.color.live_red))
            } else {
                statusIndicator.setBackgroundColor(ContextCompat.getColor(this, R.color.idle_amber))
                viewerCountBadge.setBackgroundColor(ContextCompat.getColor(this, R.color.surface_variant))
            }
        }
    }

    override fun onError(message: String) {
        runOnUiThread {
            Toast.makeText(this, "Signaling error: $message", Toast.LENGTH_SHORT).show()
            statusText.text = "Error: $message"
        }
    }

    // --- ThermalManager.ThermalListener ---

    override fun onTemperatureUpdate(tempCelsius: Float, status: ThermalManager.ThermalStatus) {
        runOnUiThread {
            when (status) {
                ThermalManager.ThermalStatus.CRITICAL -> {
                    Toast.makeText(this, "Device Overheating (${tempCelsius}°C)", Toast.LENGTH_LONG).show()
                }
                ThermalManager.ThermalStatus.WARM -> {}
                ThermalManager.ThermalStatus.NORMAL -> {}
            }
        }
    }

    private fun showRemoteMessage(text: String, durationSeconds: Int, soundChime: Boolean) {
        runOnUiThread {
            try {
                val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                @Suppress("DEPRECATION")
                val wakeLock = pm.newWakeLock(
                    android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK or android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "CellularCCTV:RemoteMessageWake"
                )
                wakeLock.acquire(4000L)
            } catch (e: Exception) {
                android.util.Log.w(TAG, "Screen wakeup notice: ${e.message}")
            }

            if (oledBlackOverlay.visibility == View.VISIBLE) {
                oledBlackOverlay.visibility = View.GONE
            }
            val lp = window.attributes
            lp.screenBrightness = 1.0f
            window.attributes = lp

            remoteMessageOverlay.visibility = View.VISIBLE
            popupMessageBody.text = text

            if (soundChime) {
                try {
                    val defaultUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)
                    val r = android.media.RingtoneManager.getRingtone(applicationContext, defaultUri)
                    r?.play()
                } catch (e: Exception) {
                    android.util.Log.w(TAG, "Notification chime error: ${e.message}")
                }
            }

            countdownTimer?.cancel()
            if (durationSeconds > 0) {
                countdownTimer = object : android.os.CountDownTimer(durationSeconds * 1000L, 1000L) {
                    override fun onTick(millisUntilFinished: Long) {
                        val secs = (millisUntilFinished / 1000).toInt()
                        val m = secs / 60
                        val s = secs % 60
                        popupMessageTimer.text = String.format(Locale.US, "⏱️ Auto-dismiss in: %02d:%02d", m, s)
                    }

                    override fun onFinish() {
                        dismissRemoteMessage()
                    }
                }.start()
            } else {
                popupMessageTimer.text = "⏱️ Remote Notice (Tap Dismiss to Close)"
            }
        }
    }

    private fun dismissRemoteMessage() {
        runOnUiThread {
            countdownTimer?.cancel()
            countdownTimer = null
            remoteMessageOverlay.visibility = View.GONE

            val lp = window.attributes
            lp.screenBrightness = if (previousBrightness >= 0) previousBrightness else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
            window.attributes = lp
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        countdownTimer?.cancel()
        sirenManager.stopSiren()
        thermalManager.stop()
        CctvForegroundService.statusListener = null
        CctvForegroundService.messagePopupListener = null
        CctvForegroundService.messageDismissListener = null
        cameraXManager.shutdown()
    }
}
