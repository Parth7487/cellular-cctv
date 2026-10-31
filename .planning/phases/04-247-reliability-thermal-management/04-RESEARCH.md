# Phase 4 Research: 24/7 Reliability & Thermal Management

## 1. Foreground Service Requirements for Android API 26-34
- **Notification Channel**: Required on Android 8.0 (API 26)+. `NotificationChannel("cctv_service_channel", "CCTV Service", NotificationManager.IMPORTANCE_LOW)`.
- **Android 14 (API 34) Foreground Service Types**:
  - `AndroidManifest.xml` must declare:
    ```xml
    <service
        android:name=".service.CctvForegroundService"
        android:enabled="true"
        android:exported="false"
        android:foregroundServiceType="camera|microphone" />
    ```
  - `ServiceCompat.startForeground()` must pass appropriate type flags.

## 2. Power Management & Doze Mode
- `PowerManager.PARTIAL_WAKE_LOCK`: Keeps CPU awake while allowing screen to turn off or display pure black.
- `WakeLock.acquire()` with tag `"CellularCCTV:ServiceWakeLock"`.
- Battery Optimization Intent: Prompt user to whitelist the app from battery optimizations via `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.

## 3. Boot & Auto-Restart Handling
- Permission: `<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />`
- Receiver:
  ```xml
  <receiver android:name=".receiver.BootReceiver" android:enabled="true" android:exported="true">
      <intent-filter>
          <action android:name="android.intent.action.BOOT_COMPLETED" />
          <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
      </intent-filter>
  </receiver>
  ```
- Starts `CctvForegroundService` directly on boot using `ContextCompat.startForegroundService(context, intent)`.

## 4. OLED Black Screen & Thermal Safety
- Setting `WindowManager.LayoutParams.screenBrightness = 0.01f` dims the backlight to the hardware minimum.
- Solid `#000000` view draws 0 current on AMOLED/OLED displays because individual OLED sub-pixels emit no light when completely black.
- Battery Temperature monitoring:
  ```kotlin
  val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
  val temp = (batteryIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10.0f
  ```
  If temperature exceeds 45°C, log a thermal warning and throttle preview updates.
