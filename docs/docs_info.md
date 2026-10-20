# SignVision — Documentation Directory Catalog (`docs_info.md`)

> **Index and guide to all architectural specifications, audit reports, design tokens, and engineering plans in `docs/`.**

---

## ⚡ 1. Brief Directory Index (TL;DR)

The `docs/` folder houses formal architectural specifications, audit analyses, design system tokens, and implementation plans.

### Document Inventory

| File | Subject Area | Key Content |
|:---|:---|:---|
| `docs/component_matrix.md` | Component System | Cross-platform primitive selection (mobile vs. web), variants, accessibility |
| `docs/design_system_specification.md` | Design System | "Obsidian Slate" color tokens, typography scales, motion physics |
| `docs/frontend_audit.md` | Quality & Audit | Historical UI/UX defect analysis, layout overlap remediations, CORS fixes |
| `docs/implementation_plan.md` | Implementation | Master architectural overhaul plan and verification steps |
| `docs/docs_info.md` | Catalog Index | This document index and cross-reference manual |

---

## 🛠️ 2. Detailed Document Guide

### 2.1 Component Selection Matrix (`component_matrix.md`)
Defines the component hierarchy for the React Native/Expo frontend:
- Custom Shadcn-inspired primitives (`Button.tsx`, `Input.tsx`) to avoid heavy third-party UI dependencies.
- WebView integration rules for the embedded CWASA 3D Avatar (`AvatarWebView.tsx`).
- Voice and keyboard inputs unification in the floating composer (`SearchBar.tsx`).

### 2.2 Design System Specification (`design_system_specification.md`)
Full design token documentation:
- Strict Obsidian Slate palette: `#07080D` (Canvas), `#111722` (Elevated), `#10B981` (Emerald Accent), `#06B6D4` (Cyan Accent).
- WCAG AAA contrast ratio compliance.
- 60fps micro-interaction physics with `LayoutAnimation`.

### 2.3 Frontend Audit & Defect Remediation (`frontend_audit.md`)
Documents the principal-level audit and defect resolution history:
- Floating composer layout collision fixes.
- Restoring standard `TextInput` inside `SearchBar.tsx` to fix layout padding regressions.
- W3C Fetch CORS specification compliance (`allow_credentials=False` with wildcard origins).
- State and ref double-buffering in `HomeScreen.tsx`.

### 2.4 Implementation Plan (`implementation_plan.md`)
Tracks planned features, architectural milestones, and verification criteria.

---

*SignVision — Documentation Directory Catalog.*
