import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';

interface HandLandmarkOverlayProps {
  isActive: boolean;
  statusText?: string;
  isRecording?: boolean;
}

export default function HandLandmarkOverlay({
  isActive,
  statusText = 'GESTURE TRACKING ACTIVE',
  isRecording = false,
}: HandLandmarkOverlayProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 8, duration: 1800, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 240, duration: 2200, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      floatAnim.stopAnimation();
      scanAnim.stopAnimation();
      pulseAnim.setValue(0);
      floatAnim.setValue(0);
      scanAnim.setValue(0);
    }
  }, [isActive, pulseAnim, floatAnim, scanAnim]);

  if (!isActive) return null;

  const pointPositions = [
    { top: 0, left: 40 }, 
    { top: -20, left: 10 }, 
    { top: -30, left: -20 }, 
    { top: -20, left: -50 }, 
    { top: 0, left: -70 }, 
    { top: 50, left: -10 }, 
    { top: 80, left: 0 }, 
  ];

  const primaryColor = isRecording ? COLORS.ruby : COLORS.cyan;
  const primaryLight = isRecording ? '#FDA4AF' : COLORS.cyanLight;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.trackingBox,
          {
            borderColor: isRecording ? 'rgba(244, 63, 94, 0.3)' : 'rgba(6, 182, 212, 0.3)',
            backgroundColor: isRecording ? 'rgba(244, 63, 94, 0.04)' : 'rgba(6, 182, 212, 0.04)',
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        {/* Laser Scanline */}
        <Animated.View
          style={[
            styles.scanLine,
            {
              backgroundColor: primaryColor,
              shadowColor: primaryColor,
              transform: [{ translateY: scanAnim }],
            },
          ]}
        />

        {/* Hand Landmark Keypoints */}
        <View style={styles.pointsContainer}>
          {pointPositions.map((pos, i) => (
            <Animated.View
              key={i}
              style={[
                styles.point,
                {
                  backgroundColor: primaryColor,
                  transform: [{ translateX: pos.left }, { translateY: pos.top }],
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.95] }),
                },
              ]}
            />
          ))}
          <Animated.View style={[styles.line, { backgroundColor: isRecording ? 'rgba(244, 63, 94, 0.25)' : 'rgba(6, 182, 212, 0.25)', transform: [{ rotate: '45deg' }, { translateY: 20 }] }]} />
          <Animated.View style={[styles.line, { backgroundColor: isRecording ? 'rgba(244, 63, 94, 0.25)' : 'rgba(6, 182, 212, 0.25)', transform: [{ rotate: '-45deg' }, { translateY: 20 }] }]} />
        </View>

        {/* Cybernetic HUD Corner Brackets */}
        <View style={[styles.cornerTopLeft, { borderColor: primaryColor }]} />
        <View style={[styles.cornerTopRight, { borderColor: primaryColor }]} />
        <View style={[styles.cornerBottomLeft, { borderColor: primaryColor }]} />
        <View style={[styles.cornerBottomRight, { borderColor: primaryColor }]} />

        {/* Telemetry Status Bar */}
        <View style={styles.telemetryBar}>
          <View style={[styles.telemetryDot, { backgroundColor: primaryColor }]} />
          <Animated.Text style={[styles.trackingText, { color: primaryLight, opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]}>
            {statusText}
          </Animated.Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingBox: {
    width: 280,
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADII.lg,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    top: 20,
    width: '100%',
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  pointsContainer: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
  point: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: RADII.full,
  },
  line: {
    position: 'absolute',
    width: 2,
    height: 80,
  },
  telemetryBar: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 8, 13, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  telemetryDot: {
    width: 6,
    height: 6,
    borderRadius: RADII.full,
    marginRight: 6,
  },
  trackingText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 22, height: 22, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: RADII.sm },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: RADII.sm },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 22, height: 22, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: RADII.sm },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: RADII.sm },
});
