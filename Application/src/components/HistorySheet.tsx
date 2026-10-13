import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SheetModal } from './ui/SheetModal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { COLORS, RADII, TYPOGRAPHY } from '../theme/tokens';
import type { SearchHistoryItem } from '../types';

export interface HistorySheetProps {
  visible: boolean;
  onClose: () => void;
  history: SearchHistoryItem[];
  onSelectQuery: (query: string, isSentence: boolean) => void;
  onClearHistory: () => void;
  onRemoveItem?: (id: string) => void;
}

export function HistorySheet({
  visible,
  onClose,
  history,
  onSelectQuery,
  onClearHistory,
  onRemoveItem,
}: HistorySheetProps) {
  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="Search History"
      subtitle={`${history.length} recent translations`}
    >
      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⏱</Text>
          <Text style={styles.emptyTitle}>No Recent Searches</Text>
          <Text style={styles.emptySubtitle}>
            Words and sentences you translate will appear here for fast replay.
          </Text>
        </View>
      ) : (
        <View style={styles.container}>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id || item.timestamp.toString()}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelectQuery(item.query, !!item.isSentence);
                  onClose();
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Replay search ${item.query}`}
                style={({ pressed }) => [
                  styles.historyItem,
                  pressed && styles.itemPressed,
                ]}
              >
                <View style={styles.itemLeft}>
                  <Badge
                    label={item.isSentence ? 'SENTENCE' : 'WORD'}
                    variant={item.isSentence ? 'cyan' : 'emerald'}
                    style={styles.badge}
                  />
                  <Text style={styles.queryText} numberOfLines={1}>
                    {item.query}
                  </Text>
                </View>

                <View style={styles.itemRight}>
                  {onRemoveItem && (
                    <Pressable
                      onPress={() => onRemoveItem(item.id)}
                      hitSlop={8}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.query} from history`}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteText}>✕</Text>
                    </Pressable>
                  )}
                  <Text style={styles.replayArrow}>→</Text>
                </View>
              </Pressable>
            )}
          />

          <View style={styles.footerRow}>
            <Button
              variant="outline"
              size="sm"
              onPress={onClearHistory}
              accessibilityLabel="Clear all history entries"
              style={styles.clearBtn}
            >
              Clear All History
            </Button>
          </View>
        </View>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 380,
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingVertical: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 8,
  },
  itemPressed: {
    backgroundColor: COLORS.surfaceHover,
    borderColor: COLORS.borderMedium,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    marginRight: 8,
    marginVertical: 0,
  },
  queryText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 6,
    marginRight: 8,
  },
  deleteText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  replayArrow: {
    color: COLORS.emerald,
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  clearBtn: {
    borderColor: COLORS.rubyMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
    color: COLORS.textMuted,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
});
