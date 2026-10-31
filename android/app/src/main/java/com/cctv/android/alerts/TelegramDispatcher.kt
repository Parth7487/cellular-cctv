package com.cctv.android.alerts

import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.IOException

class TelegramDispatcher(
    private val botToken: String,
    private val chatId: String
) {
    private val TAG = "TelegramDispatcher"
    private val client = OkHttpClient()

    fun isConfigured(): Boolean {
        return botToken.isNotBlank() && chatId.isNotBlank()
    }

    fun sendPhotoAlert(photoFile: File, caption: String, onComplete: ((Boolean) -> Unit)? = null) {
        if (!isConfigured()) {
            Log.w(TAG, "Telegram Bot Token or Chat ID not configured. Skipping alert.")
            onComplete?.invoke(false)
            return
        }

        val url = "https://api.telegram.org/bot${botToken}/sendPhoto"
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("chat_id", chatId)
            .addFormDataPart("caption", caption)
            .addFormDataPart("parse_mode", "Markdown")
            .addFormDataPart(
                "photo",
                photoFile.name,
                photoFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
            )
            .build()

        val request = Request.Builder().url(url).post(requestBody).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to send Telegram photo alert", e)
                onComplete?.invoke(false)
            }

            override fun onResponse(call: Call, response: Response) {
                val success = response.isSuccessful
                if (success) {
                    Log.i(TAG, "Telegram photo alert dispatched successfully!")
                    try { photoFile.delete() } catch (e: Exception) {}
                } else {
                    Log.e(TAG, "Telegram API error: ${response.code} - ${response.body?.string()}")
                }
                response.close()
                onComplete?.invoke(success)
            }
        })
    }

    fun sendVideoAlert(videoFile: File, caption: String, onComplete: ((Boolean) -> Unit)? = null) {
        if (!isConfigured()) return

        val url = "https://api.telegram.org/bot${botToken}/sendVideo"
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("chat_id", chatId)
            .addFormDataPart("caption", caption)
            .addFormDataPart("parse_mode", "Markdown")
            .addFormDataPart(
                "video",
                videoFile.name,
                videoFile.asRequestBody("video/mp4".toMediaTypeOrNull())
            )
            .build()

        val request = Request.Builder().url(url).post(requestBody).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to send Telegram video alert", e)
                onComplete?.invoke(false)
            }

            override fun onResponse(call: Call, response: Response) {
                val success = response.isSuccessful
                if (success) {
                    Log.i(TAG, "Telegram video alert dispatched successfully!")
                    try { videoFile.delete() } catch (e: Exception) {}
                }
                response.close()
                onComplete?.invoke(success)
            }
        })
    }
}
