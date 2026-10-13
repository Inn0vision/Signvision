import React from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { COLORS, RADII, TYPOGRAPHY, ISL_GRAMMAR_COLORS } from '../../theme/tokens';

export interface BadgeProps {
  label: string;
  role?: string;
  variant?: 'emerald' | 'cyan' | 'ruby' | 'amber' | 'violet' | 'default' | 'neutral';
  isActive?: boolean;
  pulse?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftDot?: boolean;
}

export function Badge({
  label,
  role,
  variant,
  isActive = false,
  onPress,
  style,
  textStyle,
  leftDot = false,
}: BadgeProps) {
  let colorScheme = ISL_GRAMMAR_COLORS.DEFAULT;

  if (role && ISL_GRAMMAR_COLORS[role.toUpperCase()]) {
    colorScheme = ISL_GRAMMAR_COLORS[role.toUpperCase()];
  } else if (variant) {
    switch (variant) {
      case 'emerald':
        colorScheme = { bg: COLORS.emeraldMuted, border: COLORS.emerald, text: COLORS.emeraldLight };
        break;
      case 'cyan':
        colorScheme = { bg: COLORS.cyanMuted, border: COLORS.cyan, text: COLORS.cyanLight };
        break;
      case 'ruby':
        colorScheme = { bg: COLORS.rubyMuted, border: COLORS.ruby, text: '#FDA4AF' };
        break;
      case 'amber':
        colorScheme = { bg: COLORS.amberMuted, border: COLORS.amber, text: '#FCD34D' };
        break;
      case 'violet':
        colorScheme = { bg: COLORS.violetMuted, border: COLORS.violet, text: '#C4B5FD' };
        break;
      default:
        colorScheme = ISL_GRAMMAR_COLORS.DEFAULT;
    }
  }

  const Component = onPress ? Pressable : Pressable;

  return (
    <Component
      onPress={onPress}
      disabled={!onPress}
      accessible={true}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Gloss token ${label}${role ? `, syntax role ${role}` : ''}`}
      style={({ pressed }: { pressed: boolean }) => [
        styles.base,
        {
          backgroundColor: isActive ? COLORS.emerald : colorScheme.bg,
          borderColor: isActive ? COLORS.emeraldLight : colorScheme.border,
        },
        isActive && styles.activeGlow,
        pressed && styles.pressed,
        style,
      ]}
    >
      {leftDot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: isActive ? COLORS.textInverse : colorScheme.text },
          ]}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            color: isActive ? COLORS.textInverse : colorScheme.text,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Component>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADII.sm,
    borderWidth: 1,
    marginRight: 6,
    marginVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: RADII.full,
    marginRight: 6,
  },
  activeGlow: {
    shadowColor: COLORS.emerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  text: {
    ...TYPOGRAPHY.gloss,
    fontSize: 12,
  },
});
