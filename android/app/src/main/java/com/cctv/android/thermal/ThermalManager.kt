package com.cctv.android.thermal

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.util.Log

class ThermalManager(
    private val context: Context,
    private val listener: ThermalListener
) {
    private val TAG = "ThermalManager"

    interface ThermalListener {
        fun onTemperatureUpdate(tempCelsius: Float, status: ThermalStatus)
    }

    enum class ThermalStatus {
        NORMAL,  // < 40°C
        WARM,    // 40°C - 45°C
        CRITICAL // > 45°C
    }

    private var receiver: BroadcastReceiver? = null

    fun start() {
        receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, intent: Intent) {
                if (intent.action == Intent.ACTION_BATTERY_CHANGED) {
                    val tempTenths = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)
                    val tempCelsius = tempTenths / 10.0f

                    val status = when {
                        tempCelsius >= 45.0f -> {
                            Log.w(TAG, "CRITICAL TEMPERATURE WARNING: ${tempCelsius}°C")
                            ThermalStatus.CRITICAL
                        }
                        tempCelsius >= 40.0f -> {
                            Log.i(TAG, "WARM TEMPERATURE: ${tempCelsius}°C")
                            ThermalStatus.WARM
                        }
                        else -> ThermalStatus.NORMAL
                    }

                    listener.onTemperatureUpdate(tempCelsius, status)
                }
            }
        }

        context.registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }

    fun stop() {
        receiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (e: Exception) {}
        }
        receiver = null
    }
}
