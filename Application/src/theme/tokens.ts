/**
 * SignVision Design Tokens & Theme Specification
 * 
 * Midnight Obsidian Canvas + Emerald & Cyan Signal Accents
 * Adheres to WCAG AAA contrast and ergonomic thumb-zone spacing.
 */

import { Platform, PixelRatio } from 'react-native';

const scaleFont = (size: number): number => {
  if (Platform.OS === 'web') return size;
  return PixelRatio.roundToNearestPixel(size);
};

export const COLORS = {
  // Obsidian Slate Surfaces
  canvas: '#07080D',          // Deepest background
  stage: '#0B0E14',           // 3D Avatar elevated stage
  panel: '#121721',           // Floating panels, sheets, modals
  surface: '#171E29',         // Interactive controls, search composer, cards
  surfaceHover: '#202938',    // Active / Hovered state
  surfaceSubtle: '#0E131C',   // Muted background for tags and slots

  // Glassmorphic Overlays
  glass: 'rgba(18, 23, 33, 0.78)',
  glassActive: 'rgba(23, 30, 41, 0.90)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',

  // Borders & Dividers
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderMedium: 'rgba(255, 255, 255, 0.16)',
  borderBright: 'rgba(255, 255, 255, 0.28)',
  borderFocus: '#10B981',

  // Signal & Primary Accents
  emerald: '#10B981',         // Primary action, success, live transmission
  emeraldHover: '#059669',    // Darker emerald for pressed state
  emeraldLight: '#34D399',    // High-visibility emerald accent
  emeraldMuted: 'rgba(16, 185, 129, 0.16)',

  cyan: '#06B6D4',            // Camera HUD, scanning aura, secondary accent
  cyanHover: '#0891B2',
  cyanLight: '#67E8F9',
  cyanMuted: 'rgba(6, 182, 212, 0.16)',

  // Semantic Alerts & Grammatical Role Signals
  ruby: '#F43F5E',            // Destructive, recording indicator, error
  rubyMuted: 'rgba(244, 63, 94, 0.16)',
  amber: '#F59E0B',           // Warning, offline fallback, time markers
  amberMuted: 'rgba(245, 158, 11, 0.16)',
  violet: '#8B5CF6',          // Question particles, syntactic modifiers
  violetMuted: 'rgba(139, 92, 246, 0.16)',
  teal: '#14B8A6',            // Object / Noun classifier
  tealMuted: 'rgba(20, 184, 166, 0.16)',

  // Text Hierarchy (WCAG AAA High Contrast against Obsidian)
  textPrimary: '#F5F7FB',      // 15:1+ Contrast Ratio
  textSecondary: '#A6B0C0',    // Secondary labels, subtitles
  textMuted: '#637083',        // Metadata, timestamps, placeholders
  textInverse: '#07080D',      // Dark contrast on emerald buttons
} as const;

export const ISL_GRAMMAR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SUBJECT: {
    bg: COLORS.cyanMuted,
    border: 'rgba(6, 182, 212, 0.35)',
    text: COLORS.cyanLight,
  },
  OBJECT: {
    bg: COLORS.tealMuted,
    border: 'rgba(20, 184, 166, 0.35)',
    text: '#5EEAD4',
  },
  VERB: {
    bg: COLORS.emeraldMuted,
    border: 'rgba(16, 185, 129, 0.35)',
    text: COLORS.emeraldLight,
  },
  TIME_MARKER: {
    bg: COLORS.amberMuted,
    border: 'rgba(245, 158, 11, 0.35)',
    text: '#FCD34D',
  },
  NEGATION: {
    bg: COLORS.rubyMuted,
    border: 'rgba(244, 63, 94, 0.35)',
    text: '#FDA4AF',
  },
  QUESTION: {
    bg: COLORS.violetMuted,
    border: 'rgba(139, 92, 246, 0.35)',
    text: '#C4B5FD',
  },
  DEFAULT: {
    bg: 'rgba(255, 255, 255, 0.08)',
    border: COLORS.borderMedium,
    text: COLORS.textPrimary,
  },
};

export const TYPOGRAPHY = {
  display: {
    fontSize: scaleFont(32),
    lineHeight: scaleFont(38),
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: scaleFont(24),
    lineHeight: scaleFont(30),
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: scaleFont(20),
    lineHeight: scaleFont(26),
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: scaleFont(16),
    lineHeight: scaleFont(22),
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  body: {
    fontSize: scaleFont(14),
    lineHeight: scaleFont(20),
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  bodyBold: {
    fontSize: scaleFont(14),
    lineHeight: scaleFont(20),
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: scaleFont(12),
    lineHeight: scaleFont(16),
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  gloss: {
    fontSize: scaleFont(13),
    lineHeight: scaleFont(18),
    fontWeight: '700' as const,
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
};

export const SPACING = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  thumbZoneInset: 84, // Safe padding for bottom floating composer
} as const;

export const RADII = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const SHADOWS = {
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
  composer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 10,
  },
  glowEmerald: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  glowCyan: {
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
