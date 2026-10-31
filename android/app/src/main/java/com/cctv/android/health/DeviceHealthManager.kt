package com.cctv.android.health

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.DecimalFormat
import java.text.SimpleDateFormat
import java.util.*

object DeviceHealthManager {
    private const val TAG = "DeviceHealthManager"

    fun collectHealthStats(context: Context): JSONObject {
        val root = JSONObject()

        try {
            root.put("battery", getBatteryStats(context))
            root.put("storage", getStorageStats())
            root.put("memory", getMemoryStats(context))
            root.put("system", getSystemStats())
            root.put("topApps", getTopSpaceConsumingApps(context, limit = 15))
            root.put("timestamp", System.currentTimeMillis())
        } catch (e: Exception) {
            Log.e(TAG, "Error collecting device health stats: ${e.message}", e)
        }

        return root
    }

    private fun getBatteryStats(context: Context): JSONObject {
        val battery = JSONObject()
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        if (intent != null) {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val percent = if (level >= 0 && scale > 0) (level * 100) / scale else -1

            val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL

            val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)
            val chargeSource = when (plugged) {
                BatteryManager.BATTERY_PLUGGED_AC -> "AC Wall Charger"
                BatteryManager.BATTERY_PLUGGED_USB -> "USB Port"
                BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless Dock"
                else -> if (isCharging) "Charging" else "On Battery (Discharging)"
            }

            val healthCode = intent.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN)
            val healthStr = when (healthCode) {
                BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
                BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheated"
                BatteryManager.BATTERY_HEALTH_DEAD -> "Dead / Degraded"
                BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Over Voltage"
                BatteryManager.BATTERY_HEALTH_COLD -> "Cold"
                else -> "Normal"
            }

