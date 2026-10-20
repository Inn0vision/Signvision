# SignVision — Principal UI/UX & Architecture Audit Report (`frontend_audit.md`)

> **Comprehensive audit report detailing defect analysis, root-cause investigations, remediation strategies, and architectural invariants.**

---

## ⚡ 1. Brief Audit Summary (TL;DR)

This audit documents the principal-level defect analysis and resolution completed during the UI/UX overhaul of the SignVision mobile and web frontend.

### Defect Remediation Status

| Defect ID | Component | Description | Root Cause | Status |
|:---|:---|:---|:---|:---|
| **DEF-01** | `HomeScreen.tsx` | Composer overlaps history list | Absolute positioning collision | ✅ Resolved (Native layout stacking) |
| **DEF-02** | `SearchBar.tsx` | Double padding & misaligned icons | Nested primitive wrapper | ✅ Resolved (Direct `TextInput` integration) |
| **DEF-03** | `backend/main.py` | CORS preflight error on web | Wildcard origin with credentials | ✅ Resolved (`allow_credentials=False`) |
| **DEF-04** | `HomeScreen.tsx` | Dropped avatar animation frames | Asynchronous state race conditions | ✅ Resolved (Ref-Buffer pattern) |
| **DEF-05** | `s3Service.ts` | 403 Forbidden on asset load | Global S3 URL redirect mismatch | ✅ Resolved (Regional `ap-south-1` routing) |

---

## 🛠️ 2. Detailed Defect Analysis & Engineering Remediation

### 2.1 DEF-01: Floating Composer Layout Collision

#### Symptom
On small-screen Android devices (<6.2 inch) and mobile browsers, the floating search composer covered the search history tray and the sentence/word mode toggle, preventing users from selecting previous queries.

#### Root Cause
The history tray was styled with `position: 'absolute'` and an arbitrary `bottom: 120` offset. When virtual soft keyboards opened, the absolute offset failed to adjust, causing overlapping z-index layers.

#### Remediation
Re-architected the layout tree into a single vertical flex container nested inside `KeyboardAvoidingView`:
```tsx
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <View style={styles.floatingInterface}>
    {/* 1. History Tray natively stacked ABOVE mode selector */}
    {history.length > 0 && <HistoryTray history={history} onSelect={...} />}
    
    {/* 2. Mode Selector Segmented Tabs */}
    <ModeSelector isSentenceMode={isSentenceMode} onChange={...} />
    
    {/* 3. Floating Input Composer */}
    <SearchBar ... />
  </View>
</KeyboardAvoidingView>
```

---

### 2.2 DEF-02: Padding Regression in SearchBar

#### Symptom
Text inside the composer input box was vertically clipped, and the microphone icon was misaligned relative to the send button.

#### Root Cause
Wrapping a generic `Input` primitive inside `SearchBar` introduced double padding (`Input` container padding + `SearchBar` outer capsule padding), shrinking the available text rendering bounds.

#### Remediation
Directly styled a standard React Native `TextInput` within the composer capsule while retaining the modular `Button` primitive for touch targets.

---

### 2.3 DEF-03: CORS Preflight Failure in Web Mode

#### Symptom
Submitting sentence translations in web browsers failed with `Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource. (Reason: CORS request did not succeed). Status code: (null)`.

#### Root Cause
`CORSMiddleware` in FastAPI was initialized with:
```python
# FAULTY:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # INVALID with wildcard origins under W3C spec
    ...
)
```
Modern browsers reject preflight `OPTIONS` responses when `Access-Control-Allow-Origin: *` is combined with `Access-Control-Allow-Credentials: true`.

#### Remediation
Updated `backend/app/main.py` and `video-service/main.py` to:
```python
# RESOLVED:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 2.4 DEF-04: Animation Frame Drops in Sequential Playback

#### Symptom
In Sentence Mode, the 3D avatar occasionally skipped the second or third sign in a multi-word sequence.

#### Root Cause
Relying exclusively on `useState` for the sign queue caused asynchronous race conditions. When the avatar fired `status: 'idle'`, the component state hadn't finished updating from the previous transition.

#### Remediation
Introduced the **Ref-Buffer Pattern**:
- Synchronous `signQueueRef.current` manages the authoritative FIFO queue.
- React state (`currentSign`, `isPlaying`) is reserved strictly for reactive UI highlights.

---

*SignVision — Principal UI/UX & Architecture Audit Report.*
