package com.cctv.android.motion

import android.util.Log
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import java.nio.ByteBuffer
import kotlin.math.abs

class MotionDetector(
    private val sensitivityPercent: Int = 15, // 1 to 100
    private val cooldownMillis: Long = 30_000L,
    private val listener: MotionListener
) : ImageAnalysis.Analyzer {

    private val TAG = "MotionDetector"

    interface MotionListener {
        fun onMotionDetected()
    }

    private val GRID_WIDTH = 64
    private val GRID_HEIGHT = 48
    private val TOTAL_CELLS = GRID_WIDTH * GRID_HEIGHT

    private var previousGrid: ByteArray? = null
    private var lastMotionTime: Long = 0L

    override fun analyze(image: ImageProxy) {
        val yPlane = image.planes[0]
        val buffer = yPlane.buffer
        val width = image.width
        val height = image.height
        val rowStride = yPlane.rowStride
        val pixelStride = yPlane.pixelStride

        val currentGrid = ByteArray(TOTAL_CELLS)

        val xStep = (width / GRID_WIDTH).coerceAtLeast(1)
        val yStep = (height / GRID_HEIGHT).coerceAtLeast(1)

        var cellIndex = 0
        for (gy in 0 until GRID_HEIGHT) {
            val y = (gy * yStep).coerceAtMost(height - 1)
            for (gx in 0 until GRID_WIDTH) {
                val x = (gx * xStep).coerceAtMost(width - 1)
                val bufferIndex = y * rowStride + x * pixelStride
                if (bufferIndex < buffer.limit()) {
                    currentGrid[cellIndex] = buffer.get(bufferIndex)
                }
                cellIndex++
            }
        }

        image.close()

        val prev = previousGrid
        if (prev != null) {
            var diffCount = 0
            val pixelDiffThreshold = 30 // Luminance difference threshold (0-255)

            for (i in 0 until TOTAL_CELLS) {
                val diff = abs((currentGrid[i].toInt() and 0xFF) - (prev[i].toInt() and 0xFF))
                if (diff > pixelDiffThreshold) {
                    diffCount++
                }
            }

            val changedPercentage = (diffCount.toFloat() / TOTAL_CELLS) * 100f
            val now = System.currentTimeMillis()

            if (changedPercentage >= sensitivityPercent && (now - lastMotionTime) > cooldownMillis) {
                lastMotionTime = now
                Log.w(TAG, "MOTION DETECTED: changed ${changedPercentage.toInt()}% of frame")
                listener.onMotionDetected()
            }
        }

        previousGrid = currentGrid
    }

    fun reset() {
        previousGrid = null
        lastMotionTime = 0L
    }
}
