import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from '../../theme/tokens';

export interface IconProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hand icon for Sign to English button matching the reference pill
 */
export function HandSignIcon({ size = 18, color = '#FFFFFF', style }: IconProps) {
  const fingerWidth = size * 0.12;
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* Palm container */}
      <View
        style={{
          width: size * 0.72,
          height: size * 0.8,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {/* 4 Fingers */}
        <View style={{ flexDirection: 'row', gap: size * 0.04, marginBottom: -1 }}>
          <View style={{ width: fingerWidth, height: size * 0.32, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ width: fingerWidth, height: size * 0.42, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ width: fingerWidth, height: size * 0.38, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ width: fingerWidth, height: size * 0.28, backgroundColor: color, borderRadius: 2 }} />
        </View>
        {/* Palm base */}
        <View
          style={{
            width: size * 0.58,
            height: size * 0.42,
            backgroundColor: color,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
          }}
        />
        {/* Thumb */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            bottom: size * 0.12,
            width: fingerWidth,
            height: size * 0.24,
            backgroundColor: color,
            borderRadius: 2,
            transform: [{ rotate: '-35deg' }],
          }}
        />
      </View>
    </View>
  );
}

/**
 * Thin crisp right arrow (→) used in Sign to English and Submit buttons
 */
export function ArrowRightIcon({ size = 18, color = '#FFFFFF', style }: IconProps) {
  const lineThickness = 2;
  const arrowHeadSize = size * 0.36;

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* Horizontal stem */}
      <View
        style={{
          width: size * 0.52,
          height: lineThickness,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      {/* Arrowhead chevron */}
      <View
        style={{
          position: 'absolute',
          right: size * 0.22,
          width: arrowHeadSize,
          height: arrowHeadSize,
          borderTopWidth: lineThickness,
          borderRightWidth: lineThickness,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Crisp chevron right (>) for list rows
 */
export function ChevronRightIcon({ size = 16, color = '#64748B', style }: IconProps) {
  const strokeWidth = 1.8;
  const arm = size * 0.38;

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: arm,
          height: arm,
          borderTopWidth: strokeWidth,
          borderRightWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: '45deg' }, { translateX: -1 }],
        }}
      />
    </View>
  );
}

/**
 * Clean search magnifying glass
 */
export function SearchMagnifyIcon({ size = 18, color = '#94A3B8', style }: IconProps) {
  const strokeWidth = 1.8;
  const circleSize = size * 0.54;

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* Circle lens */}
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          transform: [{ translateX: -size * 0.08 }, { translateY: -size * 0.08 }],
        }}
      />
      {/* Handle */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.16,
          right: size * 0.16,
          width: size * 0.28,
          height: strokeWidth,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Clean circular clock icon for recent history
 */
export function ClockIcon({ size = 18, color = '#94A3B8', style }: IconProps) {
  const strokeWidth = 1.6;

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: size * 0.86,
          height: size * 0.86,
          borderRadius: (size * 0.86) / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Hour hand (points up/center) */}
        <View
          style={{
            position: 'absolute',
            width: strokeWidth,
            height: size * 0.24,
            backgroundColor: color,
            top: size * 0.16,
            borderRadius: 1,
          }}
        />
        {/* Minute hand (points to ~2 o'clock) */}
        <View
          style={{
            position: 'absolute',
            width: size * 0.2,
            height: strokeWidth,
            backgroundColor: color,
            right: size * 0.18,
            borderRadius: 1,
          }}
        />
        {/* Center dot */}
        <View
          style={{
            width: 3,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Character Switch / Profile switch icon replacing fullscreen in top-right of avatar viewer
 */
export function CharacterSwitchIcon({ size = 18, color = '#FFFFFF', style }: IconProps) {
  const headSize = size * 0.32;

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* User Silhouette */}
      <View style={{ alignItems: 'center', marginBottom: 1 }}>
        {/* Head */}
        <View
          style={{
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
            borderWidth: 1.6,
            borderColor: color,
          }}
        />
        {/* Shoulders */}
        <View
          style={{
            width: size * 0.54,
            height: size * 0.26,
            borderTopLeftRadius: size * 0.26,
            borderTopRightRadius: size * 0.26,
            borderWidth: 1.6,
            borderColor: color,
            borderBottomWidth: 0,
            marginTop: 1,
          }}
        />
      </View>

      {/* Cycle switch arrow around the avatar */}
      <View
        style={{
          position: 'absolute',
          bottom: 1,
          right: 1,
          width: size * 0.36,
          height: size * 0.36,
          borderRadius: 99,
          borderWidth: 1.3,
          borderColor: color,
          borderRightColor: 'transparent',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Microphone icon for voice input in search bar
 */
export function MicIcon({ size = 18, color = '#94A3B8', style }: IconProps) {
  const strokeWidth = 1.6;
  const capsuleWidth = size * 0.32;
  const capsuleHeight = size * 0.5;

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* Mic capsule */}
      <View
        style={{
          width: capsuleWidth,
          height: capsuleHeight,
          borderRadius: capsuleWidth / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          backgroundColor: 'transparent',
        }}
      />
      {/* Base cradle */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.2,
          width: size * 0.52,
          height: size * 0.3,
          borderBottomLeftRadius: size * 0.26,
          borderBottomRightRadius: size * 0.26,
          borderWidth: strokeWidth,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
      {/* Stem */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.08,
          width: strokeWidth,
          height: size * 0.14,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * Play triangle icon
 */
export function PlayIcon({ size = 16, color = '#FFFFFF', style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.36,
          borderBottomWidth: size * 0.36,
          borderLeftWidth: size * 0.58,
          borderStyle: 'solid',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          transform: [{ translateX: size * 0.08 }],
        }}
      />
    </View>
  );
}

/**
 * Pause dual bar icon
 */
export function PauseIcon({ size = 16, color = '#FFFFFF', style }: IconProps) {
  const barWidth = size * 0.22;
  const barHeight = size * 0.65;
  return (
    <View style={[{ width: size, height: size, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: size * 0.2 }, style]}>
      <View style={{ width: barWidth, height: barHeight, backgroundColor: color, borderRadius: 1.5 }} />
      <View style={{ width: barWidth, height: barHeight, backgroundColor: color, borderRadius: 1.5 }} />
    </View>
  );
}

/**
 * Previous sign skip icon (|◀)
 */
export function PreviousSignIcon({ size = 18, color = '#FFFFFF', style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          width: 2.2,
          height: size * 0.55,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.28,
          borderBottomWidth: size * 0.28,
          borderRightWidth: size * 0.44,
          borderStyle: 'solid',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
          transform: [{ translateX: size * 0.08 }],
        }}
      />
    </View>
  );
}

/**
 * Next sign skip icon (▶|)
 */
export function NextSignIcon({ size = 18, color = '#FFFFFF', style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.28,
          borderBottomWidth: size * 0.28,
          borderLeftWidth: size * 0.44,
          borderStyle: 'solid',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          transform: [{ translateX: -size * 0.08 }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.18,
          width: 2.2,
          height: size * 0.55,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

/**
 * Clean chevron down icon (⌄)
 */
export function ChevronDownIcon({ size = 14, color = '#8E9CAE', style }: IconProps) {
  const arm = size * 0.36;
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: arm,
          height: arm,
          borderBottomWidth: 1.8,
          borderRightWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: '45deg' }, { translateY: -1 }],
        }}
      />
    </View>
  );
}

/**
 * Close/clear '✕' icon
 */
export function CloseIcon({ size = 16, color = '#8E9CAE', style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.65,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.65,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}
