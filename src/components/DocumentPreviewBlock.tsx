import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme';
import type { UploadFileType } from '../types';

type DocumentPreviewBlockProps = {
  accentColor: string;
  fileType: UploadFileType;
  imageUrl?: string | null;
  pages?: number;
  size?: 'compact' | 'large';
};

export function DocumentPreviewBlock({
  accentColor,
  fileType,
  imageUrl,
  pages = 1,
  size = 'large',
}: DocumentPreviewBlockProps) {
  const isPdf = fileType === 'pdf';
  const isImageLike = fileType === 'image' || fileType === 'multi_image';
  const isCompact = size === 'compact';

  if (isImageLike && imageUrl) {
    return (
      <View style={[styles.imagePreview, isCompact && styles.imagePreviewCompact]}>
        <View style={[styles.previewBar, { backgroundColor: accentColor }]} />
        <Image
          source={{ uri: imageUrl }}
          style={[styles.previewImage, isCompact && styles.previewImageCompact]}
          resizeMode="cover"
        />
        {!isCompact ? (
          <Text style={styles.previewCaption}>
            {fileType === 'multi_image' ? `${pages} page image set` : 'Image preview'}
          </Text>
        ) : null}
      </View>
    );
  }

  if (isPdf) {
    return (
      <View style={[styles.pdfPreview, isCompact && styles.pdfPreviewCompact]}>
        <View style={styles.pdfTopRow}>
          <Text style={[styles.pdfBadge, isCompact && styles.pdfBadgeCompact]}>PDF</Text>
          <View style={[styles.pdfPill, { borderColor: accentColor }]}>
            <Text style={[styles.pdfPillText, { color: accentColor }]}>{pages}P</Text>
          </View>
        </View>

        <View style={styles.pdfSheet}>
          <View style={styles.pdfLineStack}>
            <View style={styles.pdfLineWide} />
            <View style={styles.pdfLineMedium} />
            <View style={styles.pdfLineShort} />
          </View>
        </View>

        {!isCompact ? <Text style={styles.previewCaption}>Document preview</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.genericPreview, isCompact && styles.genericPreviewCompact]}>
      <View style={[styles.previewBar, { backgroundColor: accentColor }]} />
      <View style={styles.genericCanvas}>
        <View style={styles.genericBlockLarge} />
        <View style={styles.genericBlockSmall} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imagePreview: {
    gap: 16,
  },
  imagePreviewCompact: {
    gap: 10,
  },
  previewBar: {
    width: 82,
    height: 10,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewImageCompact: {
    height: 76,
  },
  pdfPreview: {
    gap: 14,
  },
  pdfPreviewCompact: {
    gap: 10,
  },
  pdfTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pdfBadge: {
    color: colors.accentYellow,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.hero,
    lineHeight: typography.lineHeight.hero,
  },
  pdfBadgeCompact: {
    fontSize: typography.size.xxl,
    lineHeight: typography.lineHeight.xxl,
  },
  pdfPill: {
    borderWidth: 1,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pdfPillText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pdfSheet: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    minHeight: 112,
    padding: 16,
    justifyContent: 'center',
  },
  pdfLineStack: {
    gap: 10,
  },
  pdfLineWide: {
    width: '92%',
    height: 8,
    backgroundColor: colors.border,
  },
  pdfLineMedium: {
    width: '72%',
    height: 8,
    backgroundColor: colors.border,
  },
  pdfLineShort: {
    width: '44%',
    height: 8,
    backgroundColor: colors.border,
  },
  previewCaption: {
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
  },
  genericPreview: {
    gap: 14,
  },
  genericPreviewCompact: {
    gap: 10,
  },
  genericCanvas: {
    flexDirection: 'row',
    gap: 12,
  },
  genericBlockLarge: {
    flex: 2,
    height: 108,
    backgroundColor: colors.border,
  },
  genericBlockSmall: {
    flex: 1,
    height: 108,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
});
