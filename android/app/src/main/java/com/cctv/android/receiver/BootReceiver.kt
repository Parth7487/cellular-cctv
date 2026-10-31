package com.cctv.android.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.cctv.android.service.CctvForegroundService

class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"
    private val PREFS_NAME = "cctv_prefs"
    private val KEY_SERVICE_ENABLED = "key_service_enabled"
    private val KEY_SERVER_URL = "key_server_url"
    private val KEY_ROOM_ID = "key_room_id"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.i(TAG, "Received broadcast action: $action")

        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isEnabled = prefs.getBoolean(KEY_SERVICE_ENABLED, false)

            if (isEnabled) {
                val serverUrl = prefs.getString(KEY_SERVER_URL, "wss://cellular-cctv.onrender.com")
                val roomId = prefs.getString(KEY_ROOM_ID, "cctv-room-1")

                Log.i(TAG, "Auto-starting CCTV service after boot/update for room: $roomId")

                val serviceIntent = Intent(context, CctvForegroundService::class.java).apply {
                    this.action = CctvForegroundService.ACTION_START
                    putExtra(CctvForegroundService.EXTRA_SERVER_URL, serverUrl)
                    putExtra(CctvForegroundService.EXTRA_ROOM_ID, roomId)
                }

                try {
                    ContextCompat.startForegroundService(context, serviceIntent)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to auto-start foreground service on boot", e)
                }
            } else {
                Log.i(TAG, "CCTV service was not running before reboot. Skipping auto-start.")
            }
        }
    }
}
