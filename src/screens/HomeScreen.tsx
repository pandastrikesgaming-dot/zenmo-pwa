import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoteCard, QuickNotePreview, ReportNoteModal, SubjectCard } from '../components';
import { fixedSubjects, getSubjectAccentColor } from '../constants/subjects';
import { useAuth, useClassPresence } from '../hooks';
import { fetchRecentNotes, submitNoteReport, updateNotePageCount } from '../services';
import { colors, typography } from '../theme';
import type {
  NoteReportReason,
  RecentNote,
  RootStackParamList,
  RootTabParamList,
  SubjectSummary,
} from '../types';

function buildSubjectSummaries(notes: RecentNote[]): SubjectSummary[] {
  const counts = notes.reduce<Record<string, number>>((accumulator, note) => {
    accumulator[note.subject] = (accumulator[note.subject] ?? 0) + 1;
    return accumulator;
  }, {});

  const subjectNames = notes.length > 0
    ? Array.from(new Set([...fixedSubjects, ...notes.map((note) => note.subject)]))
    : [...fixedSubjects];

  const scopedSubjects = subjectNames.map((name, index) => ({
    id: `${name}-${index}`,
    name,
    noteCount: counts[name] ?? 0,
    accentColor: getSubjectAccentColor(name),
  }));

  return [
    {
      id: 'subject-all',
      name: 'All',
      noteCount: notes.length,
      accentColor: colors.primary,
    },
    ...scopedSubjects,
  ];
}

