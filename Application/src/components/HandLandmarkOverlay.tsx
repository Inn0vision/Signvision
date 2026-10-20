import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { COLORS, RADII, TYPOGRAPHY } from '../theme/tokens';
import {
  type HandLandmarkList,
  HAND_CONNECTIONS,
} from '../services/handTrackingService';

export interface HandLandmarkOverlayProps {
  isActive: boolean;
  statusText?: string;
  isRecording?: boolean;
  detectedHands?: HandLandmarkList[];
  viewportWidth: number;
  viewportHeight: number;
  isMirrored?: boolean;
}

/**
 * Single anatomical bone connecting two MediaPipe landmarks in viewport pixel space.
 */
function LandmarkBone({
  x1,
  y1,
  x2,
  y2,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: cx - length / 2,
        top: cy - 1,
        width: length,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
        borderRadius: 1,
      }}
    />
  );
}

/**
 * Real-time MediaPipe Hand Landmark Overlay.
 * 
 * Displays the 21 actual anatomical keypoints and skeletal connections
 * for up to 2 visible hands detected in the live camera feed.
 */
export default function HandLandmarkOverlay({
  isActive,
  statusText,
  isRecording = false,
  detectedHands = [],
  viewportWidth,
  viewportHeight,
  isMirrored = false,
}: HandLandmarkOverlayProps) {
  if (!isActive || viewportWidth <= 0 || viewportHeight <= 0) return null;

  const hasDetectedHands = detectedHands.length > 0;
  const boneColor = isRecording ? COLORS.ruby : COLORS.emerald;
  const jointColor = isRecording ? '#FDA4AF' : COLORS.emeraldLight;

  // Determine contextual guidance status
  const effectiveStatus = useMemo(() => {
    if (statusText) return statusText;
    if (hasDetectedHands) {
      return detectedHands.length === 1 ? '1 Hand detected' : '2 Hands detected';
    }
    return 'Show your hands';
  }, [statusText, hasDetectedHands, detectedHands.length]);

  return (
    <View
      style={[
        styles.container,
        {
          width: viewportWidth,
          height: viewportHeight,
        },
      ]}
      pointerEvents="none"
    >
      {/* 1. Real MediaPipe 21-Joint Skeletal Overlay */}
      {detectedHands.map((hand, handIdx) => {
        // Map 21 normalized landmarks (0..1) to viewport pixel space
        const pixelPoints = hand.map((pt) => ({
          x: (isMirrored ? 1 - pt.x : pt.x) * viewportWidth,
          y: pt.y * viewportHeight,
        }));

        return (
          <View key={`hand-${handIdx}`} style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {/* Skeletal Bones */}
            {HAND_CONNECTIONS.map(([idx1, idx2], connIdx) => {
              const p1 = pixelPoints[idx1];
              const p2 = pixelPoints[idx2];
              if (!p1 || !p2) return null;

              return (
                <LandmarkBone
                  key={`bone-${handIdx}-${connIdx}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  color={boneColor}
                />
              );
            })}

            {/* 21 Keypoint Joint Markers */}
            {pixelPoints.map((pt, ptIdx) => {
              const isTip = [4, 8, 12, 16, 20].includes(ptIdx);
              const isWrist = ptIdx === 0;
              const size = isTip ? 6.5 : isWrist ? 7 : 4.5;

              return (
                <View
                  key={`joint-${handIdx}-${ptIdx}`}
                  style={[
                    styles.jointMarker,
                    {
                      left: pt.x - size / 2,
                      top: pt.y - size / 2,
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: isTip ? '#FFFFFF' : jointColor,
                      borderColor: boneColor,
                      borderWidth: isTip ? 1.5 : 1,
                    },
                  ]}
                />
              );
            })}
          </View>
        );
      })}

      {/* 2. Unobtrusive Signing Frame Corner Brackets */}
      <View
        style={[
          styles.guideReticle,
          {
            borderColor: isRecording ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 255, 255, 0.2)',
          },
        ]}
      >
        <View
          style={[
            styles.cornerTopLeft,
            { borderColor: isRecording ? COLORS.ruby : 'rgba(255, 255, 255, 0.85)' },
          ]}
        />
        <View
          style={[
            styles.cornerTopRight,
            { borderColor: isRecording ? COLORS.ruby : 'rgba(255, 255, 255, 0.85)' },
          ]}
        />
        <View
          style={[
            styles.cornerBottomLeft,
            { borderColor: isRecording ? COLORS.ruby : 'rgba(255, 255, 255, 0.85)' },
          ]}
        />
        <View
          style={[
            styles.cornerBottomRight,
            { borderColor: isRecording ? COLORS.ruby : 'rgba(255, 255, 255, 0.85)' },
          ]}
        />
      </View>

      {/* 3. Guidance Status Pill */}
      <View style={styles.guidancePill}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isRecording
                ? COLORS.ruby
                : hasDetectedHands
                ? COLORS.emerald
                : COLORS.cyan,
            },
          ]}
        />
        <Text style={styles.guidanceText} numberOfLines={1}>
          {effectiveStatus}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  jointMarker: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  guideReticle: {
    position: 'absolute',
    width: '88%',
    height: '84%',
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 22,
    height: 22,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: RADII.md,
  },
  cornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: RADII.md,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 22,
    height: 22,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: RADII.md,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: RADII.md,
  },
  guidancePill: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 14, 20, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  guidanceText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
