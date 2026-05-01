import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentPreviewBlock } from './DocumentPreviewBlock';
import { PdfPageCountProbe } from './PdfPageCountProbe';
import { colors, typography } from '../theme';
import type { RecentNote } from '../types';

type QuickNotePreviewProps = {
  visible: boolean;
  note: RecentNote | null;
  onClose: () => void;
  onPageCountDetected?: (noteId: string, pageCount: number) => void;
  onViewFullNote: () => void;
};

export function QuickNotePreview({
  visible,
  note,
  onClose,
  onPageCountDetected,
  onViewFullNote,
}: QuickNotePreviewProps) {
  const insets = useSafeAreaInsets();
  const [displayPages, setDisplayPages] = useState(Math.max(note?.pages ?? 1, 1));

  useEffect(() => {
    setDisplayPages(Math.max(note?.pages ?? 1, 1));
  }, [note?.id, note?.pages]);

  if (!note) {
    return null;
  }

  const activeNote = note;
  const fileTypeLabel =
    activeNote.fileType === 'multi_image' ? 'MULTI IMAGE' : activeNote.fileType.toUpperCase();
  const metadataText = `${displayPages} ${displayPages === 1 ? 'page' : 'pages'} • ${activeNote.date} • by ${
    activeNote.userName || 'Unknown'
  }`;

  function handleDetectedPageCount(pageCount: number) {
    const normalizedPageCount = Math.max(pageCount, 1);
    setDisplayPages(normalizedPageCount);
    onPageCountDetected?.(activeNote.id, normalizedPageCount);
  }

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView
        edges={[]}
        style={[
          styles.overlay,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View pointerEvents="none" style={styles.overlayGlowPurple} />
        <View pointerEvents="none" style={styles.overlayGlowOrange} />
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {activeNote.fileType === 'pdf' ? (
            <PdfPageCountProbe fileUrl={activeNote.fileUrl} onPageCount={handleDetectedPageCount} />
          ) : null}
          <LinearGradient
            colors={['rgba(25, 9, 51, 0.98)', 'rgba(3, 3, 12, 0.99)', 'rgba(28, 10, 8, 0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetGradient}
          >
            <View pointerEvents="none" style={styles.sheetGlow} />
            <View pointerEvents="none" style={styles.sheetOrbit} />
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Quick Preview</Text>
                <Text numberOfLines={2} style={styles.title}>
                  {activeNote.title}
                </Text>
              </View>

              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={23} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: 12 },
              ]}
            >
              <View style={styles.metaChips}>
                <View style={[styles.chip, styles.chipActive]}>
                  <Text style={[styles.chipText, styles.chipTextActive]}>{activeNote.subject}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{fileTypeLabel}</Text>
                </View>
              </View>

              <View style={[styles.previewCard, { borderColor: activeNote.accentColor }]}>
                <LinearGradient
                  colors={['rgba(10, 8, 24, 0.98)', 'rgba(3, 3, 10, 0.98)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.previewGradient}
                >
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewType}>{fileTypeLabel}</Text>
                    <View style={[styles.pageBadge, { borderColor: activeNote.accentColor }]}>
                      <Text style={[styles.pageBadgeText, { color: activeNote.accentColor }]}>
                        {displayPages}P
                      </Text>
                    </View>
                  </View>

                  <View style={styles.previewSurface}>
                    <DocumentPreviewBlock
                      accentColor={activeNote.accentColor}
                      fileType={activeNote.fileType}
                      imageUrl={activeNote.fileUrl}
                      pages={displayPages}
                    />
                  </View>

                  <View style={styles.metadataCard}>
                    <Ionicons name="person-outline" size={20} color="rgba(247, 240, 232, 0.62)" />
                    <Text style={styles.metadataText}>{metadataText}</Text>
                  </View>
                </LinearGradient>
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressedButton]}
              >
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onViewFullNote}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedButton]}
              >
                <LinearGradient
                  colors={['#FF7A1A', '#FFB54A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryLabel}>View Full Note</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
  },
  overlayGlowPurple: {
    position: 'absolute',
    left: -115,
    bottom: 220,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(151, 71, 255, 0.22)',
  },
  overlayGlowOrange: {
    position: 'absolute',
    right: -140,
    bottom: 88,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 138, 26, 0.16)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '92%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.72)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetGradient: {
    maxHeight: '100%',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 14,
    overflow: 'hidden',
  },
  sheetGlow: {
    position: 'absolute',
    left: -90,
    top: -68,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(151, 71, 255, 0.2)',
  },
  sheetOrbit: {
    position: 'absolute',
    right: -66,
    top: 64,
    width: 220,
    height: 78,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.26)',
    borderRadius: 120,
    transform: [{ rotate: '-18deg' }],
  },
  handle: {
    alignSelf: 'center',
    width: 70,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(247, 240, 232, 0.28)',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  content: {
    gap: 16,
    paddingBottom: 4,
  },
  scrollArea: {
    flexShrink: 1,
  },
  kicker: {
    color: '#A66BFF',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 38,
    lineHeight: 43,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.18)',
    textShadowRadius: 9,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.16)',
    backgroundColor: 'rgba(247, 240, 232, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.18)',
    backgroundColor: 'rgba(247, 240, 232, 0.04)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: 'rgba(255, 138, 26, 0.86)',
    backgroundColor: 'rgba(255, 138, 26, 0.12)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  chipText: {
    color: 'rgba(247, 240, 232, 0.6)',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipTextActive: {
    color: '#FFB54A',
  },
  previewCard: {
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 320,
    borderWidth: 1,
    backgroundColor: 'rgba(8, 6, 18, 0.96)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  previewGradient: {
    padding: 16,
    gap: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewType: {
    color: '#FFD85C',
    fontFamily: typography.fontFamily.display,
    fontSize: 34,
    lineHeight: 38,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 181, 74, 0.24)',
    textShadowRadius: 10,
  },
  pageBadge: {
    minWidth: 52,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(5, 4, 13, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pageBadgeText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  previewSurface: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.12)',
    backgroundColor: 'rgba(247, 240, 232, 0.06)',
    padding: 12,
    overflow: 'hidden',
  },
  metadataCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingTop: 2,
  },
  metadataText: {
    flex: 1,
    color: 'rgba(247, 240, 232, 0.62)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 2,
  },
  cancelButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.7)',
    backgroundColor: 'rgba(4, 3, 12, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  cancelLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 9,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.44,
    shadowRadius: 15,
    elevation: 5,
  },
  primaryGradient: {
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primaryLabel: {
    color: '#120A05',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pressedButton: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
});
