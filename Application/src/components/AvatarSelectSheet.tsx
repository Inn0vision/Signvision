import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS, RADII, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import type { AvatarName } from '../types';

export interface AvatarSelectSheetProps {
  visible: boolean;
  selectedAvatar: AvatarName;
  onSelectAvatar: (avatar: AvatarName) => void;
  onClose: () => void;
}

interface AvatarOption {
  id: AvatarName;
  gender: 'Female' | 'Male';
  name: string;
  avatarIcon: string;
  tagline: string;
  description: string;
  tags: string[];
  accentColor: string;
}

const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'luna',
    gender: 'Female',
    name: 'Luna',
    avatarIcon: '👩',
    tagline: 'Modern Stylized Female',
    description:
      'Expressive eyes, animated facial phonemes, and high-contrast red sleeves providing maximum finger & palm visibility.',
    tags: ['Stylized', 'High Contrast', 'Expressive', 'H-Anim'],
    accentColor: '#10B981', // Emerald
  },
  {
    id: 'marc',
    gender: 'Male',
    name: 'Marc',
    avatarIcon: '👨',
    tagline: 'Natural Athletic Male',
    description:
      'Balanced masculine proportions with exposed forearms for unobstructed wrist rotation and sign articulation.',
    tags: ['Athletic', 'Clean Build', 'Clear Forearms', 'H-Anim'],
    accentColor: '#06B6D4', // Cyan
  },
  {
    id: 'anna',
    gender: 'Female',
    name: 'Anna',
    avatarIcon: '👱‍♀️',
    tagline: 'Classic Blonde Female',
    description:
      'The foundational CWASA signing avatar with casual short sleeves and precise hand gesture geometry.',
    tags: ['Classic Female', 'Casual Outfit', 'H-Anim'],
    accentColor: '#F59E0B', // Amber
  },
  {
    id: 'francoise',
    gender: 'Female',
    name: 'Francoise',
    avatarIcon: '👩‍💼',
    tagline: 'Professional European Female',
    description:
      'Formal, professional styling established across international sign language research and translation platforms.',
    tags: ['Professional', 'Dark Attire', 'International Standard'],
    accentColor: '#8B5CF6', // Purple
  },
  {
    id: 'siggi',
    gender: 'Male',
    name: 'Siggi',
    avatarIcon: '🧢',
    tagline: 'Stylized Casual Male',
    description:
      'Youthful stylized male avatar with casual knit beanie/cap and articulated signing hands.',
    tags: ['Stylized Male', 'Casual Beanie', 'H-Anim'],
    accentColor: '#EC4899', // Pink
  },
];

export function AvatarSelectSheet({
  visible,
  selectedAvatar,
  onSelectAvatar,
  onClose,
}: AvatarSelectSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Drag Handle */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>3D Signing Avatars</Text>
              <Text style={styles.subtitle}>
                Choose your preferred sign language character
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close avatar selector"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar Cards */}
          <ScrollView
            style={styles.cardsScrollView}
            contentContainerStyle={styles.cardsContainer}
            showsVerticalScrollIndicator={false}
          >
            {AVATAR_OPTIONS.map((opt) => {
              const isSelected = selectedAvatar === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.85}
                  onPress={() => {
                    onSelectAvatar(opt.id);
                    onClose();
                  }}
                  style={[
                    styles.card,
                    isSelected && {
                      borderColor: opt.accentColor,
                      backgroundColor: '#111A2E',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${opt.name} as signing avatar`}
                >
                  <View style={styles.cardHeader}>
                    {/* Avatar Icon Pill */}
                    <View
                      style={[
                        styles.avatarIconBox,
                        {
                          borderColor: isSelected
                            ? opt.accentColor
                            : 'rgba(255, 255, 255, 0.15)',
                        },
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>{opt.avatarIcon}</Text>
                    </View>

                    {/* Character Identity */}
                    <View style={styles.charIdentity}>
                      <View style={styles.nameRow}>
                        <Text style={styles.charName}>{opt.name}</Text>
                        <View
                          style={[
                            styles.genderBadge,
                            { backgroundColor: `${opt.accentColor}20` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.genderBadgeText,
                              { color: opt.accentColor },
                            ]}
                          >
                            {opt.gender.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.tagline}>{opt.tagline}</Text>
                    </View>

                    {/* Radio / Check Badge */}
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && {
                          borderColor: opt.accentColor,
                          backgroundColor: opt.accentColor,
                        },
                      ]}
                    >
                      {isSelected && <Text style={styles.radioCheck}>✓</Text>}
                    </View>
                  </View>

                  {/* Character Description */}
                  <Text style={styles.description}>{opt.description}</Text>

                  {/* Feature Tags */}
                  <View style={styles.tagsRow}>
                    {opt.tags.map((tag, idx) => (
                      <View key={idx} style={styles.tagPill}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Selection Status Banner */}
                  {isSelected && (
                    <View
                      style={[
                        styles.activeBanner,
                        { backgroundColor: `${opt.accentColor}18` },
                      ]}
                    >
                      <View
                        style={[
                          styles.activeDot,
                          { backgroundColor: opt.accentColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.activeBannerText,
                          { color: opt.accentColor },
                        ]}
                      >
                        CURRENT ACTIVE CHARACTER
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Engine Notice Footer */}
          <View style={styles.footerNotice}>
            <Text style={styles.footerText}>
              ⚡ All 5 avatars are 100% compatible with all 1,149+ ISL signs & CWASA vhg2026.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#0A101D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 24,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 20,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardsScrollView: {
    flexGrow: 0,
  },
  cardsContainer: {
    gap: 14,
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  charIdentity: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  charName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 18,
  },
  genderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  genderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCheck: {
    color: '#07080D',
    fontSize: 12,
    fontWeight: '900',
  },
  description: {
    ...TYPOGRAPHY.body,
    color: '#CBD5E1',
    lineHeight: 18,
    fontSize: 12.5,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tagText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  activeBannerText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  footerNotice: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.20)',
    alignItems: 'center',
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.cyanLight,
    fontSize: 11,
    textAlign: 'center',
  },
});
