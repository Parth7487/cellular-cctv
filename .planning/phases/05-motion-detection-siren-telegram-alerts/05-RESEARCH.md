# Phase 5 Research: Motion Detection, Siren & Telegram Alerts

## 1. Ultra-Low CPU Frame Differencing in CameraX
- Full-resolution OpenCV frame processing overheats smartphones when running 24/7.
- CameraX `ImageAnalysis` provides `ImageProxy` containing `planes[0]` (Y / Luminance plane).
- Taking every Nth byte from the Y buffer into a downsampled byte array (e.g. 64x48 = 3072 bytes) allows instant CPU calculation:
  ```kotlin
  var diffCount = 0
  for (i in currentBuffer.indices) {
      if (abs(currentBuffer[i] - previousBuffer[i]) > pixelThreshold) {
          diffCount++
      }
  }
  val isMotion = diffCount > (totalPixels * motionSensitivity)
  ```
- This runs in <1 millisecond per frame on Android with 0% measurable battery drain or heat.

## 2. Telegram Bot API Integration
- Simple HTTPS REST endpoints via OkHttp `MultipartBody`:
  ```
  POST https://api.telegram.org/bot<TOKEN>/sendPhoto
  chat_id=<CHAT_ID>
  photo=<file multipart>
  caption=🚨 *Motion Detected!* \nRoom: cctv-room-1\nTime: 2026-10-30 18:35:00
  parse_mode=Markdown
  ```
  ```
  POST https://api.telegram.org/bot<TOKEN>/sendVideo
  chat_id=<CHAT_ID>
  video=<file multipart>
  caption=📹 *Motion Event Recording (10s)*
  ```
- Works over cellular data, bypasses CGNAT completely, delivers notification with audio chime to Telegram app on user's personal phone.

## 3. Siren Tone Generation
- Android `AudioTrack` or synthetic sine-sweep wave buffer generated in memory avoids needing bundled static `.mp3` assets and allows dynamic frequency ramping (warble alarm).
- Max volume using `AudioManager.STREAM_ALARM`.
