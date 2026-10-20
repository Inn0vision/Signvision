# SignVision — Design System & UI/UX Specification

> **Comprehensive design system specification, color token hierarchy, ergonomic layout rules, and accessibility standards.**

---

## ⚡ 1. Brief Design Summary (TL;DR)

SignVision adheres to the **"Obsidian Slate"** design system—a high-contrast, accessibility-first visual language tailored for clarity and ease of use in deaf and hard-of-hearing communication.

### Core Design Tokens
- **Canvas / Background**: `#07080D` (Ultra-deep slate)
- **Secondary Surface**: `#0B0E14` (Recessed history trays & cards)
- **Elevated Surface**: `#111722` (Floating composer, modal sheets)
- **Primary Accent / Success**: `#10B981` (Emerald green — active playback, confirmation)
- **Secondary Accent**: `#06B6D4` (Cyan — subtle badges, focus states)
- **Primary Text**: `#F8FAFC` (High-contrast slate white, 14.5:1 contrast against `#07080D`)
- **Muted Text**: `#94A3B8` (Slate gray for secondary metadata)
- **Destructive / Error**: `#EF4444` (Vibrant crimson)

### Ergonomic Layout Rule
The **Thumb-Zone Principle**: All interactive inputs (voice button, text composer, mode switcher) are pinned to the bottom 35% of the mobile viewport within easy reach of one-handed thumb interaction. The top 65% is dedicated to the visual rendering stage (CWASA 3D WebGL Avatar).

---

## 🎨 2. Detailed Design Specification

### 2.1 Color Palette & Token Scale

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Obsidian Slate Palette                          │
├──────────────┬──────────────┬──────────────┬──────────────┬────────────┤
│  #07080D     │  #111722     │  #10B981     │  #06B6D4     │  #F8FAFC   │
│  Canvas      │  Elevated    │  Emerald     │  Cyan        │  Text-100  │
└──────────────┴──────────────┴──────────────┴──────────────┴────────────┘
```

| Token | Hex Value | Usage Role | WCAG Contrast |
|:---|:---|:---|:---|
| `canvas.background` | `#07080D` | Base application background | Base |
| `surface.secondary` | `#0B0E14` | History trays, card containers | 1.1:1 vs Canvas |
| `surface.elevated` | `#111722` | Floating composer, action sheets | 1.4:1 vs Canvas |
| `border.subtle` | `#1E293B` | Structural dividers, inactive input borders | 2.1:1 vs Canvas |
| `border.focus` | `#10B981` | Focused input border, active tab indicator | 8.2:1 vs Canvas |
| `accent.primary` | `#10B981` | Primary CTA, playback active, mic recording | 8.2:1 vs Canvas |
| `accent.cyan` | `#06B6D4` | Information chips, secondary indicators | 7.9:1 vs Canvas |
| `text.primary` | `#F8FAFC` | Headings, user input, GLOSS tokens | 14.5:1 (AAA) |
| `text.secondary` | `#94A3B8` | Subtitles, timestamps, placeholder text | 7.2:1 (AAA) |
| `text.muted` | `#64748B` | Disabled labels, subtle borders | 4.6:1 (AA) |
| `state.error` | `#EF4444` | Network failure toasts, invalid input states | 5.1:1 (AA) |

---

### 2.2 Typography Scale

SignVision uses the native system font stack (`System` on iOS/Android, `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto` on Web) for zero-latency initial rendering.

| Style Role | Font Weight | Size (pt/px) | Line Height | Letter Spacing |
|:---|:---|:---|:---|:---|
| **Display Title** | 700 (Bold) | 24 | 30 | -0.5px |
| **Section Header** | 600 (SemiBold) | 18 | 24 | -0.2px |
| **Card Header** | 600 (SemiBold) | 16 | 22 | 0.0px |
| **Body Primary** | 400 (Regular) | 15 | 21 | 0.0px |
| **Body Small / Hint**| 400 (Regular) | 13 | 18 | +0.1px |
| **GLOSS Token** | 700 (Bold, Mono) | 14 | 18 | +0.8px |
| **Badge / Caption** | 600 (SemiBold) | 11 | 14 | +0.4px |