            val tempTenths = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)
            val tempC = tempTenths / 10.0f
            val tempF = (tempC * 9.0f / 5.0f) + 32.0f
            val voltage = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0)

            battery.put("percentage", percent)
            battery.put("isCharging", isCharging)
            battery.put("chargeSource", chargeSource)
            battery.put("health", healthStr)
            battery.put("temperatureC", tempC)
            battery.put("temperatureF", tempF)
            battery.put("voltageMv", voltage)
        } else {
            battery.put("percentage", 100)
            battery.put("isCharging", true)
            battery.put("chargeSource", "Connected")
            battery.put("health", "Good")
            battery.put("temperatureC", 32.0)
            battery.put("temperatureF", 89.6)
            battery.put("voltageMv", 4100)
        }

        return battery
    }

    private fun getStorageStats(): JSONObject {
        val storage = JSONObject()
        try {
            val path = Environment.getDataDirectory()
            val stat = StatFs(path.path)

            val blockSize = stat.blockSizeLong
            val totalBlocks = stat.blockCountLong
            val availableBlocks = stat.availableBlocksLong

            val totalBytes = totalBlocks * blockSize
            val freeBytes = availableBlocks * blockSize
            val usedBytes = totalBytes - freeBytes

            val usedPercent = if (totalBytes > 0) ((usedBytes * 100) / totalBytes).toInt() else 0

            storage.put("totalBytes", totalBytes)
            storage.put("freeBytes", freeBytes)
            storage.put("usedBytes", usedBytes)
            storage.put("usedPercent", usedPercent)
            storage.put("totalFormatted", formatBytes(totalBytes))
            storage.put("freeFormatted", formatBytes(freeBytes))
            storage.put("usedFormatted", formatBytes(usedBytes))
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating storage: ${e.message}")
        }
        return storage
    }

    private fun getMemoryStats(context: Context): JSONObject {
        val memory = JSONObject()
        try {
            val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)

            val totalBytes = memInfo.totalMem
            val availBytes = memInfo.availMem
            val usedBytes = totalBytes - availBytes
            val usedPercent = if (totalBytes > 0) ((usedBytes * 100) / totalBytes).toInt() else 0

            memory.put("totalBytes", totalBytes)
            memory.put("availableBytes", availBytes)
            memory.put("usedBytes", usedBytes)
            memory.put("usedPercent", usedPercent)
            memory.put("totalFormatted", formatBytes(totalBytes))
            memory.put("availableFormatted", formatBytes(availBytes))
            memory.put("usedFormatted", formatBytes(usedBytes))
            memory.put("isLowMemory", memInfo.lowMemory)
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating memory: ${e.message}")
        }
        return memory
    }

    private fun getSystemStats(): JSONObject {
        val sys = JSONObject()
        try {
            val uptimeMs = SystemClock.elapsedRealtime()
            val uptimeStr = formatUptime(uptimeMs)

            val now = Date()
            val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault())
            val tz = TimeZone.getDefault()

            sys.put("uptimeMillis", uptimeMs)
            sys.put("uptimeFormatted", uptimeStr)
            sys.put("localTime", sdf.format(now))
            sys.put("timezone", "${tz.id} (${tz.getDisplayName(false, TimeZone.SHORT)})")
            sys.put("deviceModel", "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}")
            sys.put("androidVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating system stats: ${e.message}")
        }
        return sys
    }

    private fun getTopSpaceConsumingApps(context: Context, limit: Int = 15): JSONArray {
        val list = JSONArray()
        try {
            val pm = context.packageManager
            val packages = pm.getInstalledApplications(0)

            data class AppSpace(
                val name: String,
                val pkg: String,
                val sizeBytes: Long,
                val isSystem: Boolean
            )

            val appSizes = mutableListOf<AppSpace>()

            for (appInfo in packages) {
                try {
                    val apkFile = File(appInfo.sourceDir)
                    var totalSize = if (apkFile.exists()) apkFile.length() else 0L

                    // Check dataDir size if accessible
                    val dataDir = File(appInfo.dataDir)
                    if (dataDir.exists() && dataDir.canRead()) {
                        val subFiles = dataDir.listFiles()
                        if (subFiles != null) {
                            for (f in subFiles) {
                                if (f.isFile) totalSize += f.length()
                            }
                        }
                    }

                    val appName = pm.getApplicationLabel(appInfo).toString()
                    val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0

                    if (totalSize > 0) {
                        appSizes.add(AppSpace(appName, appInfo.packageName, totalSize, isSystem))
                    }
                } catch (_: Exception) {
                }
            }

            // Sort by size descending
            appSizes.sortByDescending { it.sizeBytes }

            for (i in 0 until appSizes.size.coerceAtMost(limit)) {
                val item = appSizes[i]
                val obj = JSONObject().apply {
                    put("name", item.name)
                    put("packageName", item.pkg)
                    put("sizeBytes", item.sizeBytes)
                    put("sizeFormatted", formatBytes(item.sizeBytes))
                    put("isSystemApp", item.isSystem)
                }
                list.put(obj)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating app space usage: ${e.message}")
        }
        return list
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val df = DecimalFormat("#.##")
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        val gb = mb / 1024.0
        val tb = gb / 1024.0

        return when {
            tb >= 1.0 -> "${df.format(tb)} TB"
            gb >= 1.0 -> "${df.format(gb)} GB"
            mb >= 1.0 -> "${df.format(mb)} MB"
            kb >= 1.0 -> "${df.format(kb)} KB"
            else -> "$bytes B"
        }
    }

    private fun formatUptime(uptimeMs: Long): String {
        val seconds = (uptimeMs / 1000) % 60
        val minutes = (uptimeMs / (1000 * 60)) % 60
        val hours = (uptimeMs / (1000 * 60 * 60)) % 24
        val days = uptimeMs / (1000 * 60 * 60 * 24)

        return if (days > 0) {
            "${days}d ${hours}h ${minutes}m"
        } else if (hours > 0) {
            "${hours}h ${minutes}m ${seconds}s"
        } else {
            "${minutes}m ${seconds}s"
        }
    }
}
