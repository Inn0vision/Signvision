# SignVision — Video Capture & Camera UI Specification (`video-service/frontend.md`)

> **Master specification for cross-platform camera capture, uncropped aspect-ratio layout, and gesture analysis feedback.**

---

## ⚡ 1. Brief UX Overview (TL;DR)

`CameraTranslateScreen.tsx` provides a mobile and web camera interface for recording Indian Sign Language (ISL) gestures and submitting them to the local Video Microservice (`:8001`).

### Core Camera Invariants
- **Uncropped Viewport Layout**: The camera preview preserves a natural 3:4 (portrait) or 16:9 (landscape) aspect ratio computed dynamically via `useWindowDimensions()`. It avoids full-screen stretch-to-cover on tall mobile displays ($20:9$ / $19.5:9$) which previously caused excessive zooming and cropped signers' hands out of frame.
- **Ergonomic 4-Second Window**: Recording duration is tuned to 4 seconds max (with instant tap-to-stop), aligning with the 16-frame uniform gesture sequence expected by the local ML model.
- **No Unconfident Avatar Calls**: Uncertain predictions (< 50% confidence or low hand coverage) display a friendly retry card and NEVER trigger the avatar playback pipeline. Confident translations display a confidence match badge and allow one-tap playback in the 3D CWASA avatar.
