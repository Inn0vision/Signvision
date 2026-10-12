# SignVision — Video Capture & Camera UI Specification (`video-service/frontend.md`)

> **Master specification for cross-platform camera capture, recording lifecycles, and gesture analysis feedback.**

---

## ⚡ 1. Brief UX Overview (TL;DR)

`CameraTranslateScreen.tsx` provides a mobile and web camera interface for recording continuous Indian Sign Language (ISL) gestures and submitting them to the Video Microservice (`:8001`).

### Core Invariants
- **Upper-Body Framing**: Visual guides instruct the user to position their face, shoulders, and hands within the central camera frame.
- **Recording Duration**: Enforces an ergonomic 5–8 second recording window (maximum 10 seconds).
- **Direct Streaming**: Video is transmitted directly to `:8001` without heavy client-side preprocessing, preserving mobile battery life and performance.

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 Cross-Platform Recording Architecture

```
┌────────────────────────────────────────────────────────┐
│               CameraTranslateScreen                    │
├──────────────────────────┬─────────────────────────────┤
│  Android / iOS (Native)  │       Web Browser           │
├──────────────────────────┼─────────────────────────────┤
│  expo-camera             │  navigator.mediaDevices     │
│  CameraView component    │  HTML5 <video> preview      │
│  format: video/mp4       │  format: video/webm         │
│  Hardware h.264 encoder  │  MediaRecorder API          │
└──────────────────────────┴─────────────────────────────┘
```

#### Native Android/iOS Implementation (`CameraView`)
- Utilizes Expo's modern `CameraView` component.
- Records using hardware-accelerated AVC/H.264 at 720p 30fps to balance visual fidelity with upload file size ($\sim 3-6$ MB for an 8-second clip).
- Employs `cameraRef.current.recordAsync()` with an automated max duration timer.

#### Web Implementation (`MediaRecorder`)
- Requests camera stream via `navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })`.
- Buffers video chunks into a `Blob` with MIME type `video/webm;codecs=vp8,opus`.
- Converts Blob into a `File` object before appending to `FormData`.

---

### 2.2 Recording Lifecycle States

1. **State 1: Idle / Framing**:
   - Live camera viewfinder active.
   - Semi-transparent guide oval indicating optimal upper-torso placement.
   - Floating record button at the bottom center.
2. **State 2: Active Recording**:
   - Record button transforms into an active square with pulsing emerald border (`#10B981`).
   - Circular progress bar fills over the 8-second window.
   - Haptic feedback pulses at recording start and completion.
3. **State 3: Upload & Analysis**:
   - Viewfinder freezes or dims with a translucent blur backdrop.
   - Shows animated spinner and loading message: *"Interpreting sign language..."*.
4. **State 4: Translation Output**:
   - Elevated result card slides up from the bottom of the screen.
   - Displays the translated English text in high-contrast primary typography (`#F8FAFC`).
   - Quick action buttons: *"Copy Text"*, *"Sign Again"*, and *"Translate to 3D Avatar"*.

---

### 2.3 Gesture Overlay & Framing Guidelines

To maximize Gemini 3.6 Flash recognition accuracy, the UI enforces specific spatial guidelines:
- **Signing Safe Zone**: The bounding region where both hands are completely in frame, approximately from waist level to 15cm above the head.
- **Lighting Feedback**: Subtle visual hint if ambient lighting is too dark for clear finger-joint separation.

---

*SignVision — Camera Capture & Gesture UX Specification.*
