import React from 'react';
import { View, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from '../../theme/tokens';

interface IconProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Clean chevron left back icon
 */
export function ChevronLeftIcon({ size = 18, color = COLORS.textPrimary, style }: IconProps) {
  const strokeWidth = 2;
  const armLength = size * 0.42;

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: armLength,
          height: armLength,
          borderLeftWidth: strokeWidth,
          borderBottomWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: '45deg' }, { translateX: 1.5 }],
        }}
      />
    </View>
  );
}

/**
 * Clean camera flip / rotate icon
 */
export function FlipCameraIcon({ size = 18, color = COLORS.textPrimary, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* Outer camera outline */}
      <View
        style={{
          width: size * 0.88,
          height: size * 0.72,
          borderRadius: 3.5,
          borderWidth: 1.5,
          borderColor: color,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Inner cycle arrow ring */}
        <View
          style={{
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: 99,
            borderWidth: 1.5,
            borderColor: color,
            borderTopColor: 'transparent',
            transform: [{ rotate: '-45deg' }],
          }}
        />
      </View>
    </View>
  );
}

/**
 * Clean camera aperture / body icon for permissions and ready state
 */
export function CameraApertureIcon({ size = 28, color = COLORS.emerald, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: size * 0.86,
          height: size * 0.68,
          borderRadius: 5,
          borderWidth: 1.75,
          borderColor: color,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Lens */}
        <View
          style={{
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: 99,
            borderWidth: 1.5,
            borderColor: color,
          }}
        />
        {/* Flash dot */}
        <View
          style={{
            position: 'absolute',
            top: 2.5,
            right: 3.5,
            width: 2.5,
            height: 2.5,
            borderRadius: 99,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Clean copy clipboard icon
 */
export function CopyIcon({ size = 16, color = COLORS.textSecondary, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, position: 'relative' }, style]}>
      {/* Back rectangle */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: size * 0.65,
          height: size * 0.75,
          borderWidth: 1.2,
          borderColor: color,
          borderRadius: 2,
          opacity: 0.6,
        }}
      />
      {/* Front rectangle */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: size * 0.65,
          height: size * 0.75,
          borderWidth: 1.4,
          borderColor: color,
          borderRadius: 2,
          backgroundColor: COLORS.surface,
        }}
      />
    </View>
  );
}

/**
 * Clean checkmark icon for confirmed / copied state
 */
export function CheckIcon({ size = 16, color = COLORS.emerald, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: size * 0.52,
          height: size * 0.28,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          transform: [{ rotate: '-45deg' }, { translateY: -1 }],
        }}
      />
    </View>
  );
}

/**
 * Clean refresh / retry icon
 */
export function RefreshIcon({ size = 16, color = COLORS.textPrimary, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: 99,
          borderWidth: 1.5,
          borderColor: color,
          borderRightColor: 'transparent',
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 1,
          right: 1,
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderBottomWidth: 4,
          borderStyle: 'solid',
          backgroundColor: 'transparent',
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Clean 3D avatar / playback icon
 */
export function AvatarPlayIcon({ size = 16, color = COLORS.textInverse, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* Play triangle */}
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.32,
          borderBottomWidth: size * 0.32,
          borderLeftWidth: size * 0.5,
          borderStyle: 'solid',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          transform: [{ translateX: 1.5 }],
        }}
      />
    </View>
  );
}

/**
 * Clean alert / warning circle
 */
export function AlertCircleIcon({ size = 18, color = COLORS.amber, style }: IconProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <View style={{ width: 1.8, height: size * 0.36, backgroundColor: color, borderRadius: 1 }} />
      <View
        style={{
          width: 2,
          height: 2,
          borderRadius: 99,
          backgroundColor: color,
          marginTop: 2,
        }}
      />
    </View>
  );
}
