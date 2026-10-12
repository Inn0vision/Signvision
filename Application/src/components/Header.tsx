import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';

export interface HeaderProps {
  avatarReady?: boolean;
  isOffline?: boolean;
  signsCount?: number;
  historyCount?: number;
  showHistoryButton?: boolean;
  onOpenHistory: () => void;
  onOpenCamera?: () => void;
  onOpenLiveCamera?: () => void;
  onOpenSettings?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Header({
  avatarReady = true,
  isOffline = false,
  signsCount,
  historyCount,
  showHistoryButton = true,
  onOpenHistory,
  onOpenCamera,
  onOpenLiveCamera,
  onOpenSettings,
  style,
}: HeaderProps) {
  const handleCamera = onOpenLiveCamera || onOpenCamera || (() => {});

  return (
    <View style={[styles.container, style]}>
      {/* Brand & Status */}
      <View style={styles.brandRow}>
        <View style={styles.logoPill}>
          <Text style={styles.logoText}>SV</Text>
        </View>
        <View style={styles.titleCol}>
          <View style={styles.nameRow}>
            <Text style={styles.brandTitle}>SIGNVISION</Text>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isOffline
                    ? COLORS.amber
                    : avatarReady
                    ? '#00DF8F'
                    : COLORS.cyan,
                },
              ]}
            />
          </View>
          <Text style={styles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {isOffline
              ? 'Offline Dictionary'
              : signsCount !== undefined
              ? `${signsCount} Signs • 3D Avatar Ready`
              : avatarReady
              ? '1149 Signs • 3D Avatar Ready'
              : 'Initializing Avatar...'}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {/* Camera Sign-to-Text Button */}
        <Pressable
          onPress={handleCamera}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open Sign Recognition Camera"
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            styles.cameraActionButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.cameraActionText}>Detect</Text>
        </Pressable>

        {/* History Button (shown on desktop or when enabled) */}
        {showHistoryButton && (
          <Pressable
            onPress={onOpenHistory}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Open Search and Translation History"
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.actionIcon}>⏱</Text>
          </Pressable>
        )}

        {/* Settings Button */}
        {onOpenSettings && (
          <Pressable
            onPress={onOpenSettings}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionButton,
              styles.settingsActionButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.actionIcon}>⚙</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.canvas,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#00DF8F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#00DF8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  logoText: {
    ...TYPOGRAPHY.h3,
    color: '#07080D',
    fontWeight: '900',
    fontSize: 15,
  },
  titleCol: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: RADII.full,
    marginLeft: 8,
  },
  statusSubtitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    height: 38,
    minWidth: 38,
    paddingHorizontal: 10,
    borderRadius: RADII.md,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cameraActionButton: {
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
    borderColor: 'rgba(6, 182, 212, 0.45)',
    borderRadius: RADII.full,
    paddingHorizontal: 12,
  },
  settingsActionButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 0,
  },
  cameraActionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.cyanLight,
    marginLeft: 6,
  },
  actionIcon: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
});
