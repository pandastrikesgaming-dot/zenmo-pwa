import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { DocumentPreviewBlock } from './DocumentPreviewBlock';
import { colors, typography } from '../theme';
import type { UploadDraftFile } from '../types';

type FilePreviewCardProps = {
  file: UploadDraftFile | null;
  onClear?: () => void;
};

export function FilePreviewCard({ file, onClear }: FilePreviewCardProps) {
  if (!file) {
    return (
      <View style={styles.emptyCard}>
        <LinearGradient
          colors={['rgba(143, 44, 255, 0.12)', 'rgba(12, 7, 13, 0.94)', 'rgba(255, 132, 39, 0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyGradient}
        />
        <View style={styles.emptyGraphic}>
          <Ionicons name="document-text-outline" size={34} color="#A65CFF" />
          <View style={styles.emptyLineWide} />
          <View style={styles.emptyLineMedium} />
          <View style={styles.emptyLineShort} />
        </View>
        <Text style={styles.emptyTitle}>No file selected</Text>
        <Text style={styles.emptyText}>
          Choose a photo, gallery image, or PDF to prepare your note upload.
        </Text>
      </View>
    );
  }

  const isPdf = file.type === 'pdf';
  const fileTypeLabel = file.type === 'multi_image' ? 'MULTI IMAGE' : file.type.toUpperCase();
  const accentColor = isPdf ? colors.accentYellow : colors.primary;

  return (
    <View style={styles.previewCard}>
      <LinearGradient
        colors={[`${accentColor}14`, 'rgba(12, 7, 13, 0.94)', 'rgba(143, 44, 255, 0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyGradient}
      />
      <View style={[styles.previewPanel, { borderColor: accentColor }]}>
        <DocumentPreviewBlock
          accentColor={accentColor}
          fileType={file.type}
          imageUrl={file.previewUri}
          pages={file.pageCount}
        />
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCopy}>
          <Text style={styles.fileMeta}>{fileTypeLabel}</Text>
        </View>

        <Pressable onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearLabel}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.62)',
    borderRadius: 16,
    backgroundColor: '#0E080E',
    padding: 18,
    gap: 16,
    overflow: 'hidden',
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyGraphic: {
    height: 146,
    borderWidth: 1,
    borderColor: 'rgba(255, 132, 39, 0.42)',
    borderRadius: 10,
    backgroundColor: 'rgba(26, 5, 7, 0.54)',
    padding: 18,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 10,
  },
  emptyLineWide: {
    width: '86%',
    height: 10,
    backgroundColor: colors.border,
  },
  emptyLineMedium: {
    width: '66%',
    height: 10,
    backgroundColor: colors.border,
  },
  emptyLineShort: {
    width: '42%',
    height: 10,
    backgroundColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.52)',
    borderRadius: 16,
    backgroundColor: '#0E080E',
    padding: 16,
    gap: 14,
    overflow: 'hidden',
  },
  previewPanel: {
    minHeight: 184,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 5, 7, 0.54)',
    justifyContent: 'center',
    padding: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoCopy: {
    flex: 1,
    gap: 4,
  },
  fileMeta: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 132, 39, 0.55)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 132, 39, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearLabel: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
