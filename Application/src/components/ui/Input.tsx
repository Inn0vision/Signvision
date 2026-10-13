import React, { useState, forwardRef } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  Platform,
} from 'react-native';
import { COLORS, RADII, TYPOGRAPHY } from '../../theme/tokens';

export interface InputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isError?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(({
  containerStyle,
  style,
  leftIcon,
  rightIcon,
  isError,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        isError && styles.containerError,
        props.editable === false && styles.containerDisabled,
        containerStyle,
      ]}
    >
      {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
      <TextInput
        ref={ref}
        style={[styles.input, style]}
        placeholderTextColor={COLORS.textMuted}
        selectionColor={COLORS.emerald}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {rightIcon && <View style={styles.iconContainer}>{rightIcon}</View>}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    height: 48,
    backgroundColor: COLORS.stage,
    borderWidth: 1.5,
    borderColor: COLORS.borderMedium,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
  },
  containerFocused: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.surface,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)' } as any)
      : {}),
  },
  containerError: {
    borderColor: COLORS.ruby,
  },
  containerDisabled: {
    opacity: 0.5,
    backgroundColor: COLORS.canvas,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.body,
    height: '100%',
    paddingHorizontal: 8,
  },
});
