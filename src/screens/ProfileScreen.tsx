import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SchoolSelector } from '../components';
import { fixedSubjects } from '../constants/subjects';
import { useAuth } from '../hooks';
import { isValidSection, normalizeSectionId } from '../lib/normalizeSectionId';
import { shareUrlOrCopy } from '../lib/webShare';
import { deleteOwnedNote, fetchRecentNotes, fetchSchoolBySlug, fetchUserNotes, updateOwnedNote } from '../services';
import { colors, typography } from '../theme';
import type { RecentNote, RootStackParamList } from '../types';

const classOptions = [
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

const subjectOptions = [...fixedSubjects];
const ZENMO_SHARE_LINK = 'https://zenmo-io.vercel.app';
const ZENMO_SHARE_MESSAGE = 'Join me on Zenmo - a class-based notes sharing app for students.';

function formatHumanLabel(value: string, mode: 'title' | 'class' = 'title') {
  if (!value.trim()) {
    return mode === 'class' ? 'Class Pending' : 'Not set';
  }

  return value
    .split('-')
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return part;
      }

      const lower = part.toLowerCase();

      if (mode === 'class' && lower === 'class') {
        return 'Class';
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function formatSectionLabel(value: string) {
  const normalized = normalizeSectionId(value);
  return normalized || 'Pending';
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return 'ZN';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function formatArchiveDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFileTypeLabel(value: RecentNote['fileType']) {
  return value === 'multi_image' ? 'MULTI' : value.toUpperCase();
}

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { completeProfile, profile, refreshProfile, signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [myUploads, setMyUploads] = useState<RecentNote[]>([]);
  const [classFeedCount, setClassFeedCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [isNoteManagerVisible, setIsNoteManagerVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [displaySchoolName, setDisplaySchoolName] = useState('Not set');
  const [resolvedSchoolSlug, setResolvedSchoolSlug] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState('Class 10');
  const [section, setSection] = useState('');
  const [sectionTouched, setSectionTouched] = useState(false);
  const [selectedNote, setSelectedNote] = useState<RecentNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectOptions[0]);

  const displayName =
    profile?.fullName.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Zenmo Student';
  const displaySchool = displaySchoolName;
  const displayClass = formatHumanLabel(profile?.classId ?? '', 'class');
  const displaySection = formatSectionLabel(profile?.sectionId ?? '');
  const initials = getInitials(displayName);
  const notesUploaded = myUploads.length;
  const subjectsShared = new Set(myUploads.map((note) => note.subject)).size;
  const sectionIsValid = isValidSection(section);
  const showSectionError = sectionTouched && !sectionIsValid;
  const profileEditCount = Math.min(Math.max(profile?.profileEditCount ?? 0, 0), 2);
  const profileEditsRemaining = Math.max(2 - profileEditCount, 0);
  const profileEditLimitReached = profileEditsRemaining <= 0;
  const editLimitLabel = profileEditLimitReached
    ? 'Profile edit limit reached'
    : `Profile edits remaining: ${profileEditsRemaining}`;

  const canSaveProfile = useMemo(
    () =>
      Boolean(
        fullName.trim() &&
          selectedSchoolId &&
          selectedClass &&
          sectionIsValid &&
          !profileEditLimitReached &&
          !isSavingProfile
      ),
    [
      fullName,
      isSavingProfile,
      profileEditLimitReached,
      sectionIsValid,
      selectedClass,
      selectedSchoolId,
    ]
  );
  const canSaveNote = useMemo(
    () => Boolean(noteTitle.trim() && selectedSubject.trim() && !isSavingNote && !isDeletingNote),
    [isDeletingNote, isSavingNote, noteTitle, selectedSubject]
  );

  useEffect(() => {
    setFullName(displayName);
  }, [displayName]);

  useEffect(() => {
    let isMounted = true;

    async function resolveSchoolName() {
      const schoolSlug = profile?.schoolId ?? '';

      if (!schoolSlug.trim()) {
        if (isMounted) {
          setDisplaySchoolName('Not set');
          setResolvedSchoolSlug(null);
        }
        return;
      }

      try {
        const school = await fetchSchoolBySlug(schoolSlug);

        if (isMounted) {
          setDisplaySchoolName(school?.name ?? schoolSlug);
          setResolvedSchoolSlug(school?.slug ?? null);
        }
      } catch {
        if (isMounted) {
          setDisplaySchoolName(schoolSlug);
          setResolvedSchoolSlug(null);
        }
      }
    }

    void resolveSchoolName();

    return () => {
      isMounted = false;
    };
  }, [profile?.schoolId]);

  useEffect(() => {
    setSelectedClass(displayClass === 'Class Pending' ? 'Class 10' : displayClass);
  }, [displayClass]);

  async function loadProfileScreenData() {
    if (!user?.id) {
      setMyUploads([]);
      setClassFeedCount(0);
      setLoadError(null);
      return;
    }

    try {
      setLoadError(null);

      const userNotesPromise = fetchUserNotes({ userId: user.id });
      const classFeedPromise =
        profile?.schoolId && profile?.classId && profile?.sectionId
          ? fetchRecentNotes({
              schoolId: profile.schoolId,
              classId: profile.classId,
              sectionId: profile.sectionId,
            })
          : Promise.resolve([]);

      const [userNotes, classFeedNotes] = await Promise.all([userNotesPromise, classFeedPromise]);

      setMyUploads(userNotes);
      setClassFeedCount(classFeedNotes.length);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load your profile archive right now.';
      setLoadError(message);
    }
  }

  useEffect(() => {
    if (isFocused) {
      void loadProfileScreenData();
    }
  }, [isFocused, profile?.classId, profile?.schoolId, profile?.sectionId, user?.id]);

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await refreshProfile();
      await loadProfileScreenData();
    } finally {
      setIsRefreshing(false);
    }
  }

  function openEditProfile() {
    setSaveError(null);
    setFullName(displayName);
    setSelectedSchoolId(resolvedSchoolSlug);
    setSelectedClass(displayClass === 'Class Pending' ? 'Class 10' : displayClass);
    setSection(normalizeSectionId(profile?.sectionId ?? ''));
    setSectionTouched(false);
    setIsEditVisible(true);
  }

  function closeEditProfile() {
    if (isSavingProfile) {
      return;
    }

    setIsEditVisible(false);
    setSaveError(null);
    setSectionTouched(false);
  }

  function openNoteManager(note: RecentNote) {
    if (!user?.id || note.userId !== user.id) {
      return;
    }

    setSelectedNote(note);
    setNoteTitle(note.title);
    setSelectedSubject(note.subject || 'Science');
    setNoteError(null);
    setIsNoteManagerVisible(true);
  }

  function closeNoteManager() {
    if (isSavingNote || isDeletingNote) {
      return;
    }

    setIsNoteManagerVisible(false);
    setSelectedNote(null);
    setNoteTitle('');
    setSelectedSubject(subjectOptions[0]);
    setNoteError(null);
  }

  async function handleSaveProfile() {
    setSectionTouched(true);

    if (profileEditLimitReached) {
      setSaveError('You have reached the maximum profile edit limit.');
      return;
    }

    if (!canSaveProfile) {
      return;
    }

    try {
      setIsSavingProfile(true);
      setSaveError(null);

      await completeProfile({
        fullName,
        schoolId: selectedSchoolId ?? '',
        classLabel: selectedClass,
        sectionId: normalizeSectionId(section),
      });

      setIsEditVisible(false);
      await loadProfileScreenData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save your profile changes right now.';
      setSaveError(message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out right now.';
      Alert.alert('Sign out failed', message);
    }
  }

  async function handleShareZenmo() {
    try {
      if (Platform.OS === 'web') {
        const result = await shareUrlOrCopy({
          title: 'Zenmo',
          text: ZENMO_SHARE_MESSAGE,
          url: ZENMO_SHARE_LINK,
        });

        if (result === 'copied') {
          Alert.alert('Zenmo link copied.');
        }
        return;
      }

      await Share.share({
        message: `${ZENMO_SHARE_MESSAGE}\n${ZENMO_SHARE_LINK}`,
        url: ZENMO_SHARE_LINK,
      });
    } catch (error) {
      console.error('[ProfileScreen] share Zenmo failed', error);
      Alert.alert('Unable to share', 'Zenmo could not open sharing right now. Please try again.');
    }
  }

  async function handleSaveNoteChanges() {
    if (!selectedNote || !user?.id || !canSaveNote) {
      return;
    }

    if (selectedNote.userId !== user.id) {
      setNoteError('You can only manage notes you uploaded.');
      return;
    }

    try {
      setIsSavingNote(true);
      setNoteError(null);

      const updatedNote = await updateOwnedNote({
        noteId: selectedNote.id,
        userId: user.id,
        title: noteTitle,
        subject: selectedSubject,
      });

      setMyUploads((current) => current.map((note) => (note.id === updatedNote.id ? updatedNote : note)));
      setSelectedNote(updatedNote);
      setIsNoteManagerVisible(false);
      Alert.alert('Note updated', 'Your note details were saved successfully.');
      await loadProfileScreenData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update this note right now.';
      setNoteError(message);
    } finally {
      setIsSavingNote(false);
    }
  }

  function handleDeleteNote() {
    if (!selectedNote || !user?.id) {
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const shouldDelete = window.confirm(
        'Delete note?\n\nThis will remove the note from your archive. Continue?'
      );

      if (shouldDelete) {
        void confirmDeleteNote();
      }

      return;
    }

    Alert.alert('Delete note', 'This will remove the note from your archive. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void confirmDeleteNote();
        },
      },
    ]);
  }

  async function confirmDeleteNote() {
    if (!selectedNote || !user?.id) {
      return;
    }

    if (selectedNote.userId !== user.id) {
      setNoteError('You can only delete notes you uploaded.');
      return;
    }

    try {
      setIsDeletingNote(true);
      setNoteError(null);

      const deletedNoteId = selectedNote.id;

      await deleteOwnedNote({
        noteId: selectedNote.id,
        userId: user.id,
        storagePath: selectedNote.storagePath,
      });

      setMyUploads((current) => current.filter((note) => note.id !== deletedNoteId));
      setSelectedNote(null);
      setIsNoteManagerVisible(false);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Your note was removed successfully.');
      } else {
        Alert.alert('Note deleted', 'Your note was removed successfully.');
      }
      await loadProfileScreenData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete this note right now.';
      setNoteError(message);
    } finally {
      setIsDeletingNote(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowOrange} />
      <View pointerEvents="none" style={styles.cosmicGlowCyan} />
      <View pointerEvents="none" style={styles.orbitLine} />
      <View pointerEvents="none" style={styles.starOne} />
      <View pointerEvents="none" style={styles.starTwo} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.frame}>
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['rgba(21, 8, 38, 0.96)', 'rgba(4, 3, 12, 0.98)', 'rgba(31, 12, 8, 0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCardGradient}
            >
              <View pointerEvents="none" style={styles.profileOrbit} />
              <View pointerEvents="none" style={styles.profileSparkle} />
              <View pointerEvents="none" style={styles.profileTinyStar} />

              <View style={styles.profileHeaderRow}>
                <LinearGradient
                  colors={['rgba(185, 92, 255, 0.42)', 'rgba(255, 138, 26, 0.18)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarBlock}
                >
                  <Text style={styles.avatarText}>{initials}</Text>
                  <View style={styles.avatarSignal} />
                </LinearGradient>

                <View style={styles.profileCopy}>
                  <Text style={styles.name}>{displayName}</Text>
                  <Text numberOfLines={1} style={styles.schoolLine}>
                    {displaySchool}
                  </Text>

                  <View style={styles.metaRow}>
                    <Ionicons name="school-outline" size={17} color="#B65CFF" />
                    <Text style={styles.metaLine}>
                      {displayClass} / Section {displaySection}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="at-outline" size={17} color="#C65BFF" />
                    <Text numberOfLines={1} style={styles.metaLine}>
                      @{profile?.username || 'zenmo-student'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="key-outline" size={17} color="#B65CFF" />
                    <Text numberOfLines={1} style={styles.metaLine}>
                      Code: <Text style={styles.codeText}>{profile?.userCode || 'Generating...'}</Text>
                    </Text>
                  </View>
                </View>

                <View pointerEvents="none" style={styles.profileShield}>
                  <Ionicons name="person-outline" size={36} color="rgba(194, 101, 255, 0.9)" />
                </View>
              </View>

              <View style={styles.badgeRow}>
                <LinearGradient
                  colors={['#FF8A1A', '#FFB54A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.badge}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#1A0E08" />
                  <Text style={styles.badgeText}>Verified Student</Text>
                </LinearGradient>
                <View style={[styles.badge, styles.badgeMuted]}>
                  <Ionicons name="people-outline" size={16} color="rgba(247, 240, 232, 0.82)" />
                  <Text style={styles.badgeMutedText}>Class Member</Text>
                </View>
              </View>

              <View style={styles.manageRow}>
                <Pressable
                  onPress={openEditProfile}
                  style={({ pressed }) => [styles.manageButton, pressed && styles.pressedCard]}
                >
                  <Ionicons name="pencil-outline" size={18} color="#B65CFF" />
                  <Text style={styles.manageButtonText}>Edit Profile</Text>
                </Pressable>

                <Pressable
                  onPress={() => navigation.navigate('Messages', { screen: 'ChatList' })}
                  style={({ pressed }) => [styles.manageButton, pressed && styles.pressedCard]}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#B65CFF" />
                  <Text style={styles.manageButtonText}>Messages</Text>
                </Pressable>
              </View>
              {profile?.isAdmin ? (
                <Pressable
                  onPress={() => navigation.navigate('AdminReports')}
                  style={({ pressed }) => [
                    styles.manageButton,
                    styles.adminReportsButton,
                    pressed && styles.pressedCard,
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color="#FF8A1F" />
                  <Text style={styles.manageButtonText}>Reports</Text>
                </Pressable>
              ) : null}
            </LinearGradient>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(51, 18, 76, 0.76)', 'rgba(15, 8, 20, 0.96)']}
                style={styles.statGradient}
              >
                <View style={styles.statIcon}>
                  <Ionicons name="cloud-upload-outline" size={25} color="#B65CFF" />
                </View>
                <Text style={styles.statValue}>{notesUploaded}</Text>
                <Text style={styles.statLabel}>Notes Uploaded</Text>
              </LinearGradient>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(77, 23, 57, 0.66)', 'rgba(15, 8, 20, 0.96)']}
                style={styles.statGradient}
              >
                <View style={styles.statIcon}>
                  <Ionicons name="people-outline" size={24} color="#D06AC9" />
                </View>
                <Text style={styles.statValue}>{subjectsShared}</Text>
                <Text style={styles.statLabel}>Subjects Shared</Text>
              </LinearGradient>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(72, 25, 30, 0.68)', 'rgba(15, 8, 20, 0.96)']}
                style={styles.statGradient}
              >
                <View style={styles.statIcon}>
                  <Ionicons name="document-text-outline" size={24} color="#D06AC9" />
                </View>
                <Text style={styles.statValue}>{classFeedCount}</Text>
                <Text style={styles.statLabel}>Class Feed Notes</Text>
              </LinearGradient>
            </View>
          </View>

          <View style={styles.inviteCard}>
            <LinearGradient
              colors={['rgba(0, 42, 51, 0.92)', 'rgba(5, 12, 19, 0.98)', 'rgba(13, 22, 18, 0.94)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.inviteGradient}
            >
              <View style={styles.inviteIcon}>
                <Ionicons name="people" size={28} color="#16E5E8" />
              </View>

              <View style={styles.inviteCopy}>
                <Text style={styles.inviteEyebrow}>Community Boost</Text>
                <Text style={styles.inviteTitle}>Invite classmates. Build your class archive.</Text>
                <Text style={styles.inviteText}>
                  Bring more verified students into Zenmo and grow a stronger shared note bank for
                  your school and class.
                </Text>
              </View>

              <View pointerEvents="none" style={styles.rocketSketch}>
                <Ionicons name="rocket-outline" size={58} color="rgba(22, 229, 232, 0.24)" />
              </View>

              <Pressable
                onPress={() => void handleShareZenmo()}
                style={({ pressed }) => [styles.inviteButton, pressed && styles.pressedCard]}
              >
                <LinearGradient
                  colors={['#FFB54A', '#FF8A1A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.inviteButtonGradient}
                >
                  <Ionicons name="arrow-redo" size={18} color="#140A05" />
                  <Text style={styles.inviteButtonText}>Share Zenmo</Text>
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Archive</Text>
              <Text style={styles.sectionAction}>Manage</Text>
            </View>

            {loadError ? (
              <View style={[styles.feedbackCard, styles.feedbackCardDirect]}>
                <Text style={styles.feedbackTitle}>Archive unavailable</Text>
                <Text style={styles.feedbackText}>{loadError}</Text>
              </View>
            ) : myUploads.length > 0 ? (
              <View style={styles.archiveList}>
                {myUploads.map((note) => (
                  <Pressable
                    key={note.id}
                    onPress={() => openNoteManager(note)}
                    style={styles.archiveRow}
                  >
                    <View style={[styles.archiveThumb, { borderColor: note.accentColor }]}>
                      <Text style={styles.archiveThumbText}>
                        {note.fileType === 'pdf' ? 'PDF' : 'IMG'}
                      </Text>
                    </View>

                    <View style={styles.archiveInfo}>
                      <Text numberOfLines={1} style={styles.archiveTitle}>
                        {note.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.archiveMeta}>
                        {note.subject} / {formatArchiveDate(note.uploadedAt)}
                      </Text>
                    </View>

                    <View style={styles.archiveTypePill}>
                      <Text style={styles.archiveTypePillText}>{formatFileTypeLabel(note.fileType)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.feedbackCard}>
                <LinearGradient
                  colors={['rgba(25, 10, 45, 0.86)', 'rgba(7, 5, 14, 0.98)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.feedbackGradient}
                >
                  <View style={styles.emptyArchiveIcon}>
                    <Ionicons name="folder-open-outline" size={30} color="#B65CFF" />
                  </View>
                  <View style={styles.feedbackCopy}>
                    <Text style={styles.feedbackTitle}>No uploads yet</Text>
                    <Text style={styles.feedbackText}>
                      Notes you upload to your class archive will appear here.
                    </Text>
                  </View>
                  <Ionicons
                    name="cube-outline"
                    size={66}
                    color="rgba(182, 92, 255, 0.18)"
                    style={styles.emptyArchiveCube}
                  />
                </LinearGradient>
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="information-outline" size={27} color="#FF8A1A" />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Profile routing</Text>
              <Text style={styles.infoText}>
                Your school, class, and section settings keep your note feed aligned with the
                right classmates. You can update these details any time.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(247, 240, 232, 0.45)" />
          </View>

          <Pressable
            onPress={() => {
              if (typeof window === 'undefined') return;
              void (async () => {
                try {
                  const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
                  if (!VAPID_PUBLIC_KEY) {
                    alert("Missing VAPID Key!");
                    return;
                  }
                  if (!('serviceWorker' in navigator)) {
                    alert("No serviceWorker"); return;
                  }
                  const permission = await window.Notification.requestPermission();
                  if (permission !== 'granted') {
                    alert("Permission: " + permission); return;
                  }
                  const registration = await navigator.serviceWorker.ready;
                  let subscription = await registration.pushManager.getSubscription();
                  if (!subscription) {
                    const padding = '='.repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
                    const base64 = (VAPID_PUBLIC_KEY + padding).replace(/\-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const outputArray = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) {
                      outputArray[i] = rawData.charCodeAt(i);
                    }
                    subscription = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: outputArray
                    });
                  }
                  const subJson = subscription.toJSON();
                  const { supabase } = await import('../lib/supabase');
                  const { error: insertError } = await supabase.from('push_subscriptions').insert({
                    user_id: user?.id,
                    subscription: subJson,
                  });
                  if (insertError) {
                    alert("Insert Error: " + JSON.stringify(insertError)); return;
                  }
                  alert("Success! Token saved manually.");
                } catch (e) {
                  alert("Catch: " + (e instanceof Error ? e.message : String(e)));
                }
              })();
            }}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressedCard, { marginBottom: 12, backgroundColor: 'rgba(182, 92, 255, 0.1)' }]}
          >
            <Ionicons name="bug-outline" size={21} color="#B65CFF" />
            <Text style={styles.logoutButtonText}>Debug: Force Push Token</Text>
          </Pressable>

          <Pressable
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressedCard]}
          >
            <Ionicons name="log-out-outline" size={21} color="#FF5C45" />
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isEditVisible}
        onRequestClose={closeEditProfile}
      >
        <SafeAreaView
          edges={[]}
          style={[
            styles.modalBackdrop,
            styles.editModalBackdrop,
            {
              paddingTop: Math.max(insets.top + 12, 40),
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View pointerEvents="none" style={styles.editModalGlowPurple} />
          <View pointerEvents="none" style={styles.editModalGlowOrange} />

          <View style={styles.editModalCard}>
            <LinearGradient
              colors={['rgba(18, 8, 35, 0.98)', 'rgba(3, 2, 10, 0.99)', 'rgba(30, 10, 7, 0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.editModalGradient}
            >
              <View pointerEvents="none" style={styles.editModalOrbit} />
              <View style={styles.editModalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Text style={styles.modalSubtitle}>Update your student identity and class scope.</Text>
              </View>

              <Pressable onPress={closeEditProfile} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.editModalScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.editModalContent,
                { paddingBottom: 18 },
              ]}
            >
            <LinearGradient
              colors={
                profileEditLimitReached
                  ? ['rgba(255, 92, 69, 0.14)', 'rgba(50, 12, 8, 0.72)']
                  : ['rgba(255, 138, 26, 0.18)', 'rgba(43, 24, 6, 0.74)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.editLimitCard,
                profileEditLimitReached && styles.editLimitCardBlocked,
              ]}
            >
              <View style={styles.editLimitIcon}>
                <Ionicons
                  name={profileEditLimitReached ? 'lock-closed-outline' : 'timer-outline'}
                  size={19}
                  color={profileEditLimitReached ? '#FFB083' : '#FFB54A'}
                />
              </View>
              <View style={styles.editLimitCopy}>
                <Text
                  style={[
                    styles.editLimitTitle,
                    profileEditLimitReached && styles.editLimitTitleBlocked,
                  ]}
                >
                  {editLimitLabel}
                </Text>
                {profileEditLimitReached ? (
                  <Text style={styles.editLimitText}>
                    You have reached the maximum profile edit limit.
                  </Text>
                ) : (
                  <Text style={styles.editLimitText}>
                    Each successful save uses one profile edit.
                  </Text>
                )}
              </View>
            </LinearGradient>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                editable={!profileEditLimitReached}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Alex Rivera"
                placeholderTextColor={colors.muted}
                style={[styles.input, profileEditLimitReached && styles.inputDisabled]}
                selectionColor={colors.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <SchoolSelector
                disabled={profileEditLimitReached}
                label="School Name"
                selectedSchoolSlug={selectedSchoolId}
                onSelect={(school) => setSelectedSchoolId(school?.slug ?? null)}
                placeholder="Search your school..."
                userId={user?.id}
                fallbackText={profile?.schoolId ? displaySchool : undefined}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Class</Text>
              <View style={styles.classGrid}>
                {classOptions.map((item) => {
                  const isSelected = selectedClass === item;

                  return (
                    <Pressable
                      key={item}
                      disabled={profileEditLimitReached}
                      onPress={() => setSelectedClass(item)}
                      style={({ pressed }) => [
                        styles.classOption,
                        isSelected && styles.classOptionActive,
                        profileEditLimitReached && !isSelected && styles.classOptionDisabled,
                        pressed && !profileEditLimitReached && styles.pressedCard,
                      ]}
                    >
                      {isSelected ? (
                        <LinearGradient
                          colors={['#FF7A1A', '#FFB54A']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.classOptionGradient}
                        >
                          <Text style={[styles.classOptionText, styles.classOptionTextActive]}>
                            {item}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <Text style={styles.classOptionText}>{item}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Section</Text>
              <TextInput
                editable={!profileEditLimitReached}
                value={section}
                onChangeText={(value) => {
                  setSectionTouched(true);
                  setSection(normalizeSectionId(value));
                }}
                placeholder="e.g. A"
                placeholderTextColor={colors.muted}
                style={[styles.input, profileEditLimitReached && styles.inputDisabled]}
                selectionColor={colors.primary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {showSectionError ? (
                <Text style={styles.errorText}>Section must be a single letter (A-Z)</Text>
              ) : null}
            </View>

            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            </ScrollView>

            <Pressable
              disabled={!canSaveProfile}
              onPress={() => void handleSaveProfile()}
              style={({ pressed }) => [
                styles.editSaveButton,
                !canSaveProfile && styles.saveButtonDisabled,
                pressed && canSaveProfile && styles.pressedCard,
              ]}
            >
              <LinearGradient
                colors={canSaveProfile ? ['#FF7A1A', '#FFB54A'] : ['#4B403A', '#5B5049']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButtonGradient}
              >
                {isSavingProfile ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.background} />
                    <Text style={styles.saveButtonText}>Saving...</Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.saveButtonText,
                      !canSaveProfile && styles.saveButtonTextDisabled,
                    ]}
                  >
                    Save Changes
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
            </LinearGradient>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isNoteManagerVisible}
        onRequestClose={closeNoteManager}
      >
        <SafeAreaView
          edges={[]}
          style={[
            styles.noteModalBackdrop,
            {
              paddingTop: Math.max(insets.top + 16, 48),
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View pointerEvents="none" style={styles.noteModalGlowPurple} />
          <View pointerEvents="none" style={styles.noteModalGlowOrange} />

          <View style={styles.noteModalFrame}>
            <LinearGradient
              colors={['rgba(21, 9, 39, 0.98)', 'rgba(3, 2, 10, 0.99)', 'rgba(35, 10, 6, 0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.noteModalSurface}
            >
              <View pointerEvents="none" style={styles.noteModalOrbit} />
              <View pointerEvents="none" style={styles.noteModalSpark} />
              <View style={styles.noteModalHandle} />

              <ScrollView
                contentContainerStyle={[
                  styles.noteModalContent,
                  { paddingBottom: 24 + Math.max(insets.bottom, 8) },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.noteModalHeader}>
                  <View style={styles.noteModalHeaderCopy}>
                    <Text style={styles.noteModalEyebrow}>Archive control</Text>
                    <Text style={styles.noteModalTitle}>Manage Note</Text>
                    <View style={styles.noteModalTitleUnderline} />
                    <Text style={styles.noteModalSubtitle}>
                      Update note details or remove this note from your archive.
                    </Text>
                  </View>

                  <Pressable onPress={closeNoteManager} style={styles.noteModalCloseButton}>
                    <Ionicons name="close" size={18} color={colors.text} />
                  </Pressable>
                </View>

                <View style={styles.noteInputGroup}>
                  <Text style={styles.noteInputLabel}>Note Title</Text>
                  <TextInput
                    value={noteTitle}
                    onChangeText={setNoteTitle}
                    placeholder="Enter a note title"
                    placeholderTextColor="rgba(247, 240, 232, 0.42)"
                    style={styles.noteInput}
                    selectionColor="#FF8A1A"
                  />
                </View>

                <View style={styles.noteInputGroup}>
                  <Text style={styles.noteInputLabel}>Subject</Text>
                  <View style={styles.noteSubjectGrid}>
                    {subjectOptions.map((item) => {
                      const isSelected = selectedSubject === item;

                      return (
                        <Pressable
                          key={item}
                          onPress={() => setSelectedSubject(item)}
                          style={({ pressed }) => [
                            styles.noteSubjectOption,
                            isSelected && styles.noteSubjectOptionActive,
                            pressed && styles.noteSubjectOptionPressed,
                          ]}
                        >
                          {isSelected ? (
                            <LinearGradient
                              colors={['rgba(255, 122, 26, 0.88)', 'rgba(255, 181, 74, 0.48)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.noteSubjectGradient}
                            >
                              <Text style={[styles.noteSubjectText, styles.noteSubjectTextActive]}>
                                {item}
                              </Text>
                            </LinearGradient>
                          ) : (
                            <Text style={styles.noteSubjectText}>{item}</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {noteError ? (
                  <View style={styles.noteErrorCard}>
                    <Ionicons name="alert-circle-outline" size={16} color="#FFB083" />
                    <Text style={styles.noteErrorText}>{noteError}</Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={!canSaveNote}
                  onPress={() => void handleSaveNoteChanges()}
                  style={({ pressed }) => [
                    styles.noteSaveButton,
                    !canSaveNote && styles.noteButtonDisabled,
                    pressed && canSaveNote && styles.noteButtonPressed,
                  ]}
                >
                  <LinearGradient
                    colors={canSaveNote ? ['#FF7A1A', '#FFB84D'] : ['#4B403A', '#5B5049']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.noteSaveGradient}
                  >
                    {isSavingNote ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color="#160A04" />
                        <Text style={styles.noteSaveButtonText}>Saving...</Text>
                      </View>
                    ) : (
                      <View style={styles.loadingRow}>
                        <Ionicons name="checkmark-circle-outline" size={17} color="#160A04" />
                        <Text style={styles.noteSaveButtonText}>SAVE NOTE</Text>
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  disabled={isSavingNote || isDeletingNote}
                  onPress={handleDeleteNote}
                  style={({ pressed }) => [
                    styles.noteDeleteButton,
                    (isSavingNote || isDeletingNote) && styles.noteButtonDisabled,
                    pressed && !isSavingNote && !isDeletingNote && styles.noteButtonPressed,
                  ]}
                >
                  {isDeletingNote ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#FFB083" />
                      <Text style={styles.noteDeleteButtonText}>Deleting...</Text>
                    </View>
                  ) : (
                    <View style={styles.loadingRow}>
                      <Ionicons name="trash-outline" size={17} color="#FF8A66" />
                      <Text style={styles.noteDeleteButtonText}>DELETE NOTE</Text>
                    </View>
                  )}
                </Pressable>
              </ScrollView>
            </LinearGradient>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020106',
    overflow: 'hidden',
  },
  cosmicGlowPurple: {
    position: 'absolute',
    top: 72,
    left: -118,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(151, 71, 255, 0.18)',
  },
  cosmicGlowOrange: {
    position: 'absolute',
    top: 148,
    right: -132,
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: 'rgba(255, 138, 26, 0.15)',
  },
  cosmicGlowCyan: {
    position: 'absolute',
    top: 520,
    left: -154,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(22, 229, 232, 0.1)',
  },
  orbitLine: {
    position: 'absolute',
    top: 132,
    right: -58,
    width: 280,
    height: 96,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.34)',
    borderRadius: 140,
    transform: [{ rotate: '-19deg' }],
  },
  starOne: {
    position: 'absolute',
    top: 94,
    right: 62,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B65CFF',
    shadowColor: '#B65CFF',
    shadowOpacity: 0.75,
    shadowRadius: 10,
  },
  starTwo: {
    position: 'absolute',
    top: 355,
    left: 38,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF8A1A',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.75,
    shadowRadius: 8,
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  frame: {
    backgroundColor: 'transparent',
    gap: 18,
  },
  profileCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.72)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 8,
  },
  profileCardGradient: {
    padding: 18,
    gap: 18,
    overflow: 'hidden',
  },
  profileOrbit: {
    position: 'absolute',
    right: -36,
    top: 70,
    width: 170,
    height: 68,
    borderWidth: 2,
    borderColor: 'rgba(255, 138, 26, 0.62)',
    borderLeftColor: 'rgba(151, 71, 255, 0.9)',
    borderBottomColor: 'rgba(151, 71, 255, 0.34)',
    borderRadius: 90,
    transform: [{ rotate: '-15deg' }],
  },
  profileSparkle: {
    position: 'absolute',
    right: 48,
    top: 48,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#C65BFF',
    shadowColor: '#C65BFF',
    shadowOpacity: 0.8,
    shadowRadius: 13,
  },
  profileTinyStar: {
    position: 'absolute',
    right: 31,
    top: 72,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF8A1A',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.8,
    shadowRadius: 9,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  avatarBlock: {
    width: 82,
    height: 82,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#B65CFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B65CFF',
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  avatarText: {
    color: '#C992FF',
    fontFamily: typography.fontFamily.display,
    fontSize: 38,
    lineHeight: 42,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(185, 92, 255, 0.72)',
    textShadowRadius: 16,
  },
  avatarSignal: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF8A1A',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.8,
    shadowRadius: 9,
  },
  profileCopy: {
    flex: 1,
    gap: 7,
    paddingTop: 2,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    lineHeight: 32,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.16)',
    textShadowRadius: 8,
  },
  schoolLine: {
    color: 'rgba(247, 240, 232, 0.72)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  metaLine: {
    flex: 1,
    color: 'rgba(247, 240, 232, 0.8)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: 19,
  },
  codeText: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyMedium,
  },
  profileShield: {
    position: 'absolute',
    right: 4,
    top: 48,
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(182, 92, 255, 0.34)',
    backgroundColor: 'rgba(47, 16, 82, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.78,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 2,
  },
  badge: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.78)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.32,
    shadowRadius: 14,
  },
  badgeMuted: {
    borderColor: 'rgba(247, 240, 232, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    shadowOpacity: 0,
  },
  badgeText: {
    color: '#20120B',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badgeMutedText: {
    color: 'rgba(247, 240, 232, 0.86)',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  manageButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 120, 0.78)',
    backgroundColor: 'rgba(3, 2, 9, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#B65CFF',
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  manageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  adminReportsButton: {
    marginTop: 12,
    borderColor: 'rgba(255, 138, 31, 0.68)',
  },
  manageButtonText: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 120, 0.42)',
    shadowColor: '#B65CFF',
    shadowOpacity: 0.13,
    shadowRadius: 12,
  },
  statGradient: {
    minHeight: 116,
    paddingVertical: 13,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(182, 92, 255, 0.68)',
    backgroundColor: 'rgba(182, 92, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    lineHeight: 27,
  },
  statLabel: {
    color: 'rgba(247, 240, 232, 0.68)',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 8,
    lineHeight: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  inviteCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(22, 229, 232, 0.82)',
    shadowColor: '#16E5E8',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  inviteGradient: {
    minHeight: 176,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  inviteIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(22, 229, 232, 0.78)',
    backgroundColor: 'rgba(22, 229, 232, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16E5E8',
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  inviteCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
    paddingBottom: 50,
  },
  inviteEyebrow: {
    color: '#16E5E8',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  inviteTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 19,
    lineHeight: 23,
    textTransform: 'uppercase',
  },
  inviteText: {
    color: 'rgba(247, 240, 232, 0.72)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  rocketSketch: {
    position: 'absolute',
    right: 18,
    top: 18,
    transform: [{ rotate: '19deg' }],
    opacity: 0.8,
  },
  inviteButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 9,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.36,
    shadowRadius: 15,
  },
  inviteButtonGradient: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.8)',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inviteButtonText: {
    color: '#1C110A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 25,
    lineHeight: 30,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.15)',
    textShadowRadius: 8,
  },
  sectionAction: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  archiveList: {
    gap: 10,
  },
  archiveRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(182, 92, 255, 0.45)',
    backgroundColor: 'rgba(10, 7, 18, 0.92)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#B65CFF',
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  archiveThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(32, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveThumbText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  archiveInfo: {
    flex: 1,
    gap: 3,
  },
  archiveTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
  },
  archiveMeta: {
    color: 'rgba(247, 240, 232, 0.6)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 11,
    lineHeight: 15,
  },
  archiveTypePill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.5)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  archiveTypePillText: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  feedbackCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(182, 92, 255, 0.58)',
    backgroundColor: 'rgba(12, 8, 22, 0.92)',
    padding: 0,
    gap: 6,
    shadowColor: '#B65CFF',
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  feedbackCardDirect: {
    padding: 16,
  },
  feedbackGradient: {
    minHeight: 126,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  feedbackCopy: {
    flex: 1,
    gap: 5,
  },
  emptyArchiveIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(182, 92, 255, 0.76)',
    backgroundColor: 'rgba(182, 92, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B65CFF',
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  emptyArchiveCube: {
    position: 'absolute',
    right: 16,
    bottom: 12,
  },
  feedbackTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: 25,
    textTransform: 'uppercase',
  },
  feedbackText: {
    color: 'rgba(247, 240, 232, 0.72)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.62)',
    backgroundColor: 'rgba(18, 10, 7, 0.78)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FF8A1A',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    color: '#F5BC66',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  infoCopy: {
    flex: 1,
    gap: 5,
  },
  infoTitle: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoText: {
    color: 'rgba(247, 240, 232, 0.72)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  logoutButton: {
    minHeight: 54,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 69, 0.76)',
    backgroundColor: 'rgba(31, 8, 7, 0.7)',
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5C45',
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  logoutButtonText: {
    color: '#FF5C45',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  pressedCard: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  noteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 48,
    paddingBottom: 8,
  },
  noteModalGlowPurple: {
    position: 'absolute',
    left: -96,
    bottom: 120,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(151, 71, 255, 0.2)',
  },
  noteModalGlowOrange: {
    position: 'absolute',
    right: -118,
    bottom: 28,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 122, 26, 0.16)',
  },
  noteModalFrame: {
    maxHeight: '90%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.72)',
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  noteModalSurface: {
    maxHeight: '100%',
  },
  noteModalOrbit: {
    position: 'absolute',
    top: 46,
    right: -66,
    width: 240,
    height: 82,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.28)',
    borderRadius: 120,
    transform: [{ rotate: '-17deg' }],
  },
  noteModalSpark: {
    position: 'absolute',
    top: 22,
    right: 56,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#B95CFF',
    shadowColor: '#B95CFF',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  noteModalHandle: {
    alignSelf: 'center',
    width: 64,
    height: 5,
    borderRadius: 999,
    marginTop: 10,
    backgroundColor: 'rgba(247, 240, 232, 0.24)',
  },
  noteModalContent: {
    padding: 18,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 16,
  },
  noteModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  noteModalHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  noteModalEyebrow: {
    color: '#78C7FF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  noteModalTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 26,
    lineHeight: 30,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 138, 26, 0.26)',
    textShadowRadius: 12,
  },
  noteModalTitleUnderline: {
    width: 84,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#FF8A1A',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  noteModalSubtitle: {
    color: 'rgba(247, 240, 232, 0.66)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  noteModalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(185, 92, 255, 0.58)',
    backgroundColor: 'rgba(11, 6, 22, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B95CFF',
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  noteInputGroup: {
    gap: 9,
  },
  noteInputLabel: {
    color: 'rgba(247, 240, 232, 0.9)',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  noteInput: {
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(185, 92, 255, 0.5)',
    backgroundColor: 'rgba(5, 4, 13, 0.84)',
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 15,
    paddingHorizontal: 14,
    shadowColor: '#B95CFF',
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  noteSubjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  noteSubjectOption: {
    minHeight: 39,
    minWidth: 74,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(185, 92, 255, 0.42)',
    backgroundColor: 'rgba(9, 7, 18, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  noteSubjectOptionActive: {
    borderColor: 'rgba(255, 181, 74, 0.96)',
    paddingHorizontal: 0,
    paddingVertical: 0,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 4,
  },
  noteSubjectOptionPressed: {
    transform: [{ scale: 0.97 }],
  },
  noteSubjectGradient: {
    minHeight: 39,
    minWidth: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSubjectText: {
    color: 'rgba(247, 240, 232, 0.66)',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  noteSubjectTextActive: {
    color: '#160A04',
  },
  noteErrorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 26, 0.36)',
    backgroundColor: 'rgba(91, 32, 13, 0.24)',
    padding: 12,
  },
  noteErrorText: {
    flex: 1,
    color: '#FFB287',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  noteSaveButton: {
    minHeight: 54,
    borderRadius: 13,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.42,
    shadowRadius: 15,
    elevation: 6,
  },
  noteSaveGradient: {
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 216, 126, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  noteDeleteButton: {
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 80, 64, 0.64)',
    backgroundColor: 'rgba(47, 10, 9, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#FF4D3D',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  noteButtonDisabled: {
    opacity: 0.62,
  },
  noteButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  noteSaveButtonText: {
    color: '#160A04',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noteDeleteButtonText: {
    color: '#FF8A66',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  editModalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 10,
    paddingTop: 24,
    paddingBottom: 0,
  },
  editModalGlowPurple: {
    position: 'absolute',
    left: -120,
    bottom: 220,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(151, 71, 255, 0.22)',
  },
  editModalGlowOrange: {
    position: 'absolute',
    right: -130,
    bottom: 80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 138, 26, 0.16)',
  },
  editModalCard: {
    width: '100%',
    maxHeight: '96%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.72)',
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 12,
  },
  editModalGradient: {
    maxHeight: '100%',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    overflow: 'hidden',
  },
  editModalOrbit: {
    position: 'absolute',
    right: -64,
    top: 62,
    width: 230,
    height: 76,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.26)',
    borderRadius: 120,
    transform: [{ rotate: '-18deg' }],
  },
  editModalHandle: {
    alignSelf: 'center',
    width: 68,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(247, 240, 232, 0.28)',
  },
  editModalContent: {
    gap: 14,
    paddingBottom: 18,
  },
  editModalScroll: {
    flexShrink: 1,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: '#5D463A',
    backgroundColor: '#0D0A09',
    padding: 14,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 5,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.16)',
    textShadowRadius: 8,
  },
  modalSubtitle: {
    color: 'rgba(247, 240, 232, 0.68)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247, 240, 232, 0.06)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  closeButtonText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  editLimitCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.72)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  editLimitCardBlocked: {
    borderColor: 'rgba(255, 92, 69, 0.66)',
    shadowColor: '#FF5C45',
  },
  editLimitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.48)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLimitCopy: {
    flex: 1,
    gap: 3,
  },
  editLimitTitle: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  editLimitTitleBlocked: {
    color: '#FFB083',
  },
  editLimitText: {
    color: '#C4B4A7',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  inputGroup: {
    gap: 9,
  },
  inputLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.42)',
    backgroundColor: 'rgba(7, 6, 14, 0.82)',
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  inputDisabled: {
    opacity: 0.62,
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classOption: {
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.2)',
    backgroundColor: 'rgba(7, 6, 14, 0.76)',
    minHeight: 38,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classOptionActive: {
    borderColor: 'rgba(255, 181, 74, 0.9)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.24,
    shadowRadius: 10,
  },
  classOptionDisabled: {
    opacity: 0.58,
  },
  classOptionGradient: {
    minHeight: 38,
    minWidth: 72,
    paddingHorizontal: 11,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classOptionText: {
    color: 'rgba(247, 240, 232, 0.68)',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  classOptionTextActive: {
    color: '#160A04',
  },
  errorText: {
    color: '#FFB287',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 11,
    lineHeight: 15,
  },
  saveButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#F0A24F',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  editSaveButton: {
    minHeight: 54,
    borderRadius: 11,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.38,
    shadowRadius: 15,
    elevation: 5,
  },
  saveButtonGradient: {
    minHeight: 54,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#1A100A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  saveButtonTextDisabled: {
    color: 'rgba(247, 240, 232, 0.52)',
  },
  deleteButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#7C2F1E',
    backgroundColor: '#1B110E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: '#FFB083',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
