# SignVision — Build, Packaging & Deployment Manual

> **Master guide for local compilation, EAS Cloud builds, Android Dev Client packaging, and production bundling.**

---

## ⚡ 1. Brief Build Summary (TL;DR)

### Quick Run Commands

```bash
# 1. Run Web Client (Development)
cd Application && npm run web

# 2. Run Android Dev Client (Physical Device / Emulator)
cd Application && npx expo start --dev-client --clear

# 3. Build Android Development APK via EAS Cloud
cd Application && eas build --profile development --platform android

# 4. Build Standalone Web Production Bundle
cd Application && npx expo export --platform web
```

### Build Environment Requirements
- **Node.js**: v18.x or v20.x
- **Java Development Kit**: OpenJDK 17 (`JAVA_HOME` configured)
- **Android SDK**: Build-tools 34.0.0, Platform API 34
- **EAS CLI**: `npm install -g eas-cli` (v12+)

---

## 🛠️ 2. Detailed Build & Packaging Specification

### 2.1 Project Target Matrix & Environments

| Target Platform | Runtime / Distribution | Native Dependencies | Build Method |
|:---|:---|:---|:---|
| **Android (Dev)** | Custom Dev Client APK | `expo-speech-recognition`, `react-native-webview`, `expo-camera` | EAS Cloud or `npx expo run:android` |
| **Android (Prod)** | Standalone Release APK | Same as above | `eas build --profile production --platform android` |
| **Web (Dev)** | Webpack / Metro Web | HTML5 Audio, WebGL, WebRTC / MediaRecorder | `npx expo start --web` |
| **Web (Prod)** | Static SPA Bundle | Same as above | `npx expo export --platform web` |

> **Critical Note on Expo Go**: The SignVision client uses `expo-speech-recognition`, which contains custom native C++/Java bindings. Therefore, the app **cannot run in standard Expo Go** on Android and requires a **Custom Dev Client APK**.

---

### 2.2 Building the Android Dev Client

#### Method A: Cloud Build via Expo Application Services (Recommended)
This method builds the native Android binary in Expo's cloud infrastructure without requiring a local Android SDK installation:

1. **Install EAS CLI and Log In**:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. **Configure Project (`eas.json`)**:
   Verify that `Application/eas.json` contains the development profile:
   ```json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal"
       },
       "production": {}
     }
   }
   ```
3. **Trigger Cloud Build**:
   ```bash
   cd Application
   eas build --profile development --platform android
   ```
4. **Install APK**: Download the generated `.apk` link to your Android device and install it.

#### Method B: Local Native Android Build (`npx expo run:android`)
If you have Android Studio and JDK 17 installed locally:

1. **Ensure Android SDK & Java Environment**:
   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
   ```
2. **Prebuild & Compile**:
   ```bash
   cd Application
   npx expo run:android
   ```
3. **Low-RAM Machine Flags**: If your workstation has $\le$ 16GB RAM, add the following to `Application/android/gradle.properties`:
   ```properties
   org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
   org.gradle.parallel=false
   ```

---

### 2.3 Web Packaging & Static Export

To build the optimized static distribution for web hosting (e.g. Vercel, Netlify, AWS S3):

```bash
cd Application
npx expo export --platform web
```
- **Output Directory**: `Application/dist/`
- **Serving Locally**:
  ```bash
  npx serve Application/dist
  ```

---

### 2.4 Native Permissions & Manifest Configuration

All required Android and iOS permissions are declared centrally in `Application/app.json`:

```json
{
  "expo": {
    "name": "SignVision",
    "slug": "signvision",
    "version": "1.0.0",
    "orientation": "portrait",
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow SignVision to access camera for sign language gesture translation."
        }
      ],
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "Allow SignVision to recognize speech for sign translation."
        }
      ]
    ],
    "android": {
      "package": "com.signvision.app",
      "permissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
        "android.permission.INTERNET"
      ]
    }
  }
}
```

---

### 2.5 Backend Packaging & Containerization

Both FastAPI backends are built as stateless asynchronous Python microservices.

#### Running in Production via Uvicorn & Gunicorn
```bash
# Core Backend (:8000)
cd backend
source .venv/bin/activate
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# Video Microservice (:8001)
cd video-service
source .venv/bin/activate
gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001
```

---

*SignVision — Reliable builds, predictable runtimes.*
