# SignVision — Frontend Architecture & Component Specification (`Application_info.md`)

> **Deep technical specification of the React Native client application, screen containers, modular UI primitives, and asynchronous data services.**

---

## ⚡ 1. Brief Summary (TL;DR)

The `Application/` package is the user-facing mobile and web client for SignVision, built on React Native 0.83 and Expo SDK 55.

### Key Highlights
- **Two Core Modes**:
  - **Word Mode**: Completely offline, client-side dictionary lookup (<5ms) using a bundled 1,500-word dataset and character-bigram Dice similarity matching.
  - **Sentence Mode**: Cloud-assisted, grammar-aware translation pipeline querying the Core NLP Backend (`:8000`).
- **Reverse Mode**: Camera-based gesture recording screen streaming video to the Video Microservice (`:8001`) via Gemini 3.6 Flash.
- **Embedded WebGL Avatar**: Hardware-accelerated 3D avatar rendering `.sigml` XML motion files via the CWASA engine.
- **State Management**: Ref-Buffer pattern combining synchronous refs for high-frequency animation queues with asynchronous React state for UI rendering.

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 Screen Architecture

#### `HomeScreen.tsx` (`src/screens/HomeScreen.tsx`)
The primary screen hosting the avatar stage, floating composer, playback history, and active token sequence.

- **State & Ref Architecture**:
  - `signQueueRef`: Synchronous queue holding pending `SignMatch[]` objects. Prevents dropped animation frames caused by batched React state updates.
  - `isPlaying`: Boolean flag tracking whether an animation sequence is currently executing.
  - `currentSign`: The sign object currently being animated by the 3D avatar.
  - `history`: Array of recent search queries and sentence translations stored in device memory.
  - `isSentenceMode`: Boolean toggle switching between offline Word Mode and online Sentence Mode.
- **Animation Sequence Controller**:
  When a sentence response arrives from `:8000`, `HomeScreen` populates `signQueueRef.current`. It transmits the first `.sigml` URL to `AvatarWebView` via `postMessage()`. When the avatar finishes and emits `status: 'idle'`, the screen dequeues the next sign until the queue is empty.
- **Keyboard Avoidance & Thumb-Zone Positioning**:
  Uses `KeyboardAvoidingView` with platform-specific behavior (`padding` on iOS, height adjustment on Android) to keep the floating composer accessible without obscuring the avatar canvas.

#### `CameraTranslateScreen.tsx` (`src/screens/CameraTranslateScreen.tsx`)
The reverse-translation screen capturing continuous ISL sign video for English transcription.

- **Cross-Platform Capture**:
  - **Android/iOS**: Utilizes `expo-camera` (`CameraView`) to record `.mp4` video with hardware h.264 encoding.
  - **Web**: Utilizes HTML5 `navigator.mediaDevices.getUserMedia` and `MediaRecorder` to capture `.webm` video.
- **Payload Generation**:
  Packs recorded video into a `FormData` multipart payload and issues `POST /api/translate-video` to the Video Microservice (`:8001`).
- **UX States**:
  - *Ready / Idle*: Live camera preview with framing guidelines for the signer's upper body and hands.
  - *Recording*: Visual countdown timer (max 8 seconds) with pulsing emerald recording ring.
  - *Processing*: Translucent loading overlay with animated spinner.
  - *Result*: Slide-up card displaying the translated English text and option to sign again.

---

### 2.2 Component Primitives

#### `AvatarWebView.tsx` (`src/components/AvatarWebView.tsx`)
Encapsulates the University of East Anglia (UEA) CWASA WebGL avatar engine inside an isolated `react-native-webview`.

- **HTML/JS Wrapper**:
  Hosts an inline HTML template loading the CWASA runtime (`cwasaload.js`), virtual character assets, and WebGL rendering context.
- **Bridge Protocol**:
  ```typescript
  // Outgoing messages to WebView
  interface AvatarCommand {
    type: 'play' | 'stop';
    url?: string; // AWS S3 URL of .sigml file
  }

  // Incoming messages from WebView
  interface AvatarTelemetry {
    type: 'status';
    status: 'idle' | 'playing' | 'error';
    details?: string;
  }
  ```
- **Lifecycle Invariant**:
  The component must never be unmounted during active sessions. Switching screens or views hides the component via CSS or view hierarchy rather than unmounting, avoiding WebGL context reinitialization.

#### `SearchBar.tsx` (`src/components/SearchBar.tsx`)
The floating thumb-zone composer combining speech-to-text input, keyboard text entry, and mode switching.

- **Speech Recognition Lifecycle**:
  Integrates `expo-speech-recognition`:
  1. Requests native microphone permissions via `requestPermissionsAsync()`.
  2. Binds to `ExpoSpeechRecognitionModule.addSpeechRecognitionListener`.
  3. Displays live partial transcripts as the user speaks.
  4. Automatically finalizes input on speech pause or explicit stop tap.
- **Autocompletion Engine**:
  In Word Mode, queries `s3Service.getSuggestions()` as the user types, displaying a scrollable suggestions strip above the input.

#### Custom UI Primitives (`src/components/ui/`)
- **`Button.tsx`**: Lightweight touchable primitive featuring `variant` presets (`default`, `secondary`, `outline`, `ghost`, `icon`) and tactile scale compression on press.
- **`Input.tsx`**: High-contrast text input with emerald focus border (`#10B981`), clear button, and accessible labels.

---

### 2.3 Client Services Layer

#### `s3Service.ts` (`src/services/s3Service.ts`)
The offline sign dictionary service.

- **Dataset**: Loads bundled `sign_language_data.json` containing 1,500+ sign records.
- **Lookup Cascade**:
  1. **Exact Match**: Direct dictionary lookup of uppercase token.
  2. **Anchor Match**: Scans `anchors` arrays for synonyms (e.g., `AEROPLANE` $\rightarrow$ `AIRPLANE`).
  3. **Partial Match**: Substring containment check.
  4. **Bigram Dice Similarity**: Computes Dice coefficient over adjacent character bigrams:
     $$\text{Dice}(A, B) = \frac{2 \times |A \cap B|}{|A| + |B|}$$
     Returns highest scoring match if above threshold ($0.5$).

#### `apiService.ts` (`src/services/apiService.ts`)
The online REST service communicating with backend microservices.

- **Endpoints**:
  - `processSentence(text: string)`: Calls `POST /process` on Core Backend (`:8000`).
  - `translateVideo(formData: FormData)`: Calls `POST /api/translate-video` on Video Microservice (`:8001`).
- **Resilience**:
  - Implements `AbortController` with a configurable timeout (default 15s).
  - Handles network failures gracefully, bubbling typed error objects to the UI.

---

### 2.4 TypeScript Type Contracts (`src/types/index.ts`)

```typescript
export interface SignMatch {
  word: string;
  url: string;
  match_type: 'exact' | 'anchor' | 'partial' | 'fuzzy' | 'semantic';
  score?: number;
}

export interface GlossSequence {
  tokens: string[];
  sentence: string;
}

export interface ProcessResponse {
  gloss: GlossSequence;
  signs: SignMatch[];
  processing_time_ms: number;
}

export interface VideoTranslationResponse {
  translation: string;
}
```

---

*SignVision — Mobile & Web Client Technical Specification.*
