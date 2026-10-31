# Phase 5 Context: Motion Detection, Siren & Telegram Alerts

## Phase Goal
Equip the Android CCTV camera with autonomous surveillance capabilities: lightweight on-device frame difference motion analysis, automated event snapshot and 10-second compressed MP4 clip recording, instant cloud push notifications via Telegram Bot API with attached photos/videos, and an acoustic alarm siren (triggerable remotely from the web dashboard or automatically upon motion).

## Key Architecture & Design Decisions
1. **Lightweight On-Device Motion Detection (`MotionDetector.kt`)**:
   - Uses CameraX `ImageAnalysis` analyzer receiving YUV_420_888 frames.
   - Downsamples Y plane (luminance) to a low-resolution grid (e.g., 32x24 or 64x48) to keep CPU overhead < 2%, avoiding thermal throttling.
   - Computes absolute difference against previous frame. If changed pixel count exceeds threshold (configurable sensitivity), motion is flagged.
   - Cooldown timer (e.g., 30s) prevents alert flooding.

2. **Automated Snapshot & Clip Capture (`SecurityEventManager.kt`)**:
   - When motion is detected:
     1. Captures a JPEG snapshot using CameraX `ImageCapture`.
     2. Initiates a 10-second MP4 recording using CameraX `VideoCapture` or `MediaRecorder`.
     3. Saves artifacts locally in app internal cache directory (`context.cacheDir/security_events/`).

3. **Telegram Bot API Cloud Offloading (`TelegramDispatcher.kt`)**:
   - Telegram Bot API provides free, unlimited cloud storage and instant mobile push notifications without maintaining proprietary push servers or Google Play Services.
   - Configuration: `telegram_bot_token` and `telegram_chat_id` stored in Android SharedPreferences.
   - Uses OkHttp multipart POST requests to:
     - `https://api.telegram.org/bot<TOKEN>/sendPhoto` (caption with timestamp and room ID).
     - `https://api.telegram.org/bot<TOKEN>/sendVideo` (10-second MP4 clip).
   - Deletes local video/snapshot files after successful transmission to preserve phone disk space.

4. **Acoustic Alarm Siren (`SirenManager.kt`)**:
   - Uses Android `MediaPlayer` or audio synthesis tone generator to play a loud, pulsing 1kHz - 3kHz alarm siren at max alarm stream volume (`AudioManager.STREAM_ALARM`).
   - Triggerable:
     - Remotely via Web Dashboard (`trigger_siren` command).
     - Automatically on motion if auto-siren toggle is enabled in settings.
