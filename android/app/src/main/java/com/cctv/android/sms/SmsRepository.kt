package com.cctv.android.sms

import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.CopyOnWriteArrayList

object SmsRepository {
    private const val TAG = "SmsRepository"
    private val liveCache = CopyOnWriteArrayList<JSONObject>()
    private const val MAX_CACHE_SIZE = 50

    fun addLiveMessage(context: Context, address: String, body: String, timestamp: Long) {
        val contactName = resolveContactName(context, address)
        val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault())
        val formattedDate = sdf.format(Date(timestamp))

        val item = JSONObject().apply {
            put("id", "live_${timestamp}_${address.hashCode()}")
            put("type", "received")
            put("address", address)
            put("name", contactName ?: "")
            put("sender", if (!contactName.isNullOrBlank()) "$contactName ($address)" else address)
            put("body", body)
            put("timestamp", timestamp)
            put("dateTime", formattedDate)
        }

        liveCache.add(0, item)
        if (liveCache.size > MAX_CACHE_SIZE) {
            liveCache.removeAt(liveCache.size - 1)
        }
        Log.i(TAG, "Cached live SMS from $address (${contactName ?: "No Contact Name"}). Cache size: ${liveCache.size}")
    }

    fun resolveContactName(context: Context, number: String?): String? {
        if (number.isNullOrBlank()) return null

        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) return null

        return try {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(number)
            )
            val projection = arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME)
            context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                    if (nameIdx >= 0) cursor.getString(nameIdx) else null
                } else null
            }
        } catch (e: Exception) {
            Log.d(TAG, "Contact lookup skipped for $number: ${e.message}")
            null
        }
    }

    fun getRecentMessages(context: Context, limit: Int = 40): JSONArray {
        val result = JSONArray()
        val seenSignatures = HashSet<String>()
        val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault())

        // 1. Add any live-cached messages first
        for (item in liveCache) {
            val sig = "${item.optString("address")}_${item.optLong("timestamp")}_${item.optString("type")}"
            if (seenSignatures.add(sig)) {
                result.put(item)
            }
            if (result.length() >= limit) return result
        }

        // 2. Query system SMS provider (Sent & Received) if READ_SMS is granted
        val hasSmsPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasSmsPermission) {
            Log.w(TAG, "READ_SMS permission not granted; returning live-cached messages only")
            return result
        }

        try {
            // Query Telephony.Sms.CONTENT_URI to include both INBOX (received) and SENT messages
            val uri: Uri = Telephony.Sms.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE
            )

            val cursor: Cursor? = context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                "${Telephony.Sms.DATE} DESC LIMIT $limit"
            )

            cursor?.use {
                val idIdx = it.getColumnIndex(Telephony.Sms._ID)
                val addrIdx = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIdx = it.getColumnIndex(Telephony.Sms.BODY)
                val dateIdx = it.getColumnIndex(Telephony.Sms.DATE)
                val typeIdx = it.getColumnIndex(Telephony.Sms.TYPE)

                while (it.moveToNext()) {
                    val msgId = if (idIdx >= 0) it.getString(idIdx) ?: "" else ""
                    val address = if (addrIdx >= 0) it.getString(addrIdx) ?: "Unknown" else "Unknown"
                    val body = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""
                    val timestamp = if (dateIdx >= 0) it.getLong(dateIdx) else System.currentTimeMillis()
                    val typeInt = if (typeIdx >= 0) it.getInt(typeIdx) else Telephony.Sms.MESSAGE_TYPE_INBOX

                    val messageType = when (typeInt) {
                        Telephony.Sms.MESSAGE_TYPE_SENT -> "sent"
                        Telephony.Sms.MESSAGE_TYPE_OUTBOX -> "sent"
                        else -> "received"
                    }

                    val sig = "${address}_${timestamp}_$messageType"
                    if (seenSignatures.add(sig)) {
                        val contactName = resolveContactName(context, address)
                        val formattedDate = sdf.format(Date(timestamp))

                        val item = JSONObject().apply {
                            put("id", msgId)
                            put("type", messageType) // "received" or "sent"
                            put("address", address)
                            put("name", contactName ?: "")
                            put("sender", if (!contactName.isNullOrBlank()) "$contactName ($address)" else address)
                            put("body", body)
                            put("timestamp", timestamp)
                            put("dateTime", formattedDate)
                        }
                        result.put(item)
                    }

                    if (result.length() >= limit) break
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying system SMS content provider: ${e.message}", e)
        }

        return result
    }
}
