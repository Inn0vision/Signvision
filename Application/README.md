# SignVision Mobile & Web Application (`Application/`)

> **Universal React Native (Expo SDK 55) mobile and web client featuring an embedded WebGL 3D Avatar, speech recognition, and offline sign lookup.**

---

## ⚡ 1. Brief Developer Quickstart (TL;DR)

### Quick Commands

```bash
# 1. Install dependencies
npm install

# 2. Run in Web Browser (Chrome/Firefox)
npm run web
# or: npx expo start --web

# 3. Run on Android Physical Device (via Custom Dev Client)
npx expo start --dev-client --clear
# Press 'a' in terminal or scan QR code in the SignVision Dev Client app

# 4. Check TypeScript types
npx tsc --noEmit
```

### Environment Configuration (`Application/.env`)
```ini
# When developing locally on PC / Web:
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_VIDEO_API_URL=http://localhost:8001

# When developing on a physical device over Wi-Fi:
# Replace localhost with your computer's LAN IP:
# EXPO_PUBLIC_API_URL=http://10.26.215.140:8000
# EXPO_PUBLIC_VIDEO_API_URL=http://10.26.215.140:8001
```

---

## 🛠️ 2. Detailed Frontend Engineering Manual

### 2.1 Component Architecture & Layout Hierarchy

The application follows a component-driven structure with dedicated separation between screen containers, presentational UI primitives, and data services:

```
Application/src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx           # Reusable button with Shadcn-styled variants & scale micro-animations
│   │   └── Input.tsx            # High-contrast text input with emerald focus ring
│   ├── AvatarWebView.tsx        # Embedded hardware-accelerated WebGL 3D Avatar (UEA CWASA)
│   └── SearchBar.tsx            # Floating composer with text input, mic trigger, and mode switch
├── screens/
│   ├── HomeScreen.tsx           # Primary translation dashboard & animation queue manager
│   └── CameraTranslateScreen.tsx# Sign-to-English camera recorder & gesture analysis screen
├── services/
│   ├── apiService.ts            # REST client for Core Backend (:8000) & Video Service (:8001)
│   └── s3Service.ts             # Offline word dictionary & character-bigram Dice matcher
├── types/
│   └── index.ts                 # Central TypeScript interfaces (ProcessResponse, SignMatch, etc.)
└── data/
    └── sign_language_data.json  # Bundled 1,500-word offline dictionary
```

---

### 2.2 Key Engineering Patterns

#### 1. The Ref-Buffer Animation Pattern (`HomeScreen.tsx`)
Because React state updates are asynchronous and batched, relying solely on `useState` for rapid sign animation sequences causes race conditions and dropped frames. `HomeScreen` employs the **Ref-Buffer Pattern**:
```typescript
// 1. Maintain mutable queue in a ref for synchronous access
const signQueueRef = useRef<SignMatch[]>([]);
const [currentSign, setCurrentSign] = useState<SignMatch | null>(null);
const [isPlaying, setIsPlaying] = useState<boolean>(false);

// 2. Enqueue synchronously, then trigger UI state
const playSequence = (matches: SignMatch[]) => {
  signQueueRef.current = [...matches];
  playNextSign();
};

const playNextSign = () => {
  if (signQueueRef.current.length === 0) {
    setIsPlaying(false);
    return;
  }
  const next = signQueueRef.current.shift()!;
  setCurrentSign(next);
  avatarRef.current?.playSign(next.url);
};
```

#### 2. CWASA WebGL 3D Avatar Bridge (`AvatarWebView.tsx`)
- The avatar runs inside a React Native `WebView` executing the CWASA C++-to-JS WebGL animation engine.
- Communication uses `postMessage`:
  - `play`: Transmits the S3 URL of the `.sigml` XML file.
  - `stop`: Halts the current animation.
  - `status`: WebView reports `idle`, `playing`, or `error` back to React Native.
- **Critical Rule**: Do not unmount or conditionally render `AvatarWebView`—re-initializing the WebGL canvas causes a 1–2 second GPU stall.

#### 3. Offline-First Dictionary Lookup (`s3Service.ts`)
When in Word Mode, the client bypasses backend network calls entirely:
1. Performs an in-memory dictionary lookup across 1,500+ words.
2. If exact match fails, searches synonyms and anchors.
3. If still unmatched, calculates character-bigram Dice coefficients to suggest the closest available sign.
4. Latency is typically under 5ms.

#### 4. Native Speech Recognition (`expo-speech-recognition`)
- Integrates with the platform's native speech engine (`SpeechRecognizer` on Android, `SFSpeechRecognizer` on iOS).
- Streams partial recognition results to the text input in real-time.
- Automatically handles audio session management and microphone permission flows.

---

### 2.3 UI/UX Design System ("Obsidian Slate")

- **Background**: `#07080D`
- **Secondary Surfaces**: `#0B0E14`
- **Elevated Surfaces**: `#111722`
- **Primary Accent / Active**: `#10B981` (Emerald)
- **Secondary Accent**: `#06B6D4` (Cyan)
- **Text High-Contrast**: `#F8FAFC`
- **Text Muted**: `#94A3B8`

---

*SignVision — Mobile & Web Client Documentation.*
