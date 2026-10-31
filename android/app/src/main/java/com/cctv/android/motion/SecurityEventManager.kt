package com.cctv.android.motion

import android.content.Context
import android.util.Log
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import com.cctv.android.camera.CameraXManager
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class SecurityEventManager(
    private val context: Context,
    private val cameraXManager: CameraXManager,
    private val listener: EventListener
) {
    private val TAG = "SecurityEventManager"

    interface EventListener {
        fun onEventCaptured(photoFile: File?, videoFile: File?)
    }

    private val eventDir = File(context.cacheDir, "security_events").apply {
        if (!exists()) mkdirs()
    }

    private var isCapturing = false

    fun handleMotionEvent() {
        if (isCapturing) {
            Log.i(TAG, "Capture already in progress, skipping")
            return
        }
        isCapturing = true

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val photoFile = File(eventDir, "motion_${timestamp}.jpg")

        Log.i(TAG, "Capturing motion snapshot: ${photoFile.absolutePath}")

        cameraXManager.takePhoto(photoFile, object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                Log.i(TAG, "Snapshot saved successfully: ${photoFile.length()} bytes")
                isCapturing = false
                listener.onEventCaptured(photoFile, null)
            }

            override fun onError(exception: ImageCaptureException) {
                Log.e(TAG, "Snapshot capture error", exception)
                isCapturing = false
                listener.onEventCaptured(null, null)
            }
        })
    }

    fun cleanOldEvents() {
        eventDir.listFiles()?.forEach { file ->
            if (System.currentTimeMillis() - file.lastModified() > 24 * 3600 * 1000L) {
                file.delete()
            }
        }
    }
}
