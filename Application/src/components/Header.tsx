import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { COLORS, RADII } from '../theme/tokens';
import { HandSignIcon, ArrowRightIcon } from './ui/AppIcons';

export interface HeaderProps {
  avatarReady?: boolean;
  isOffline?: boolean;
  signsCount?: number;
  historyCount?: number;
  showHistoryButton?: boolean;
  onOpenHistory?: () => void;
  onOpenCamera?: () => void;
  onOpenLiveCamera?: () => void;
  onOpenSettings?: () => void;
  ctaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const signToEnglishPillWebStyle = Platform.OS === 'web' ? ({
  backgroundImage: 'linear-gradient(90deg, #1D4ED8 0%, #0284C7 45%, #00C9D8 100%)',
} as any) : null;

export function Header({
  showHistoryButton = false,
  ctaLabel,
  onOpenHistory,
  onOpenCamera,
  onOpenLiveCamera,
  onOpenSettings,
  style,
}: HeaderProps) {
  const handleCamera = onOpenLiveCamera || onOpenCamera || (() => {});
  const displayLabel = ctaLabel || 'Sign to English';

  return (
    <View style={[styles.container, style]}>
      {/* Brand Logo: Clean "SignVision" with "Sign" in light blue and "Vision" in white */}
      <View style={styles.brandRow}>
        <Text style={styles.logoContainer} accessibilityRole="header">
          <Text style={styles.logoSign}>Vani</Text>
          <Text style={styles.logoVision}>Mudra</Text>
        </Text>
      </View>

      {/* Action: Sign to English Gradient Pill Button */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleCamera}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={displayLabel}
          hitSlop={6}
          style={({ pressed }) => [
            styles.signToEnglishPill,
            signToEnglishPillWebStyle,
            pressed && styles.buttonPressed,
          ]}
        >
          {/* Subtle Hand Sign badge icon */}
          <View style={styles.handIconBadge}>
            <HandSignIcon size={14} color="#FFFFFF" />
          </View>

          <Text style={styles.signToEnglishText} numberOfLines={1}>
            {displayLabel}
          </Text>

          <ArrowRightIcon size={13} color="#FFFFFF" />
        </Pressable>

        {/* Optional Secondary History icon (kept clean if requested) */}
        {showHistoryButton && onOpenHistory && (
          <Pressable
            onPress={onOpenHistory}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Open Translation History"
            hitSlop={6}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.iconBtnText}>⏱</Text>
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
    paddingHorizontal: 18,
    paddingTop:
      Platform.OS === 'android'
        ? (StatusBar.currentHeight ?? 24) + 6
        : Platform.OS === 'ios'
        ? 4
        : 10,
    paddingBottom: 10,
    backgroundColor: COLORS.bgDark || '#050A12',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    letterSpacing: -0.4,
  },
  logoSign: {
    fontSize: 24,
    fontWeight: '700',
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  logoVision: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signToEnglishPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: RADII.full,
    backgroundColor: '#0284C7',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#00C9D8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  handIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  signToEnglishText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 6,
    letterSpacing: -0.1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

export default Header;
