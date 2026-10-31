# Phase 2 Summary: Plan 02-02 (WebRTC Sender, On-Demand Streaming, and APK Build)

## What Was Done
- Built `SignalingClient.kt` using OkHttp WebSocket to communicate with signaling server, join rooms under role `camera`, receive ICE configs, and route SDP offer/answer/candidates and remote hardware commands.
- Built `WebRtcManager.kt` using `stream-webrtc-android:1.2.2` with hardware video acceleration (`DefaultVideoEncoderFactory`), acoustic echo cancellation, and STUN/TURN ICE server management.
- Implemented `OnDemandStreamController.kt` providing strict cellular data preservation: only starts WebRTC video capturer and encodes/transmits when viewers are present in the room; pauses video capturer when 0 viewers remain. Handles remote commands for torch and zoom.
- Automated APK compilation via `android/build-apk.sh` which executes `./gradlew assembleDebug` and automatically exports the generated APK directly to `/Users/parth/Downloads/Projects/Random/CCTV/APK/cctv-camera-debug.apk`.
- Verified APK creation (46 MB, targeting Android API 26-34 with all required permissions and activities).

## Verification
- `./android/build-apk.sh` executed cleanly and exited with code 0.
- `aapt dump badging APK/cctv-camera-debug.apk` confirmed valid manifest, package `com.cctv.android.debug`, and declared permissions.
