import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Badge } from './ui/Badge';
import { COLORS, RADII, TYPOGRAPHY } from '../theme/tokens';

export interface GlossToken {
  word?: string;
  text?: string;
  tag?: string;
  active?: boolean;
  sigml_url?: string;
  isAvailable?: boolean;
}

export interface GlossTokenBarProps {
  tokens: GlossToken[];
  originalSentence?: string;
  activeIndex?: number;
  onSelectToken?: (index: number, token: GlossToken) => void;
  style?: StyleProp<ViewStyle>;
  title?: string;
}

export function GlossTokenBar({
  tokens,
  originalSentence,
  activeIndex = -1,
  onSelectToken,
  style,
  title = 'ISL Syntax Sequence',
}: GlossTokenBarProps) {
  if (!tokens || tokens.length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.tokenCount}>
          {activeIndex >= 0 ? `${activeIndex + 1}/${tokens.length}` : `${tokens.length} signs`}
        </Text>
      </View>

      {originalSentence && (
        <Text style={styles.sentenceText} numberOfLines={1}>
          “{originalSentence}”
        </Text>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {tokens.map((token, index) => {
          const isActive = index === activeIndex || !!token.active;
          const label = (token.word || token.text || '').toUpperCase();
          return (
            <Badge
              key={`${label}-${index}`}
              label={label}
              role={token.tag || 'DEFAULT'}
              isActive={isActive}
              leftDot={isActive}
              onPress={onSelectToken ? () => onSelectToken(index, token) : undefined}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: 10,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  title: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tokenCount: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.emeraldLight,
    fontWeight: '700',
  },
  sentenceText: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  scrollView: {
    maxHeight: 48,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
});
