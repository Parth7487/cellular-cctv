package com.cctv.android.siren

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.util.Log
import kotlin.math.sin

class SirenManager(private val context: Context) {

    private val TAG = "SirenManager"
    private var isPlaying = false
    private var sirenThread: Thread? = null

    fun playSiren(durationSeconds: Int = 10) {
        if (isPlaying) return
        isPlaying = true

        Log.w(TAG, "SOUNDING ALARM SIREN at maximum volume for ${durationSeconds}s")

        // Set alarm volume to maximum
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
        audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0)

        sirenThread = Thread {
            val sampleRate = 44100
            val bufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .build()

            val audioTrack = AudioTrack.Builder()
                .setAudioAttributes(audioAttributes)
                .setAudioFormat(audioFormat)
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            audioTrack.play()

            val buffer = ShortArray(bufferSize)
            val startTime = System.currentTimeMillis()
            val endTime = startTime + (durationSeconds * 1000L)

            var phase = 0.0

            while (isPlaying && System.currentTimeMillis() < endTime) {
                val progress = ((System.currentTimeMillis() - startTime) % 1000) / 1000.0
                // Frequency sweep from 1200Hz to 2400Hz and back
                val freq = 1200.0 + (1200.0 * sin(progress * Math.PI))

                for (i in buffer.indices) {
                    phase += 2.0 * Math.PI * freq / sampleRate
                    buffer[i] = (sin(phase) * Short.MAX_VALUE * 0.9).toInt().toShort()
                }

                audioTrack.write(buffer, 0, buffer.size)
            }

            try {
                audioTrack.stop()
                audioTrack.release()
            } catch (e: Exception) {}

            isPlaying = false
            Log.i(TAG, "Siren alarm ended")
        }

        sirenThread?.start()
    }

    fun stopSiren() {
        isPlaying = false
        sirenThread?.interrupt()
        sirenThread = null
    }
}
