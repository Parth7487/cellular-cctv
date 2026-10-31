package com.cctv.android.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.cctv.android.service.CctvForegroundService
import com.cctv.android.sms.SmsRepository

class SmsReceiver : BroadcastReceiver() {

    private val TAG = "SmsReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) return

            val sender = messages[0].displayOriginatingAddress ?: "Unknown"
            val bodyBuilder = StringBuilder()
            var timestamp = System.currentTimeMillis()

            for (msg in messages) {
                bodyBuilder.append(msg.displayMessageBody)
                timestamp = msg.timestampMillis
            }

            val body = bodyBuilder.toString()
            Log.i(TAG, "Incoming SIM SMS from: $sender (length: ${body.length})")

            // 1. Cache in repository
            SmsRepository.addLiveMessage(context, sender, body, timestamp)

            val contactName = SmsRepository.resolveContactName(context, sender)

            // 2. Relay directly to connected Web Dashboard viewers
            CctvForegroundService.activeController?.broadcastSms(
                address = sender,
                name = contactName ?: "",
                type = "received",
                body = body,
                timestamp = timestamp
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse incoming SMS: ${e.message}", e)
        }
    }
}
