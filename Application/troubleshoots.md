# SignVision — Frontend Troubleshooting & Debugging Manual (`troubleshoots.md`)

> **Comprehensive troubleshooting manual, diagnostic checklists, and resolution guides for mobile, web, WebGL, and network issues.**

---

## ⚡ 1. Brief Quick-Fix Cheat Sheet (TL;DR)

| Error / Symptom | Likely Cause | 60-Second Fix |
|:---|:---|:---|
| **`Network request failed`** on Android | Device cannot reach `localhost:8000` | Replace `localhost` with PC LAN IP in `Application/.env` or run `adb reverse tcp:8000 tcp:8000`. |
| **`Cross-Origin Request Blocked`** on Web | Browser blocked CORS preflight request | Verify `backend/app/main.py` has `allow_credentials=False` and `allow_origins=["*"]`. |
| **Avatar Canvas is Black / Blank** | WebGL context lost or remote CDN blocked | Ensure hardware acceleration is enabled; check internet connection to UEA CDN (`cwasaload.js`). |
| **Microphone Permission Denied** | Android permission not granted in settings | Ensure `expo-speech-recognition` plugin is in `app.json`; grant mic access in device App Settings. |
| **Stale State / Old Code Running** | Metro bundler cache holding old modules | Restart Metro with cache cleared: `npx expo start --dev-client --clear`. |
| **`TypeError: Cannot read property 'playSign'`** | Message sent before avatar initialization | Ensure avatar emits `status: 'idle'` before sending `play` commands. |

---

## 🛠️ 2. Detailed Diagnostic & Resolution Manual

### 2.1 Network Connectivity & Cross-Origin Issues

#### Issue 1: "Network request failed" when submitting sentence
- **Root Cause**: On physical mobile devices, `localhost` resolves to the device itself (loopback `127.0.0.1`), not your development PC.
- **Diagnostic Steps**:
  1. Check what IP is configured in `Application/.env`:
     ```ini
     # WRONG for physical devices:
     EXPO_PUBLIC_API_URL=http://localhost:8000
     # CORRECT:
     EXPO_PUBLIC_API_URL=http://10.26.215.140:8000
     ```
  2. Verify that your development PC backend is listening on `0.0.0.0`, not `127.0.0.1`:
     ```bash
     netstat -tuln | grep 8000
     # Should show 0.0.0.0:8000, NOT 127.0.0.1:8000
     ```
  3. Verify phone can reach PC: Open Chrome on the phone and visit `http://<PC_IP>:8000/health`.
- **Resolution via USB Fallback**:
  If Wi-Fi router isolates clients, connect phone via USB with USB Debugging enabled:
  ```bash
  adb reverse tcp:8000 tcp:8000
  adb reverse tcp:8001 tcp:8001
  ```
  Now `http://localhost:8000` will work directly on the device.

#### Issue 2: CORS Preflight Failure in Web Mode
- **Symptom**: Console outputs `Reason: CORS request did not succeed. Status code: (null)` or `The Same Origin Policy disallows reading the remote resource`.
- **Root Cause**: FastAPI's `CORSMiddleware` was configured with `allow_origins=["*"]` AND `allow_credentials=True`. Under the W3C Fetch specification, wildcards with credentials are explicitly prohibited and rejected by modern browsers.
- **Resolution**:
  In `backend/app/main.py`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=False,  # MUST be False with wildcard origins
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

---

### 2.2 CWASA 3D WebGL Avatar Troubleshooting

#### Issue 3: WebGL Avatar Not Rendering (Black Box)
- **Root Cause**:
  1. The device does not support WebGL in WebViews, or hardware acceleration is disabled.
  2. The embedded HTML template failed to download external CWASA scripts from the University of East Anglia CDN.
- **Diagnostic Steps**:
  1. Check device logcat or browser console for `WebGL unsupported` or `ERR_NAME_NOT_RESOLVED`.
  2. Ensure the device has an active internet connection to download:
     - `https://vhg.cmp.uea.ac.uk/tech/jas/cwa/cwasaload.js`
- **Resolution**:
  - In `app.json`, ensure Android hardware acceleration is enabled:
    ```json
    "android": {
      "hardwareAccelerated": true
    }
    ```
  - Never unmount `AvatarWebView` during normal navigation. Keep it mounted to avoid reinitializing the WebGL canvas context.

#### Issue 4: Sign Animation Drops or Freezes Mid-Sequence
- **Root Cause**: React state updates were mutating the animation queue asynchronously, causing the next sign to fire before the previous sign finished.
- **Resolution**:
  Use the **Ref-Buffer Pattern** established in `HomeScreen.tsx`:
  - Store the active sequence in `signQueueRef.current`.
  - Advance the queue only upon receiving the `status: 'idle'` telemetry event from the avatar WebView.

---

### 2.3 Audio & Speech Recognition Troubleshooting

#### Issue 5: Microphone Button Tap Does Nothing
- **Root Cause**: Native audio permissions were denied or `expo-speech-recognition` native module is not present in the runtime.
- **Diagnostic Steps**:
  - Are you running inside standard **Expo Go**?
    `expo-speech-recognition` requires custom native code and **will not work in Expo Go**. You must build and run a **Custom Dev Client APK**.
- **Resolution**:
  1. Build the Dev Client APK:
     ```bash
     cd Application && eas build --profile development --platform android
     ```
  2. Install the resulting APK on your device.
  3. Start Metro with:
     ```bash
     npx expo start --dev-client --clear
     ```

---

### 2.4 Cache & Build Artifact Reset Commands

When subtle errors persist across code edits, flush caches in order:

```bash
# 1. Clear Metro bundler cache
cd Application && npx expo start --clear

# 2. Clear Node module cache
rm -rf Application/node_modules/.cache

# 3. Clear Android Gradle cache (if building locally)
cd Application/android && ./gradlew clean && cd ../..
```

---

*SignVision — Troubleshooting & Diagnostic Reference.*
