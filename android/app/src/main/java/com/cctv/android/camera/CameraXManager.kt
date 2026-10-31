package com.cctv.android.camera

import android.content.Context
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraXManager(private val context: Context, private val lifecycleOwner: LifecycleOwner? = null) {

    private val TAG = "CameraXManager"
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var preview: Preview? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var imageCapture: ImageCapture? = null

    private var lensFacing: Int = CameraSelector.LENS_FACING_BACK
    private var isTorchOn: Boolean = false
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var motionAnalyzer: ImageAnalysis.Analyzer? = null

    fun setMotionAnalyzer(analyzer: ImageAnalysis.Analyzer) {
        this.motionAnalyzer = analyzer
        imageAnalysis?.setAnalyzer(cameraExecutor, analyzer)
    }

    fun startCamera(previewView: PreviewView, onStarted: (() -> Unit)? = null) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()
            bindCameraUseCases(previewView)
            onStarted?.invoke()
        }, ContextCompat.getMainExecutor(context))
    }

    private fun bindCameraUseCases(previewView: PreviewView) {
        val provider = cameraProvider ?: return
        val cameraSelector = CameraSelector.Builder().requireLensFacing(lensFacing).build()

        preview = Preview.Builder()
            .setTargetAspectRatio(AspectRatio.RATIO_16_9)
            .build()
            .also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

        imageCapture = ImageCapture.Builder()
            .setTargetAspectRatio(AspectRatio.RATIO_16_9)
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .build()

        imageAnalysis = ImageAnalysis.Builder()
            .setTargetAspectRatio(AspectRatio.RATIO_16_9)
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()

        motionAnalyzer?.let {
            imageAnalysis?.setAnalyzer(cameraExecutor, it)
        }

        try {
            provider.unbindAll()
            val owner = lifecycleOwner
            if (owner != null) {
                camera = provider.bindToLifecycle(
                    owner,
                    cameraSelector,
                    preview,
                    imageCapture,
                    imageAnalysis
                )
            }
            // Apply preserved torch state if back camera
            if (lensFacing == CameraSelector.LENS_FACING_BACK && isTorchOn) {
                camera?.cameraControl?.enableTorch(true)
            }
        } catch (exc: Exception) {
            Log.e(TAG, "Use case binding failed", exc)
        }
    }

    fun takePhoto(outputFile: File, callback: ImageCapture.OnImageSavedCallback) {
        val capture = imageCapture ?: run {
            Log.e(TAG, "Cannot take photo: ImageCapture not initialized")
            return
        }

        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
        capture.takePicture(outputOptions, cameraExecutor, callback)
    }

    fun switchCamera(previewView: PreviewView) {
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
            isTorchOn = false
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
        bindCameraUseCases(previewView)
    }

    fun toggleTorch(): Boolean {
        if (lensFacing != CameraSelector.LENS_FACING_BACK) return false
        val cam = camera ?: return false
        isTorchOn = !isTorchOn
        cam.cameraControl.enableTorch(isTorchOn)
        return isTorchOn
    }

    fun setTorch(enable: Boolean) {
        if (lensFacing != CameraSelector.LENS_FACING_BACK) return
        isTorchOn = enable
        camera?.cameraControl?.enableTorch(isTorchOn)
    }

    fun setZoom(linearZoom: Float) {
        val clamped = linearZoom.coerceIn(0.0f, 1.0f)
        camera?.cameraControl?.setLinearZoom(clamped)
    }

    fun unbind() {
        try {
            camera = null
            cameraProvider?.unbindAll()
            Log.i(TAG, "CameraX unbindAll executed (camera released for WebRTC)")
        } catch (e: Exception) {
            Log.e(TAG, "Error unbinding CameraX", e)
        }
    }

    fun shutdown() {
        cameraExecutor.shutdown()
        cameraProvider?.unbindAll()
    }
}
