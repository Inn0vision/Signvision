import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { COLORS, RADII, SHADOWS } from '../../theme/tokens';

export type ButtonVariant = 
  | 'default' 
  | 'glow' 
  | 'secondary' 
  | 'outline' 
  | 'ghost' 
  | 'destructive' 
  | 'cyan';

export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

const buttonVariants: Record<ButtonVariant, ViewStyle> = {
  default: {
    backgroundColor: COLORS.emerald,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  glow: {
    backgroundColor: COLORS.emerald,
    borderWidth: 1,
    borderColor: COLORS.emeraldLight,
    ...SHADOWS.glowEmerald,
  },
  secondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderBright,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: COLORS.ruby,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cyan: {
    backgroundColor: COLORS.cyan,
    borderWidth: 1,
    borderColor: COLORS.cyanLight,
    ...SHADOWS.glowCyan,
  },
};

const buttonSizes: Record<ButtonSize, ViewStyle> = {
  sm: { minHeight: 38, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADII.sm },
  default: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADII.md },
  lg: { minHeight: 54, paddingHorizontal: 28, paddingVertical: 14, borderRadius: RADII.lg },
  icon: { minHeight: 48, minWidth: 48, width: 48, height: 48, padding: 0, borderRadius: RADII.md },
};

const textVariants: Record<ButtonVariant, TextStyle> = {
  default: { color: COLORS.textInverse, fontWeight: '700' },
  glow: { color: COLORS.textInverse, fontWeight: '700' },
  secondary: { color: COLORS.textPrimary, fontWeight: '600' },
  outline: { color: COLORS.textPrimary, fontWeight: '600' },
  ghost: { color: COLORS.textSecondary, fontWeight: '600' },
  destructive: { color: '#FFFFFF', fontWeight: '700' },
  cyan: { color: COLORS.textInverse, fontWeight: '700' },
};

const textSizes: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: 13, lineHeight: 18 },
  default: { fontSize: 15, lineHeight: 20 },
  lg: { fontSize: 17, lineHeight: 22 },
  icon: { fontSize: 18, lineHeight: 22 },
};

export interface ButtonProps extends PressableProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hapticFeedback?: boolean;
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  isLoading = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
  hitSlop = { top: 6, bottom: 6, left: 6, right: 6 },
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessible={true}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={
        accessibilityLabel || (typeof children === 'string' ? children : undefined)
      }
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      disabled={disabled || isLoading}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.base,
        buttonVariants[variant],
        buttonSizes[size],
        pressed && styles.pressed,
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'default' || variant === 'glow' || variant === 'cyan'
              ? COLORS.textInverse
              : COLORS.textPrimary
          }
        />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          {typeof children === 'string' ? (
            <Text
              style={[
                styles.textBase,
                textVariants[variant],
                textSizes[size],
                leftIcon ? { marginLeft: 8 } : null,
                rightIcon ? { marginRight: 8 } : null,
                textStyle,
              ]}
            >
              {children}
            </Text>
          ) : (
            children
          )}
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.45,
  },
  textBase: {
    textAlign: 'center',
  },
});
