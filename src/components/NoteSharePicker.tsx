import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { PdfPageCountProbe } from './PdfPageCountProbe';
import { fetchShareableNotes, updateNotePageCount } from '../services';
import { colors, typography } from '../theme';
import type { RecentNote } from '../types';

type NoteSharePickerProps = {
  visible: boolean;
  isSharing: boolean;
  onClose: () => void;
  onShare: (note: RecentNote) => void | Promise<void>;
};

function getFileIcon(note: RecentNote) {
  if (note.fileType === 'pdf') {
    return 'document-text-outline' as const;
  }

  if (note.fileType === 'multi_image') {
    return 'albums-outline' as const;
  }

  return 'image-outline' as const;
}

function getFileLabel(note: RecentNote) {
  if (note.fileType === 'pdf') {
    return 'PDF';
  }

  return 'IMG';
}

export function NoteSharePicker({
  visible,
  isSharing,
  onClose,
  onShare,
}: NoteSharePickerProps) {
  const [notes, setNotes] = useState<RecentNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<RecentNote | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return notes;
    }

    return notes.filter((note) => {
      const haystack = `${note.title} ${note.subject} ${note.userName}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [notes, searchText]);

  useEffect(() => {
    if (!visible) {
      setSelectedNote(null);
      setSearchText('');
      setErrorMessage(null);
      return;
    }

    let isActive = true;

    async function loadNotes() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const data = await fetchShareableNotes();

        if (isActive) {
          setNotes(data);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to load notes you can share right now.';

        if (isActive) {
          setErrorMessage(message);
          setNotes([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadNotes();

    return () => {
      isActive = false;
    };
  }, [visible]);

  function handleShare() {
    if (!selectedNote || isSharing) {
      return;
    }

    void onShare(selectedNote);
  }

  function handlePageCountDetected(noteId: string, pageCount: number) {
    const normalizedPageCount = Math.max(pageCount, 1);

    setNotes((current) =>
      current.map((note) =>
        note.id === noteId && note.pages !== normalizedPageCount
          ? { ...note, pages: normalizedPageCount }
          : note
      )
    );
    setSelectedNote((current) =>
      current?.id === noteId && current.pages !== normalizedPageCount
        ? { ...current, pages: normalizedPageCount }
        : current
    );

    void updateNotePageCount(noteId, normalizedPageCount);
  }

  function renderNoteRow({ item }: { item: RecentNote }) {
    const isSelected = selectedNote?.id === item.id;
    const metadataText = `${item.pages} ${item.pages === 1 ? 'page' : 'pages'} / ${item.date}`;

    return (
      <Pressable
        onPress={() => {
          if (isSharing) {
            return;
          }

          setSelectedNote(item);
          void onShare(item);
        }}
        disabled={isSharing}
        style={({ pressed }) => [
          styles.noteCard,
          { borderColor: isSelected ? item.accentColor : 'rgba(247, 240, 232, 0.13)' },
          isSelected && styles.noteCardSelected,
          pressed && !isSharing && styles.pressed,
          isSharing && styles.noteCardDisabled,
        ]}
      >
        {item.fileType === 'pdf' ? (
          <PdfPageCountProbe
            fileUrl={item.fileUrl}
            onPageCount={(pageCount) => handlePageCountDetected(item.id, pageCount)}
          />
        ) : null}
        <LinearGradient
          colors={['rgba(143, 44, 255, 0.13)', 'rgba(5, 3, 9, 0.98)', 'rgba(255, 132, 39, 0.07)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rowGradient}
        />

        <View
          style={[
            styles.fileTile,
            { borderColor: `${item.accentColor}88`, backgroundColor: `${item.accentColor}16` },
          ]}
        >
          {item.fileType === 'image' || item.fileType === 'multi_image' ? (
            <Image source={{ uri: item.fileUrl }} style={styles.previewImage} resizeMode="cover" />
          ) : null}
          <View style={styles.fileOverlay}>
            <Text style={[styles.fileLabel, { color: item.accentColor }]}>{getFileLabel(item)}</Text>
            <Ionicons name={getFileIcon(item)} size={16} color={item.accentColor} />
          </View>
        </View>

        <View style={styles.noteCopy}>
          <Text numberOfLines={1} style={styles.noteTitle}>
            {item.title}
          </Text>
          <View
            style={[
              styles.subjectTag,
              { borderColor: `${item.accentColor}99`, backgroundColor: `${item.accentColor}12` },
            ]}
          >
            <Text style={[styles.subjectText, { color: item.accentColor }]}>{item.subject}</Text>
          </View>
          <Text numberOfLines={1} style={styles.noteMeta}>
            {metadataText}
          </Text>
        </View>

        <Text style={[styles.tapHint, { color: item.accentColor }]}>Tap to send</Text>
      </Pressable>
    );
  }

  function renderHorizontalNotes() {
    if (filteredNotes.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No notes to share</Text>
          <Text style={styles.emptyText}>
            Notes you can view or own will appear here for sharing.
          </Text>
        </View>
      );
    }

    if (filteredNotes.length > 10) {
      return (
        <FlatList
          horizontal
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderNoteRow}
          contentContainerStyle={styles.horizontalListContent}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          snapToInterval={152}
          decelerationRate="fast"
        />
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.horizontalListContent}
        style={styles.horizontalList}
      >
        {filteredNotes.map((note) => (
          <View key={note.id}>{renderNoteRow({ item: note })}</View>
        ))}
      </ScrollView>
    );
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <LinearGradient
            colors={['rgba(25, 9, 51, 0.98)', 'rgba(3, 3, 12, 0.99)', 'rgba(28, 10, 8, 0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetGradient}
          >
            <View pointerEvents="none" style={styles.sheetGlow} />
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Share Existing Note</Text>
                <Text style={styles.title}>Share a Note</Text>
              </View>

              <Pressable onPress={onClose} disabled={isSharing} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search title, subject, or uploader"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                selectionColor={colors.primary}
              />
            </View>

            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading notes...</Text>
              </View>
            ) : (
              <View style={styles.shareShelf}>{renderHorizontalNotes()}</View>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                disabled={isSharing}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleShare}
                disabled={!selectedNote || isSharing}
                style={({ pressed }) => [
                  styles.shareButton,
                  (!selectedNote || isSharing) && styles.shareButtonDisabled,
                  pressed && selectedNote && !isSharing && styles.pressed,
                ]}
              >
                <LinearGradient
                  colors={['#FF7A1A', '#FFB54A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shareGradient}
                >
                  <Text style={styles.shareLabel}>{isSharing ? 'Sharing...' : 'Share in Chat'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.72)',
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetGradient: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 22,
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
  handle: {
    alignSelf: 'center',
    width: 70,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(247, 240, 232, 0.28)',
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 5,
  },
  kicker: {
    color: '#A66BFF',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.16)',
    backgroundColor: 'rgba(247, 240, 232, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: 'rgba(166, 92, 255, 0.5)',
    backgroundColor: 'rgba(3, 3, 12, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    paddingVertical: 10,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    borderColor: 'rgba(255, 138, 26, 0.4)',
    backgroundColor: 'rgba(255, 138, 26, 0.09)',
    padding: 12,
  },
  errorText: {
    color: '#FFB083',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  loadingState: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
  },
  shareShelf: {
    width: '100%',
    minHeight: 206,
  },
  horizontalList: {
    width: '100%',
  },
  horizontalListContent: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  noteCard: {
    width: 140,
    minHeight: 198,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#07050D',
    padding: 10,
    gap: 9,
    overflow: 'hidden',
  },
  noteCardSelected: {
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.22,
    shadowRadius: 13,
    elevation: 4,
  },
  noteCardDisabled: {
    opacity: 0.72,
  },
  rowGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  fileTile: {
    width: '100%',
    height: 86,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 3, 12, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fileLabel: {
    fontFamily: typography.fontFamily.display,
    fontSize: 15,
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  noteCopy: {
    gap: 6,
    minHeight: 72,
  },
  noteTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
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
  noteMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.xs,
  },
  tapHint: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  emptyState: {
    minHeight: 186,
    borderWidth: 1,
    borderRadius: 14,
    borderColor: 'rgba(247, 240, 232, 0.13)',
    backgroundColor: 'rgba(247, 240, 232, 0.04)',
    padding: 18,
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.7)',
    backgroundColor: 'rgba(4, 3, 12, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  shareButton: {
    flex: 1.15,
    minHeight: 52,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.36,
    shadowRadius: 14,
    elevation: 5,
  },
  shareButtonDisabled: {
    opacity: 0.55,
  },
  shareGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  shareLabel: {
    color: '#120A05',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
});
