# SignVision — Universal Component Selection Matrix (`component_matrix.md`)

> **Comprehensive component selection matrix, platform support profiles, and integration specifications.**

---

## ⚡ 1. Brief Component Matrix (TL;DR)

| Component | Role | Supported Platforms | Key Dependencies | State Strategy |
|:---|:---|:---|:---|:---|
| **`AvatarWebView`** | 3D ISL Avatar Stage | Android, iOS, Web | `react-native-webview`, UEA CWASA | Controlled via `postMessage` |
| **`SearchBar`** | Floating Composer | Android, iOS, Web | `expo-speech-recognition`, `react-native` | Local input state + callbacks |
| **`Button`** | Action Primitive | Android, iOS, Web | `react-native` (`Pressable`) | Stateless / Press scale animation |
| **`Input`** | Text Primitive | Android, iOS, Web | `react-native` (`TextInput`) | Forwarded Ref + focus ring state |
| **`CameraTranslate`**| Sign-to-English Video | Android, iOS, Web | `expo-camera`, Web `MediaRecorder` | Local recording state & timers |

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 Component Specifications

#### 1. `AvatarWebView.tsx` (`Application/src/components/AvatarWebView.tsx`)
- **Purpose**: Hosts the WebGL 3D bone animation runtime for rendering Indian Sign Language motion files.
- **Platform Strategy**:
  - Android & iOS: Native `WebView` with hardware acceleration enabled.
  - Web: Standard HTML5 `iframe` or direct WebGL canvas.
- **IPC Interface**:
  - `postMessage(JSON.stringify({ type: 'play', url: sigmlUrl }))`
  - `postMessage(JSON.stringify({ type: 'stop' }))`
  - Listens for `{ type: 'status', status: 'idle' | 'playing' | 'error' }`
- **Rule**: Never unmount or conditionally render during screen transitions to avoid re-allocating GPU contexts.

#### 2. `SearchBar.tsx` (`Application/src/components/SearchBar.tsx`)
- **Purpose**: The floating ergonomic thumb-zone input capsule combining speech recognition, text entry, and mode selection.
- **Ergonomics**: Fixed at the bottom of the viewport with a subtle backdrop blur and `#111722` elevated surface background.
- **Platform Strategy**:
  - Wrapped in `KeyboardAvoidingView` to maintain focus without layout jumps.
  - Native speech recognition powered by `expo-speech-recognition`.

#### 3. Custom UI Primitives (`Application/src/components/ui/`)
- **`Button.tsx`**:
  - Implements variants: `default` (emerald), `secondary` (dark slate), `outline`, `ghost`, and `icon`.
  - Micro-interaction: Smooth press scale transformation (`0.96` scale on press).
  - Strict minimum touch target of 44x44dp for mobile accessibility.
- **`Input.tsx`**:
  - Implements custom focus ring highlighting with emerald accent (`#10B981`).
  - Supports forwarded refs via `React.forwardRef`.

#### 4. `CameraTranslateScreen.tsx` (`Application/src/screens/CameraTranslateScreen.tsx`)
- **Purpose**: Captures sign video gestures for multimodal English translation.
- **Platform Strategy**:
  - Mobile: `expo-camera` (`CameraView`) recording H.264 `.mp4`.
  - Web: `navigator.mediaDevices.getUserMedia` recording VP8/VP9 `.webm`.
- **Backend Bridge**: Streams multipart payload to `:8001/api/translate-video`.

---

*SignVision — Universal Component Selection Matrix.*
