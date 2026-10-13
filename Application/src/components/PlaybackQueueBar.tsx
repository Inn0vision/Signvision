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
import { Button } from './ui/Button';

export interface PlaybackQueueBarProps {
  isPlaying: boolean;
  isPaused?: boolean;
  isBuffering?: boolean;
  currentWord?: string;
  currentIndex: number;
  totalWords?: number;
  totalCount?: number;
  speed?: number;
  playbackSpeed?: number;
  onPlayPause: () => void;
  onReplay: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onStop?: () => void;
  onCycleSpeed?: () => void;
  onSpeedChange?: (speed: number) => void;
  onResetCamera?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PlaybackQueueBar({
  isPlaying,
  isPaused = false,
  isBuffering = false,
  currentWord,
  currentIndex,
  totalWords,
  totalCount,
  speed,
  playbackSpeed,
  compact = false,
  onPlayPause,
  onReplay,
  onSkip,
  onNext,
  onPrevious,
  onStop,
  onCycleSpeed,
  onSpeedChange,
  onResetCamera,
  style,
}: PlaybackQueueBarProps) {
  const wordsCount = totalCount !== undefined ? totalCount : (totalWords ?? 0);
  const currentSpeed = speed !== undefined ? speed : (playbackSpeed ?? 1.0);
  const handleNext = onNext || onSkip;
  const handleStopAction = onStop || onPlayPause;
  const handleCycleSpeed = onCycleSpeed || (() => {
    if (onSpeedChange) {
      const next = currentSpeed >= 1.5 ? 0.75 : Number((currentSpeed + 0.25).toFixed(2));
      onSpeedChange(next);
    }
  });

  if (wordsCount === 0) return null;

  const progressPercent = wordsCount > 0 
    ? Math.min(100, Math.max(0, ((currentIndex + (isPlaying ? 0.5 : 0)) / wordsCount) * 100))
    : 0;

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {/* Top progress track */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      {compact ? (
        <View style={styles.compactContainer}>
          {/* Row 1: Word Info & Speed Pill */}
          <View style={styles.compactHeaderRow}>
            <View style={styles.compactTitleCol}>
              <Text style={styles.playingLabel} numberOfLines={1}>
                {isPlaying ? 'SIGNING' : isPaused ? 'PAUSED' : 'READY'}
              </Text>
              <Text style={styles.compactWordName} numberOfLines={1}>
                {currentWord ? currentWord.toUpperCase() : '---'}
              </Text>
            </View>

            <View style={styles.compactMetaRow}>
              <Text style={styles.queueCount}>
                {Math.min(currentIndex + 1, wordsCount)} / {wordsCount}
              </Text>
              <Pressable
                onPress={handleCycleSpeed}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Playback speed ${currentSpeed}x`}
                style={({ pressed }) => [styles.speedPill, pressed && styles.buttonPressed]}
              >
                <Text style={styles.speedText}>{currentSpeed}x</Text>
              </Pressable>
            </View>
          </View>

          {/* Row 2: Centered Transport Controls */}
          <View style={styles.compactControlsRow}>
            {onResetCamera && (
              <Pressable
                onPress={onResetCamera}
                hitSlop={8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Reset 3D camera"
                style={({ pressed }) => [styles.iconBtn, pressed && styles.buttonPressed]}
              >
                <Text style={styles.iconText}>🎥</Text>
              </Pressable>
            )}

            {onPrevious && (
              <Pressable
                onPress={onPrevious}
                disabled={currentIndex <= 0}
                hitSlop={8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Previous sign"
                style={({ pressed }) => [
                  styles.iconBtn,
                  currentIndex <= 0 && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.iconText}>⏮</Text>
              </Pressable>
            )}

            <Pressable
              onPress={onReplay}
              hitSlop={8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Replay sign"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.buttonPressed]}
            >
              <Text style={styles.iconText}>↺</Text>
            </Pressable>

            <Button
              size="sm"
              variant="glow"
              onPress={onPlayPause}
              accessibilityLabel={isPlaying ? 'Pause signing' : 'Play signing'}
              style={styles.playPauseBtn}
            >
              {isPlaying ? '⏸' : '▶'}
            </Button>

            {handleNext && (
              <Pressable
                onPress={handleNext}
                disabled={currentIndex >= wordsCount - 1}
                hitSlop={8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Skip to next sign"
                style={({ pressed }) => [
                  styles.iconBtn,
                  currentIndex >= wordsCount - 1 && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.iconText}>⏭</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleStopAction}
              hitSlop={8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Stop signing"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.buttonPressed]}
            >
              <Text style={[styles.iconText, { color: COLORS.ruby }]}>⏹</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.contentRow}>
          {/* Info Column */}
          <View style={styles.infoCol}>
            <Text style={styles.playingLabel} numberOfLines={1}>
              {isPlaying
                ? 'SIGNING'
                : isPaused
                ? 'PAUSED'
                : 'READY'}
            </Text>
            <Text style={styles.wordName} numberOfLines={1}>
              {currentWord ? currentWord.toUpperCase() : '---'}
            </Text>
            <Text style={styles.queueCount}>
              {Math.min(currentIndex + 1, wordsCount)} of {wordsCount}
            </Text>
          </View>

          {/* Transport Controls */}
          <View style={styles.controlsRow}>
            {onResetCamera && (
              <Pressable
                onPress={onResetCamera}
                hitSlop={8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Reset 3D camera"
                style={({ pressed }) => [styles.iconBtn, pressed && styles.buttonPressed]}
              >
                <Text style={styles.iconText}>🎥</Text>
              </Pressable>
            )}

            {/* Speed Toggle Pill */}
            <Pressable
              onPress={handleCycleSpeed}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Playback speed ${currentSpeed}x. Tap to change`}
              style={({ pressed }) => [
                styles.speedPill,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.speedText}>{currentSpeed}x</Text>
            </Pressable>

            {/* Previous (if provided) */}
            {onPrevious && (
              <Pressable
                onPress={onPrevious}
                disabled={currentIndex <= 0}
                hitSlop={8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Previous sign"
                style={({ pressed }) => [
                  styles.iconBtn,
                  currentIndex <= 0 && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.iconText}>⏮</Text>
              </Pressable>
            )}

            {/* Replay */}
            <Pressable
              onPress={onReplay}
              hitSlop={8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Replay sign"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.buttonPressed]}
            >
              <Text style={styles.iconText}>↺</Text>
            </Pressable>

            {/* Play / Pause Primary Button */}
            <Button
              size="sm"
              variant="glow"
              onPress={onPlayPause}
              accessibilityLabel={isPlaying ? 'Pause signing' : 'Play signing'}
              style={styles.playPauseBtn}
            >
              {isPlaying ? '⏸' : '▶'}
            </Button>

            {/* Skip Next */}
            {handleNext && (
              <Pressable
                onPress={handleNext}
                disabled={currentIndex >= wordsCount - 1}
                hitSlop={8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Skip to next sign"
                style={({ pressed }) => [
                  styles.iconBtn,
                  currentIndex >= wordsCount - 1 && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.iconText}>⏭</Text>
              </Pressable>
            )}

            {/* Stop Button */}
            <Pressable
              onPress={handleStopAction}
              hitSlop={8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Stop signing"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.buttonPressed]}
            >
              <Text style={[styles.iconText, { color: COLORS.ruby }]}>⏹</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.panel,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.borderBright,
    overflow: 'hidden',
    ...SHADOWS.card,
    marginVertical: 4,
  },
  containerCompact: {
    paddingVertical: 2,
  },
  compactContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  compactTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  compactWordName: {
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.emerald,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoCol: {
    flex: 1,
    marginRight: 12,
  },
  playingLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: COLORS.emeraldLight,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  wordName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  queueCount: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
  },
  speedText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.cyanLight,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADII.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  iconText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  playPauseBtn: {
    minHeight: 38,
    minWidth: 42,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.full,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  buttonDisabled: {
    opacity: 0.35,
  },
});