function filterNotes(notes: RecentNote[], selectedSubject: string, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return notes.filter((note) => {
    const matchesSubject = selectedSubject === 'All' || note.subject === selectedSubject;

    if (!matchesSubject) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [note.title, note.subject, note.userName].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function HomeScreen() {
  const stackNavigation = useNavigation<NavigationProp<RootStackParamList>>();
  const tabNavigation = useNavigation<BottomTabNavigationProp<RootTabParamList, 'Home'>>();
  const { profile, user } = useAuth();
  const { activeCount } = useClassPresence();
  const isFocused = useIsFocused();
  const [notes, setNotes] = useState<RecentNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<RecentNote | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportNote, setReportNote] = useState<RecentNote | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const subjects = useMemo(() => buildSubjectSummaries(notes), [notes]);
  const filteredNotes = useMemo(
    () => filterNotes(notes, selectedSubject, searchQuery),
    [notes, searchQuery, selectedSubject]
  );
  const hasNotes = notes.length > 0;
  const hasFilteredNotes = filteredNotes.length > 0;
  const activeClassmatesLabel =
    activeCount > 0 ? `${activeCount} active now` : 'No classmates active now';

  async function loadNotes() {
    if (!profile?.schoolId || !profile?.classId || !profile?.sectionId) {
      setNotes([]);
      setErrorMessage(null);
      return;
    }

    try {
      setErrorMessage(null);
      const data = await fetchRecentNotes({
        schoolId: profile.schoolId,
        classId: profile.classId,
        sectionId: profile.sectionId,
      });
      setNotes(data);
      setSelectedSubject((current) =>
        current !== 'All' && !data.some((note) => note.subject === current) ? 'All' : current
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load notes right now.';
      setErrorMessage(message);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await loadNotes();
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      void loadNotes();
    }
  }, [isFocused, profile?.classId, profile?.schoolId, profile?.sectionId]);

  function handleOpenPreview(note: RecentNote) {
    setSelectedNote(note);
  }

  function handleNotePageCountDetected(noteId: string, pageCount: number) {
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

  function handleClosePreview() {
    setSelectedNote(null);
  }

  function handleViewFullNote() {
    if (!selectedNote) {
      return;
    }

    stackNavigation.navigate('NoteDetail', { note: selectedNote });
    setSelectedNote(null);
  }

  function handleResetFilters() {
    setSelectedSubject('All');
    setSearchQuery('');
  }

  function handleOpenReport(note: RecentNote) {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in before reporting a note.');
      return;
    }

    if (profile?.isBanned) {
      Alert.alert('Account restricted', 'Your account has been restricted due to policy violations.');
      return;
    }

    if (note.userId === user.id) {
      Alert.alert('Not available', 'You cannot report your own note.');
      return;
    }

    setReportNote(note);
  }

  async function handleSubmitReport(reason: NoteReportReason, details?: string) {
    if (!reportNote || !user?.id) {
      return;
    }

    setIsSubmittingReport(true);

    try {
      await submitNoteReport({
        noteId: reportNote.id,
        reporterId: user.id,
        reportedUserId: reportNote.userId,
        reason,
        details,
      });
      setReportNote(null);
      Alert.alert('Report submitted', "Report submitted. We'll review it.");
    } catch (error) {
      Alert.alert('Unable to submit report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowOrange} />
      <View pointerEvents="none" style={styles.orbitLine} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brandPurple}>ZEN</Text>
              <Text style={styles.brandOrange}>MO</Text>
            </View>
            <Text style={styles.brandSubtext}>Personal study command center</Text>
          </View>

        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(144, 45, 255, 0.18)', 'rgba(12, 7, 21, 0.72)', 'rgba(255, 125, 31, 0.13)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroPlanetGlow} />
          <View style={styles.heroLightStreak} />
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Academic Dashboard</Text>
            <Text style={styles.title}>Your Notes</Text>
            <Text style={styles.subtitle}>Organized. Smart. Ready.</Text>
          </View>

          <View style={styles.heroActionRow}>
            <Pressable onPress={() => tabNavigation.navigate('Upload')} style={styles.uploadButton}>
              <LinearGradient
                colors={['#8F2CFF', '#FF8427']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.uploadButtonGradient}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
                <Text style={styles.uploadButtonLabel}>Upload Note</Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => tabNavigation.navigate('Requests')} style={[styles.secondaryButton, styles.requestButton]}>
              <Text style={styles.secondaryButtonLabel}>Request Notes</Text>
            </Pressable>

            <Pressable
              onPress={() => stackNavigation.navigate('Messages', { screen: 'ChatList' })}
              style={[styles.secondaryButton, styles.messagesButton]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#B275FF" />
              <Text style={[styles.secondaryButtonLabel, styles.messagesButtonLabel]}>Messages</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>Search Notes</Text>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={22} color="#908794" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search title, subject, or uploader"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              selectionColor={colors.primary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Subjects</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{activeClassmatesLabel}</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectList}
          >
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                name={subject.name}
                noteCount={subject.noteCount}
                accentColor={subject.accentColor}
                active={selectedSubject === subject.name}
                onPress={() => setSelectedSubject(subject.name)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Notes</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Unable to load notes</Text>
              <Text style={styles.errorDescription}>{errorMessage}</Text>
              <Pressable onPress={() => void handleRefresh()} style={styles.retryButton}>
                <Text style={styles.retryButtonLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : hasNotes ? (
            hasFilteredNotes ? (
              <View style={styles.noteList}>
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    noteId={note.id}
                    title={note.title}
                    subject={note.subject}
                    fileType={note.fileType}
                    fileUrl={note.fileUrl}
                    userName={note.userName}
                    date={note.date}
                    pages={note.pages}
                    accentColor={note.accentColor}
                    onPress={() => handleOpenPreview(note)}
                    onReportPress={note.userId === user?.id ? undefined : () => handleOpenReport(note)}
                    onPageCountDetected={handleNotePageCountDetected}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No matching notes</Text>
                <Text style={styles.emptyDescription}>
                  Try a different subject or clear your search to see more results.
                </Text>
                <Pressable onPress={handleResetFilters} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonLabel}>Reset filters</Text>
                </Pressable>
              </View>
            )
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {profile?.sectionId ? 'No notes yet' : 'Section required'}
              </Text>
              <Text style={styles.emptyDescription}>
                {profile?.sectionId
                  ? 'Your uploaded files will appear here for quick review.'
                  : 'Add your section in Profile to unlock notes scoped to your classmates.'}
              </Text>
              <Pressable
                onPress={() => tabNavigation.navigate(profile?.sectionId ? 'Upload' : 'Profile')}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonLabel}>
                  {profile?.sectionId ? 'Upload your first note' : 'Update profile'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <QuickNotePreview
        visible={selectedNote !== null}
        note={selectedNote}
        onClose={handleClosePreview}
        onPageCountDetected={handleNotePageCountDetected}
        onViewFullNote={handleViewFullNote}
      />
      <ReportNoteModal
        visible={reportNote !== null}
        note={reportNote}
        isSubmitting={isSubmittingReport}
        onClose={() => setReportNote(null)}
        onSubmit={handleSubmitReport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020106',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 28,
  },
  cosmicGlowPurple: {
    position: 'absolute',
    top: 92,
    left: -76,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(119, 45, 255, 0.16)',
  },
  cosmicGlowOrange: {
    position: 'absolute',
    top: 182,
    right: -96,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 112, 28, 0.12)',
  },
  orbitLine: {
    position: 'absolute',
    top: 146,
    right: -24,
    width: 210,
    height: 2,
    backgroundColor: 'rgba(255, 111, 37, 0.28)',
    transform: [{ rotate: '-24deg' }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandPurple: {
    color: '#9C35FF',
    fontFamily: typography.fontFamily.display,
    fontSize: 40,
    lineHeight: 44,
    textTransform: 'uppercase',
    letterSpacing: 0,
    textShadowColor: 'rgba(156, 53, 255, 0.36)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  brandOrange: {
    color: '#FF8427',
    fontFamily: typography.fontFamily.display,
    fontSize: 40,
    lineHeight: 44,
    textTransform: 'uppercase',
    letterSpacing: 0,
    textShadowColor: 'rgba(255, 132, 39, 0.32)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  brandSubtext: {
    marginTop: 2,
    color: '#A9A1A9',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 18,
    lineHeight: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#A13BFF',
    borderRadius: 18,
    backgroundColor: '#07030D',
    padding: 24,
    gap: 26,
    overflow: 'hidden',
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPlanetGlow: {
    position: 'absolute',
    right: -62,
    top: -18,
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 3,
    borderColor: 'rgba(255, 132, 39, 0.42)',
    backgroundColor: 'rgba(80, 28, 115, 0.16)',
    transform: [{ rotate: '-24deg' }],
  },
  heroLightStreak: {
    position: 'absolute',
    right: -26,
    top: 112,
    width: 190,
    height: 2,
    backgroundColor: 'rgba(255, 132, 39, 0.44)',
    transform: [{ rotate: '-28deg' }],
  },
  heroCopy: {
    gap: 10,
  },
  eyebrow: {
    color: '#A943FF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 17,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 46,
    lineHeight: 52,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.22)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: '#B5ADB3',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 19,
    lineHeight: 26,
  },
  uploadButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#FF8427',
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  uploadButtonGradient: {
    minWidth: 194,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  uploadButtonLabel: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 17,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(5, 3, 8, 0.72)',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  requestButton: {
    borderColor: '#FF8427',
  },
  messagesButton: {
    borderColor: '#9C54FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryButtonLabel: {
    color: '#FF8427',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  messagesButtonLabel: {
    color: '#B275FF',
  },
  searchCard: {
    borderWidth: 1,
    borderColor: 'rgba(173, 83, 255, 0.44)',
    borderRadius: 16,
    backgroundColor: 'rgba(12, 8, 17, 0.84)',
    padding: 16,
    gap: 14,
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  searchLabel: {
    color: '#FF8427',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  searchInputWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255, 132, 39, 0.58)',
    borderRadius: 8,
    backgroundColor: 'rgba(4, 3, 8, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 16,
    paddingVertical: 14,
  },
  section: {
    gap: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 25,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  sectionBadge: {
    borderRadius: 8,
    backgroundColor: 'rgba(116, 36, 255, 0.22)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    maxWidth: 190,
  },
  sectionBadgeText: {
    color: '#C85DFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    textAlign: 'right',
  },
  sectionMeta: {
    color: '#D35CFF',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  subjectList: {
    gap: 14,
    paddingRight: 20,
  },
  noteList: {
    gap: 0,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: 'rgba(173, 83, 255, 0.34)',
    borderRadius: 16,
    backgroundColor: 'rgba(12, 8, 17, 0.84)',
    padding: 20,
    gap: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  emptyDescription: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.backgroundSecondary,
  },
  emptyButtonLabel: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 20,
    gap: 12,
  },
  errorTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  errorDescription: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonLabel: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
