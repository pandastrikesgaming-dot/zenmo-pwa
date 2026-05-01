import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { PdfPageCountProbe } from './PdfPageCountProbe';
import { colors, typography } from '../theme';

type NoteCardProps = {
  noteId: string;
  title: string;
  subject: string;
  fileType: 'image' | 'pdf' | 'multi_image';
  fileUrl: string;
  userName: string;
  date: string;
  pages: number;
  accentColor: string;
  onPress?: () => void;
  onReportPress?: () => void;
  onPageCountDetected?: (noteId: string, pageCount: number) => void;
};

export function NoteCard({
  noteId,
  title,
  subject,
  fileType,
  fileUrl,
  userName,
  date,
  pages,
  accentColor,
  onPress,
  onReportPress,
  onPageCountDetected,
}: NoteCardProps) {
  const isPdf = fileType === 'pdf';
  const [displayPages, setDisplayPages] = useState(Math.max(pages, 1));
  const metadataText = `${displayPages} ${displayPages === 1 ? 'page' : 'pages'} • ${date} • by ${userName || 'Unknown'}`;
  const typeLabel = isPdf ? 'PDF' : 'IMG';
  const iconName = isPdf ? 'document-text-outline' : 'image-outline';

  useEffect(() => {
    setDisplayPages(Math.max(pages, 1));
  }, [pages]);

  function handleDetectedPageCount(pageCount: number) {
    const normalizedPageCount = Math.max(pageCount, 1);
    setDisplayPages(normalizedPageCount);
    onPageCountDetected?.(noteId, normalizedPageCount);
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: `${accentColor}66` },
        pressed && styles.cardPressed,
      ]}
    >
      <LinearGradient
        colors={['rgba(143, 44, 255, 0.16)', 'rgba(5, 3, 9, 0.98)', 'rgba(255, 132, 39, 0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      />
      {isPdf ? (
        <PdfPageCountProbe fileUrl={fileUrl} onPageCount={handleDetectedPageCount} />
      ) : null}
      <View style={[styles.accentCorner, { backgroundColor: accentColor }]} />

      <View style={[styles.fileIconCard, { borderColor: `${accentColor}66`, backgroundColor: `${accentColor}18` }]}>
        <Text style={[styles.fileTypeText, { color: accentColor }]}>{typeLabel}</Text>
        <Ionicons name={iconName} size={22} color={accentColor} />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        <View style={[styles.subjectTag, { borderColor: `${accentColor}BB`, backgroundColor: `${accentColor}14` }]}>
          <Text style={[styles.subjectText, { color: accentColor }]}>{subject}</Text>
        </View>

        <Text style={styles.meta}>{metadataText}</Text>
      </View>

      <View style={styles.trailingColumn}>
        <View style={[styles.pagePill, { borderColor: accentColor }]}>
          <Text style={[styles.pagePillText, { color: accentColor }]}>{displayPages}P</Text>
        </View>
        {onReportPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open note actions"
            hitSlop={10}
            style={styles.moreButton}
            onPress={(event) => {
              event.stopPropagation?.();
              onReportPress();
            }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#AFA1B7" />
          </Pressable>
        ) : (
          <Ionicons name="ellipsis-vertical" size={20} color="#756C78" />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: '#07050D',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 4,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  accentCorner: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 18,
    height: 18,
    borderBottomRightRadius: 18,
  },
  fileIconCard: {
    width: 74,
    height: 74,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fileTypeText: {
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  content: {
    flex: 1,
    gap: 7,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 19,
    lineHeight: 23,
  },
  subjectTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  subjectText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  meta: {
    color: '#A9A1A9',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 17,
  },
  trailingColumn: {
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 6,
  },
  moreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePill: {
    minWidth: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  pagePillText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 13,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
});
