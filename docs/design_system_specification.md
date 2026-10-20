# SignVision — Design System Specification (`design_system_specification.md`)

> **Complete design system specification, Obsidian Slate color tokens, typography scales, motion physics, and WCAG AAA accessibility rules.**

---

## ⚡ 1. Brief Token Overview (TL;DR)

### Core Token Palette

| Token Identifier | Value | Role | Contrast Ratio |
|:---|:---|:---|:---|
| `color.canvas` | `#07080D` | Base page background | Base |
| `color.surface.secondary` | `#0B0E14` | Recessed containers, history trays | 1.1:1 vs Canvas |
| `color.surface.elevated` | `#111722` | Floating composer, action modals | 1.4:1 vs Canvas |
| `color.accent.primary` | `#10B981` | Emerald green: active playback, mic recording, success | 8.2:1 vs Canvas |
| `color.accent.cyan` | `#06B6D4` | Cyan: informational badges, secondary actions | 7.9:1 vs Canvas |
| `color.text.primary` | `#F8FAFC` | Primary text, titles, GLOSS tokens | 14.5:1 (AAA) |
| `color.text.secondary` | `#94A3B8` | Subtitles, timestamps, metadata | 7.2:1 (AAA) |
| `color.border.subtle` | `#1E293B` | Borders, subtle dividers | 2.1:1 vs Canvas |
| `color.state.error` | `#EF4444` | Errors, connection failure toasts | 5.1:1 (AA) |

---

## 🛠️ 2. Detailed Design Specification

### 2.1 Surface Elevation & Layer Hierarchy

SignVision uses a three-tier elevation hierarchy designed for high-contrast accessibility:

```
[Layer 3: Floating Elements (z: 100)] ──► Floating Composer (#111722, elevated)
                                         Shadow: 0 4px 20px rgba(0, 0, 0, 0.4)
[Layer 2: Content Cards (z: 10)]    ──► History Trays & Result Cards (#0B0E14)
                                         Border: 1px solid #1E293B
[Layer 1: Canvas Base (z: 0)]       ──► Viewport Background (#07080D)
```

---

### 2.2 Typography Scale & Text Styles

| Role | Weight | Size | Line Height | Usage |
|:---|:---|:---|:---|:---|
| `display.title` | 700 (Bold) | 24px | 30px | Screen titles, branding |
| `heading.section`| 600 (SemiBold) | 18px | 24px | Card headers, modal titles |
| `body.primary` | 400 (Regular) | 15px | 21px | User input, translated text |
| `body.secondary`| 400 (Regular) | 13px | 18px | Hints, timestamps, descriptions |
| `gloss.token` | 700 (Mono) | 14px | 18px | Active and historical ISL tokens |
| `caption.badge` | 600 (SemiBold) | 11px | 14px | Status badges, network indicators |

---

### 2.3 Motion & Interaction Physics

1. **Token Transitions**:
   - Animated via `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`.
   - Duration: 250ms.
   - Eliminates visual pop-in when new GLOSS tokens are received from the backend.
2. **Button Press Dynamics**:
   - Utilizes `transform: [{ scale: pressed ? 0.96 : 1.0 }]` on custom `Button.tsx`.
   - Restores scale immediately upon release.
3. **Microphone Pulse Animation**:
   - Renders a breathing glow ring using interpolated opacity (0.4 to 1.0) and scale (1.0 to 1.15) at 1.2s cycles during active voice capture.

---

### 2.4 Accessibility Rules (WCAG 2.1 AAA)

- **Target Sizing**: All touchable controls enforce a minimum bounding box of 44x44dp.
- **Contrast Guarantee**: All text on elevated surfaces meets or exceeds 7:1 contrast.
- **Focus Rings**: Interactive inputs display a 2px solid `#10B981` border on focus.
- **Screen Reader Compatibility**: Every icon button declares an explicit, descriptive `accessibilityLabel`.

---

*SignVision — Design System Specification.*
