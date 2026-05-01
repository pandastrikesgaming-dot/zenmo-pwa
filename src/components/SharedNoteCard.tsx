import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { PdfPageCountProbe } from './PdfPageCountProbe';
import { updateNotePageCount } from '../services';
import { colors, typography } from '../theme';
import type { RecentNote } from '../types';

type SharedNoteCardProps = {
  note: RecentNote | null | undefined;
  errorMessage?: string | null;
  timestamp: string;
  mine: boolean;
  onPress?: () => void;
};

function getFileTypeCopy(note: RecentNote) {
  if (note.fileType === 'pdf') {
    return {
      label: 'PDF',
      icon: 'document-text-outline' as const,
    };
  }

  if (note.fileType === 'multi_image') {
    return {
      label: 'IMG',
      icon: 'albums-outline' as const,
    };
  }

  return {
    label: 'IMG',
    icon: 'image-outline' as const,
  };
}

export function SharedNoteCard({
  note,
  errorMessage,
  timestamp,
  mine,
  onPress,
}: SharedNoteCardProps) {
  const [displayPages, setDisplayPages] = useState(Math.max(note?.pages ?? 1, 1));
  const accentColor = mine ? colors.primarySoft : note?.accentColor ?? '#A66BFF';
  const typeCopy = note ? getFileTypeCopy(note) : null;

  useEffect(() => {
    setDisplayPages(Math.max(note?.pages ?? 1, 1));
  }, [note?.id, note?.pages]);

  const metadataText = note
    ? `${displayPages} ${displayPages === 1 ? 'page' : 'pages'} / ${note.date} / by ${
        note.userName || 'Unknown'
      }`
    : errorMessage ?? 'Loading shared note...';
  const disabled = !note;

  function handleDetectedPageCount(pageCount: number) {
    if (!note) {
      return;
    }

    const normalizedPageCount = Math.max(pageCount, 1);
    setDisplayPages(normalizedPageCount);
    void updateNotePageCount(note.id, normalizedPageCount);
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        mine ? styles.cardMine : styles.cardOther,
        { borderColor: `${accentColor}88` },
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      {note?.fileType === 'pdf' ? (
        <PdfPageCountProbe fileUrl={note.fileUrl} onPageCount={handleDetectedPageCount} />
      ) : null}
      <LinearGradient
        colors={
          mine
            ? ['rgba(255, 138, 26, 0.22)', 'rgba(34, 16, 6, 0.96)', 'rgba(255, 138, 26, 0.14)']
            : ['rgba(166, 92, 255, 0.22)', 'rgba(8, 5, 21, 0.98)', 'rgba(64, 35, 120, 0.12)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <View style={styles.headerRow}>
        <View
          style={[
            styles.fileIcon,
            {
              borderColor: `${accentColor}88`,
              backgroundColor: mine ? 'rgba(18, 14, 12, 0.16)' : `${accentColor}18`,
            },
          ]}
        >
          {typeCopy ? (
            <>
              <Text style={[styles.fileType, { color: accentColor }]}>{typeCopy.label}</Text>
              <Ionicons name={typeCopy.icon} size={18} color={accentColor} />
            </>
          ) : (
            <Ionicons
              name={errorMessage ? 'alert-circle-outline' : 'document-attach-outline'}
              size={24}
              color={accentColor}
            />
          )}
        </View>

        <View style={styles.copy}>
          <Text
            numberOfLines={2}
            style={[styles.title, mine ? styles.titleMine : styles.titleOther]}
          >
            {note?.title ?? 'Shared note'}
          </Text>

          {note ? (
            <View
              style={[
                styles.subjectTag,
                {
                  borderColor: `${accentColor}BB`,
                  backgroundColor: mine ? 'rgba(18, 14, 12, 0.14)' : `${accentColor}14`,
                },
              ]}
            >
              <Text style={[styles.subjectText, { color: accentColor }]}>{note.subject}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[styles.meta, mine ? styles.metaMine : styles.metaOther]}>{metadataText}</Text>

      <View style={styles.footerRow}>
        <Text style={[styles.cta, mine ? styles.ctaMine : styles.ctaOther]}>
          {note ? 'Tap to view note' : 'Note unavailable'}
        </Text>
        <Text style={[styles.timestamp, mine ? styles.timestampMine : styles.timestampOther]}>
          {timestamp}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '80%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 13,
    overflow: 'hidden',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  cardMine: {
    backgroundColor: 'rgba(36, 16, 6, 0.95)',
    shadowColor: colors.primary,
  },
  cardOther: {
    backgroundColor: 'rgba(12, 8, 28, 0.95)',
    shadowColor: '#A66BFF',
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileIcon: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  fileType: {
    fontFamily: typography.fontFamily.display,
    fontSize: 14,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.sm,
  },
  titleMine: {
    color: colors.text,
  },
  titleOther: {
    color: colors.text,
  },
  subjectTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subjectText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  meta: {
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.xs,
    lineHeight: 17,
  },
  metaMine: {
    color: colors.textMuted,
  },
  metaOther: {
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cta: {
    flex: 1,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ctaMine: {
    color: colors.primarySoft,
  },
  ctaOther: {
    color: colors.primarySoft,
  },
  timestamp: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timestampMine: {
    color: colors.primarySoft,
  },
  timestampOther: {
    color: colors.textMuted,
  },
});
