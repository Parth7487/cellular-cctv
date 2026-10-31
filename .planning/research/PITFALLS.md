# Pitfalls Research

**Domain:** Cellular Android CCTV & WebRTC Surveillance
**Researched:** 2026-10-30
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Carrier-Grade NAT (CGNAT) Connection Black Hole

**What goes wrong:**
WebRTC streams work fine on local Wi-Fi during testing, but immediately fail to connect or hang on "Connecting..." as soon as the phone runs on 4G/5G cellular data.

**Why it happens:**
Mobile cellular carriers do not assign public IP addresses to phones; they use Symmetric CGNAT and block inbound ports. A standard STUN server cannot map a predictable port across differing endpoints.

**How to avoid:**
Always configure a TURN server supporting both UDP and TURNS over TCP port 443 (e.g. Free Metered.ca TURN API or Coturn). The app falls back to relay automatically when P2P hole-punching fails.

**Warning signs:**
`iceConnectionState` switches to `failed` or stays on `checking` indefinitely on cellular data.

**Phase to address:**
Phase 1 & Phase 2 (Signaling & WebRTC Network Layer).

---

### Pitfall 2: Android Battery Swelling & Thermal Overheating (24/7 Plugged-In)

**What goes wrong:**
Running a phone with the screen on and camera streaming 24/7 plugged into a charger causes battery overheating, battery swelling (pillow effect), and potential hardware damage.

**Why it happens:**
Continuous power delivery at 100% state-of-charge combined with display heat and CPU video encoding generates intense trapped thermal energy.

**How to avoid:**
1. Implement an OLED pure black (`#000000`) screen saver overlay that dims the display completely (pixels turn off on OLED/AMOLED screens).
2. Implement On-Demand streaming: only encode and stream video when a viewer is actually connected.
3. Recommend using a smart plug or battery charge limiter (e.g., stopping charge at 80% if rooted, or cycling power).

**Warning signs:**
Phone chassis feels hot to the touch (>45°C), or battery report shows high temperatures.

**Phase to address:**
Phase 3 (Android Service & Power Management).

---

### Pitfall 3: Android OS Killing the Background Camera Service

**What goes wrong:**
The CCTV camera works for 15-30 minutes, then silently goes offline and stops responding.

**Why it happens:**
Modern Android OEM battery optimizations (Doze mode, Samsung/Xiaomi aggressive background killers) terminate background tasks and release camera locks unless explicitly configured.

**How to avoid:**
1. Run a persistent Android Foreground Service displaying an ongoing system notification.
2. Acquire a `PARTIAL_WAKE_LOCK`.
3. Guide the user through the one-time step of disabling "Battery Optimization" for the app in Android OS settings.

**Warning signs:**
The stream drops whenever the phone enters sleep or after several minutes of inactivity.

**Phase to address:**
Phase 3 (Android Service & Lifecycle).

---

### Pitfall 4: Mobile Data Exhaustion from Continuous Streaming

**What goes wrong:**
The SIM card runs out of high-speed monthly data in 2-3 days, rendering the CCTV camera completely offline.

**Why it happens:**
Continuous 1080p video streaming uses ~1.5 GB per hour. Over a month, that requires over 1,000 GB of cellular data.

**How to avoid:**
1. Do not stream continuously over the cell network. Keep the phone in low-power listening mode.
2. Stream only on-demand when the user opens the web dashboard.
3. For surveillance recordings, use motion detection to record and upload short 10-second compressed clips / photo snapshots to Telegram rather than continuous video.

**Phase to address:**
Phase 2 (Signaling) & Phase 4 (Motion Detection & Storage).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using STUN only without TURN | Skips setting up TURN relay | Fails completely on most 4G/5G mobile carriers | Only on LAN Wi-Fi testing |
| Keeping full screen on during preview | Easy to verify camera preview | Burns screen and overheats battery within days | Never for 24/7 use |
| Continuous cloud upload | Simple recording architecture | High cloud and mobile data costs | Only with unlimited Wi-Fi |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telegram Bot API | Uploading raw large uncompressed MP4 files | Encode compressed H.264 720p 10-second clips before upload |
| WebRTC Audio | Neglecting acoustic echo cancellation | Enable hardware `AcousticEchoCanceler` and `NoiseSuppressor` on Android audio record |
| Camera Flash / Torch | Leaving flash on continuously | Include a safety auto-timeout (e.g., 5-minute timer) to prevent LED burnout |

---
*Pitfalls research for: Cellular Android CCTV*
*Researched: 2026-10-30*
