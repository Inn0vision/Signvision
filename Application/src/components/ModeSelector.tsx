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

import type { ProcessingMode } from '../types';

export interface ModeSelectorProps {
  isSentenceMode?: boolean;
  onToggle?: (sentenceMode: boolean) => void;
  mode?: ProcessingMode;
  onModeChange?: (mode: ProcessingMode) => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function ModeSelector({
  isSentenceMode,
  onToggle,
  mode,
  onModeChange,
  style,
  compact = false,
}: ModeSelectorProps) {
  const isSentence = mode ? mode === 'sentence' : (isSentenceMode ?? false);
  const handleToggle = (sentenceMode: boolean) => {
    if (onModeChange) onModeChange(sentenceMode ? 'sentence' : 'word');
    if (onToggle) onToggle(sentenceMode);
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <View
        accessible={true}
        accessibilityRole="radiogroup"
        accessibilityLabel="Translation Mode Selector"
        style={styles.segmentedControl}
      >
        {/* Word Mode Pill */}
        <Pressable
          onPress={() => handleToggle(false)}
          accessible={true}
          accessibilityRole="radio"
          accessibilityState={{ selected: !isSentence }}
          accessibilityLabel="Word Mode. Direct dictionary sign lookup"
          style={({ pressed }) => [
            styles.segment,
            !isSentence && styles.segmentActive,
            pressed && styles.segmentPressed,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              !isSentence && styles.segmentTextActive,
            ]}
          >
            Word
          </Text>
        </Pressable>

        {/* Sentence Mode Pill */}
        <Pressable
          onPress={() => handleToggle(true)}
          accessible={true}
          accessibilityRole="radio"
          accessibilityState={{ selected: isSentence }}
          accessibilityLabel="Sentence Mode. Full Indian Sign Language grammar translation"
          style={({ pressed }) => [
            styles.segment,
            isSentence && styles.segmentActive,
            pressed && styles.segmentPressed,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              isSentence && styles.segmentTextActive,
            ]}
          >
            Sentence
          </Text>
        </Pressable>
      </View>

      {!compact && (
        <Text style={styles.hintText}>
          {isSentence
            ? '⚡ NLP applies ISL grammar transformations'
            : '📖 Direct dictionary lookup from 1,000+ signs'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 4,
  },
  containerCompact: {
    marginVertical: 0,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: RADII.full,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 44,
    alignItems: 'center',
  },
  segment: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: RADII.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#00DF8F',
    shadowColor: '#00DF8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  segmentPressed: {
    opacity: 0.85,
  },
  segmentText: {
    ...TYPOGRAPHY.caption,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#07080D',
    fontWeight: '700',
  },
  hintText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
