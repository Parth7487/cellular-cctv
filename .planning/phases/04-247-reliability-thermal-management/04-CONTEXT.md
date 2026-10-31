# Phase 4 Context: 24/7 Reliability & Thermal Management

## Phase Goal
Enable the Android CCTV phone to operate completely unattended 24 hours a day, 7 days a week, plugged into a charger without being killed by Android OS battery optimization or memory trimming, without burning into the OLED display, and with automatic recovery upon device reboot.

## Key Technical Decisions
1. **Android Foreground Service (`CctvForegroundService.kt`)**:
   - Uses `startForeground()` with a high-priority ongoing notification (`NotificationChannel.IMPORTANCE_LOW` to avoid annoying chime but persistent).
   - In Android 14 (API 34), foreground services require declaring foreground service types: `foregroundServiceType="camera|microphone|specialUse"`.
   - Acquires `PowerManager.PARTIAL_WAKE_LOCK` to keep CPU active for WebRTC signaling and camera hardware when the display is sleeping or overlaid.
   - Decouples signaling and WebRTC streaming from `MainActivity` lifecycle so streaming continues even if the user minimizes or closes the UI.

2. **Boot Auto-Start (`BootReceiver.kt`)**:
   - `BroadcastReceiver` listening to `android.intent.action.BOOT_COMPLETED` and `android.intent.action.MY_PACKAGE_REPLACED`.
   - Checks `SharedPreferences` to see if the CCTV service was running before reboot. If enabled, automatically launches the Foreground Service.

3. **OLED Thermal & Burn-In Protection**:
   - Continuous full-brightness screen operation generates high battery heat and causes permanent OLED pixel burn-in.
   - Provide an automated screen dimming mode: when OLED Saver is engaged, set window brightness to minimal (`window.attributes.screenBrightness = 0.01f`), hide system UI bars (immersive sticky mode), and display a true-black (`#000000`) view where OLED pixels turn off completely.
   - Thermal throttle protection: monitor Android BatteryManager temperature broadcasts (`ACTION_BATTERY_CHANGED`) and log/adjust video framerate if phone temperature exceeds 45°C.