---

### 2.3 Ergonomic Layout & Component Hierarchy

```
┌────────────────────────────────────────────────────────┐
│  SignVision Mobile Viewport (412 x 915)                │
├────────────────────────────────────────────────────────┤
│ [Top Bar]  SignVision Brand | Network Status Badge     │
├────────────────────────────────────────────────────────┤
│                                                        │
│                                                        │
│               CWASA 3D WebGL Avatar                    │
│                 (Dominant Stage)                       │
│                                                        │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [History & GLOSS Strip]  [TOMORROW] [I] [SCHOOL] [GO]  │
├────────────────────────────────────────────────────────┤
│ [Mode Selector Tabs]    [ Word Mode ]  [ Sentence Mode ]│
├────────────────────────────────────────────────────────┤
│ [Floating Composer]                                    │
│  ┌──────────────────────────────────────────────┐      │
│  │ [🔍 Search / Type sentence...]  [🎤]  [▶]    │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────┘
```

#### Structural Layout Invariants
1. **Never Obscure the Avatar**: The 3D avatar WebGL container must maintain at least 45% of the visible viewport during all user interactions, even when the soft keyboard is deployed.
2. **Native Keyboard Avoidance**: The composer is wrapped in a native `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` to prevent layout popping.
3. **Stacked Trays**: The search history tray is strictly stacked *above* the mode selector tab row, eliminating any overlapping z-index conflicts.

---

### 2.4 Modular Component Primitives

SignVision avoids heavy third-party UI libraries (e.g. NativeBase, Paper) in favor of lightweight, custom primitives inspired by `shadcn/ui`:

#### `Button.tsx` (`Application/src/components/ui/Button.tsx`)
- **Variants**:
  - `default`: Solid emerald background (`#10B981`) with dark text (`#07080D`).
  - `secondary`: Elevated slate (`#111722`) with subtle border.
  - `outline`: Transparent background with `#1E293B` border.
  - `ghost`: Transparent background with hover glow.
  - `icon`: Square 40x40 touch target optimized for microphone and send actions.
- **Micro-Interactions**: Features subtle scale transitions (`transform: [{ scale: pressed ? 0.96 : 1.0 }]`) on press.

#### `Input.tsx` (`Application/src/components/ui/Input.tsx`)
- **Focus Rings**: Emits a glowing emerald ring (`borderColor: '#10B981'`) when focused.
- **Accessibility**: Includes `accessibilityLabel`, `accessibilityHint`, and high-contrast placeholder text (`#64748B`).

---

### 2.5 Motion Physics & Animation Standards

1. **GLOSS Token Slides**: Token entry and exit transitions utilize `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` with a 250ms duration.
2. **Playback Pulse**: The currently active GLOSS token glows with an emerald border and subtle scale pulse to indicate playback synchronization with the 3D avatar.
3. **Microphone Pulse**: When recording speech via `expo-speech-recognition`, the microphone button pulses with a breathing cyan/emerald glow to provide immediate visual feedback.

---

### 2.6 Accessibility Compliance (WCAG 2.1 AAA)

- **Contrast Ratios**: All text elements exceed the 7:1 AAA contrast threshold against their respective backgrounds.
- **Touch Target Sizes**: All interactive elements (buttons, inputs, tabs) maintain a minimum touch target size of 48x48dp.
- **Screen Reader Support**: Every icon button includes descriptive `accessibilityLabel` attributes (e.g., `"Record speech input"`, `"Play sign animation"`).
- **Reduced Motion**: Respects device accessibility preferences for reduced motion, disabling layout animations when enabled.

---

*SignVision — Crafted for accessibility, speed, and elegance.*
