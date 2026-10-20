import React from 'react';
import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, RADII, SHADOWS } from '../../theme/tokens';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'glass' | 'stage' | 'surface' | 'outline';
  glowColor?: 'emerald' | 'cyan' | 'ruby' | 'amber' | 'violet';
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'surface',
  glowColor,
  style,
  ...props
}: CardProps) {
  const glowStyle = glowColor ? styles[`glow_${glowColor}` as keyof typeof styles] : undefined;

  return (
    <View style={[styles.base, styles[variant], glowStyle, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADII.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
  },
  surface: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.card,
  },
  stage: {
    backgroundColor: COLORS.stage,
    borderColor: COLORS.borderSubtle,
    ...SHADOWS.subtle,
  },
  glass: {
    backgroundColor: COLORS.glass,
    borderColor: COLORS.glassBorder,
    ...SHADOWS.card,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: COLORS.borderBright,
  },
  glow_emerald: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    shadowColor: COLORS.emerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glow_cyan: {
    borderColor: 'rgba(6, 182, 212, 0.4)',
    shadowColor: COLORS.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glow_ruby: {
    borderColor: 'rgba(244, 63, 94, 0.4)',
    shadowColor: COLORS.ruby,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glow_amber: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glow_violet: {
    borderColor: 'rgba(139, 92, 246, 0.4)',
    shadowColor: COLORS.violet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
});
