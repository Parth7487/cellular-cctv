package com.cctv.android.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.FileProvider
import okhttp3.*

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class AppUpdateManager(private val context: Context) {

    private val TAG = "AppUpdateManager"
    private val client = OkHttpClient()
    private val mainHandler = Handler(Looper.getMainLooper())

    fun checkForUpdate(serverBaseUrl: String, onStatus: ((String) -> Unit)? = null) {
        val httpBase = serverBaseUrl.replace("wss://", "https://").replace("ws://", "http://")
        val versionUrl = if (httpBase.endsWith("/")) "${httpBase}api/version" else "$httpBase/api/version"

        val currentVersionCode = getLocalVersionCode()
        val currentVersionName = getLocalVersionName()

        Log.i(TAG, "Checking for OTA update at: $versionUrl (Current: v$currentVersionName / $currentVersionCode)")
        onStatus?.invoke("Checking for updates...")

        val request = Request.Builder().url(versionUrl).build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "Update check failed: ${e.message}")
                onStatus?.invoke("Update check failed: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    Log.w(TAG, "Update endpoint returned ${response.code}")
                    return
                }

                val body = response.body?.string() ?: return
                try {
                    val json = JSONObject(body)
                    val remoteVersionCode = json.optInt("versionCode", 0)
                    val remoteVersionName = json.optString("versionName", "")
                    val apkUrl = json.optString("apkUrl", "")

                    Log.i(TAG, "Remote version: $remoteVersionCode ($remoteVersionName), local: $currentVersionCode")

                    if (remoteVersionCode > currentVersionCode && apkUrl.isNotEmpty()) {
                        Log.i(TAG, "Newer version available! Starting background download...")
                        onStatus?.invoke("Downloading update v$remoteVersionName...")
                        downloadAndInstallApk(apkUrl, remoteVersionName, onStatus)
                    } else {
                        Log.i(TAG, "App is already up-to-date.")
                        onStatus?.invoke("App is up-to-date (v$currentVersionName)")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse update info", e)
                }
            }
        })
    }

    private fun getLocalVersionCode(): Int {
        return try {
            val pInfo = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(context.packageName, android.content.pm.PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                pInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode
            }
        } catch (e: Exception) {
            1
        }
    }

    private fun getLocalVersionName(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }


    private fun downloadAndInstallApk(apkUrl: String, versionName: String, onStatus: ((String) -> Unit)?) {
        val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
        val destinationApk = File(updatesDir, "cctv-update.apk")

        val request = Request.Builder().url(apkUrl).build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to download update APK", e)
                onStatus?.invoke("Download failed: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    Log.e(TAG, "APK download failed with HTTP ${response.code}")
                    onStatus?.invoke("Download failed with HTTP ${response.code}")
                    return
                }

                try {
                    val inputStream = response.body?.byteStream() ?: return
                    FileOutputStream(destinationApk).use { output ->
                        inputStream.copyTo(output)
                    }
                    Log.i(TAG, "Update APK downloaded successfully (${destinationApk.length()} bytes)")
                    onStatus?.invoke("APK downloaded. Launching installer...")

                    mainHandler.post {
                        installApk(destinationApk)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error saving update APK", e)
                }
            }
        })
    }

    private fun installApk(apkFile: File) {
        try {
            val authority = "${context.packageName}.provider"
            val apkUri: Uri = FileProvider.getUriForFile(context, authority, apkFile)

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            Log.i(TAG, "Starting Android Package Installer for: $apkUri")
            context.startActivity(installIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch package installer", e)
        }
    }
}
