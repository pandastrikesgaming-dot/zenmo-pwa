import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PdfDocumentViewer, ReportNoteModal, ZoomableImageViewer } from '../components';
import { useAuth } from '../hooks';
import { shareUrlOrCopy } from '../lib/webShare';
import {
  fetchNotePages,
  getMessageableProfileById,
  submitNoteReport,
  updateNotePageCount,
} from '../services';
import { colors, typography } from '../theme';
import type { NotePage, NoteReportReason, RecentNote, RootStackParamList } from '../types';

type NoteDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'NoteDetail'>;

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const FOCUS_ANIMATION_MS = 320;
const PDF_CHROME_IDLE_MS = 3200;

function clampScale(value: number) {
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
}

function formatFileTypeLabel(note: RecentNote) {
  if (note.fileType === 'multi_image') {
    return 'Multi image';
  }

  return note.fileType.toUpperCase();
}

function formatClassScope(note: RecentNote) {
  const rawClass = note.classId.trim();
  const rawSection = note.sectionId.trim();
  const classLabel = rawClass
    ? rawClass.toLowerCase().startsWith('class')
      ? rawClass
      : `Class ${rawClass}`
    : 'Class scope';

  return rawSection ? `${classLabel} / Section ${rawSection}` : classLabel;
}

function formatSchoolName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'School scope';
  }

  return trimmed
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function sanitizeShareFileName(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || 'zenmo-note';
}

function ReaderControl({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.readerControl,
        disabled && styles.readerControlDisabled,
        pressed && !disabled && styles.readerControlPressed,
      ]}
    >
      <Ionicons name={icon} size={24} color={disabled ? colors.muted : colors.primarySoft} />
      <Text style={[styles.readerControlText, disabled && styles.readerControlTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

export function NoteDetailScreen({ navigation, route }: NoteDetailScreenProps) {
  const { profile, user } = useAuth();
  const { note } = route.params;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isPdf = note.fileType === 'pdf';
  const isMultiImage = note.fileType === 'multi_image';
  const fileTypeLabel = formatFileTypeLabel(note);
  const viewerHeight = height;
  const viewerWidth = width;
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isChromeAutoHidden, setIsChromeAutoHidden] = useState(false);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(note.pages);
  const [pdfScale, setPdfScale] = useState(1);
  const [imageScale, setImageScale] = useState(1);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [notePages, setNotePages] = useState<NotePage[]>([]);
  const [isPagesLoading, setIsPagesLoading] = useState(isMultiImage);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [isSharingNote, setIsSharingNote] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const chromeProgress = useSharedValue(0);
  const chromeAutoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeHidden = isFocusMode || (isPdf && isChromeAutoHidden);

  useEffect(() => {
    chromeProgress.value = withTiming(chromeHidden ? 1 : 0, {
      duration: FOCUS_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [chromeHidden, chromeProgress]);

  useEffect(() => {
    if (!isPdf || isFocusMode) {
      setIsChromeAutoHidden(false);

      if (chromeAutoHideTimerRef.current) {
        clearTimeout(chromeAutoHideTimerRef.current);
        chromeAutoHideTimerRef.current = null;
      }

      return;
    }

    setIsChromeAutoHidden(false);
    scheduleChromeHide();

    return () => {
      if (chromeAutoHideTimerRef.current) {
        clearTimeout(chromeAutoHideTimerRef.current);
        chromeAutoHideTimerRef.current = null;
      }
    };
  }, [isFocusMode, isPdf, note.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadNotePages() {
      if (!isMultiImage) {
        setNotePages([]);
        setPagesError(null);
        setIsPagesLoading(false);
        return;
      }

      try {
        setIsPagesLoading(true);
        setPagesError(null);
        const data = await fetchNotePages(note.id);

        if (isMounted) {
          setNotePages(data);
          setCurrentPageIndex(0);
          setImageScale(1);
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : 'Unable to load note pages right now.';
          setPagesError(message);
        }
      } finally {
        if (isMounted) {
          setIsPagesLoading(false);
        }
      }
    }

    void loadNotePages();

    return () => {
      isMounted = false;

      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      if (chromeAutoHideTimerRef.current) {
        clearTimeout(chromeAutoHideTimerRef.current);
      }
    };
  }, [isMultiImage, note.id]);

  useEffect(() => {
    if (!isMultiImage) {
      return;
    }

    setCurrentPageIndex((current) => {
      if (notePages.length === 0) {
        return 0;
      }

      return Math.min(current, notePages.length - 1);
    });
  }, [isMultiImage, notePages.length]);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - chromeProgress.value,
    transform: [{ translateY: -96 * chromeProgress.value }],
  }));

  const sideControlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - chromeProgress.value,
    transform: [{ translateX: 108 * chromeProgress.value }],
  }));

  const bottomPanelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - chromeProgress.value,
    transform: [{ translateY: 260 * chromeProgress.value }],
  }));

  const restoreButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chromeProgress.value,
    transform: [{ scale: 0.86 + chromeProgress.value * 0.14 }],
  }));

  const activePage = notePages[currentPageIndex] ?? null;
  const totalMultiPages = notePages.length || Math.max(note.pages, 1);
  const activePageNumber = isPdf ? currentPdfPage : isMultiImage ? currentPageIndex + 1 : 1;
  const activePageCount = isPdf ? pdfPageCount : isMultiImage ? totalMultiPages : Math.max(note.pages, 1);
  const displayedPageCount = isPdf || isMultiImage ? activePageCount : Math.max(note.pages, 1);
  const canMessageUploader = Boolean(note.userId && user?.id && note.userId !== user.id);
  const uploadDate = note.date || 'Unknown date';
  const uploadedBy = note.userName || 'Unknown';
  const schoolName = formatSchoolName(note.schoolId);
  const classScope = formatClassScope(note);
  const isFirstMultiPage = currentPageIndex <= 0;
  const isLastMultiPage = currentPageIndex >= Math.max(totalMultiPages - 1, 0);

  function scheduleChromeHide() {
    if (!isPdf || isFocusMode) {
      return;
    }

    if (chromeAutoHideTimerRef.current) {
      clearTimeout(chromeAutoHideTimerRef.current);
    }

    chromeAutoHideTimerRef.current = setTimeout(() => {
      setIsChromeAutoHidden(true);
      chromeAutoHideTimerRef.current = null;
    }, PDF_CHROME_IDLE_MS);
  }

  function revealChrome() {
    if (!isPdf) {
      return;
    }

    setIsFocusMode(false);
    setIsChromeAutoHidden(false);
    scheduleChromeHide();
  }

  function enterFocusMode() {
    if (!isFocusMode) {
      setIsFocusMode(true);
    }
  }

  function toggleFocusMode() {
    setIsFocusMode((prev) => {
      const next = !prev;
      if (!next && isPdf) {
        setIsChromeAutoHidden(false);
        scheduleChromeHide();
      }
      return next;
    });
  }

  function exitFocusMode() {
    if (isFocusMode) {
      setIsFocusMode(false);
    }

    if (isPdf) {
      setIsChromeAutoHidden(false);
      scheduleChromeHide();
    }
  }

  function handleZoomIn() {
    revealChrome();

    if (isPdf) {
      setPdfScale((current) => clampScale(Number((current + 0.25).toFixed(2))));
      return;
    }

    setImageScale((current) => clampScale(Number((current + 0.35).toFixed(2))));
  }

  function handleZoomOut() {
    revealChrome();

    if (isPdf) {
      setPdfScale((current) => clampScale(Number((current - 0.25).toFixed(2))));
      return;
    }

    setImageScale((current) => clampScale(Number((current - 0.35).toFixed(2))));
  }

  function handleFitToScreen() {
    revealChrome();

    if (isPdf) {
      setPdfScale(1);
      return;
    }

    setImageScale(1);
  }

  async function handleShareNote() {
    if (isSharingNote) {
      return;
    }

    const shareUrl = isMultiImage ? activePage?.imageUrl ?? note.fileUrl : note.fileUrl;

    if (!shareUrl) {
      Alert.alert('Sharing unavailable', 'This note file is not ready to share yet.');
      return;
    }

    try {
      setIsSharingNote(true);

      if (Platform.OS === 'web') {
        const result = await shareUrlOrCopy({
          title: note.title,
          text: `Zenmo note: ${note.title}`,
          url: shareUrl,
        });

        if (result === 'copied') {
          Alert.alert('Note link copied.');
        }

        return;
      }

      await shareUrlOrCopy({
        title: note.title,
        text: `Zenmo note: ${note.title}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('[NoteDetailScreen] share note failed', error);
      Alert.alert('Unable to share', 'Zenmo could not prepare this note for sharing. Please try again.');
    } finally {
      setIsSharingNote(false);
    }
  }

  function handleOpenReport() {
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

    setIsReportModalVisible(true);
  }

  async function handleSubmitReport(reason: NoteReportReason, details?: string) {
    if (!user?.id) {
      return;
    }

    setIsSubmittingReport(true);

    try {
      await submitNoteReport({
        noteId: note.id,
        reporterId: user.id,
        reportedUserId: note.userId,
        reason,
        details,
      });
      setIsReportModalVisible(false);
      Alert.alert('Report submitted', "Report submitted. We'll review it.");
    } catch (error) {
      Alert.alert('Unable to submit report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  }

  function setViewerPage(nextIndex: number) {
    if (isPageTransitioning || nextIndex === currentPageIndex) {
      return;
    }

    setIsPageTransitioning(true);
    setCurrentPageIndex(nextIndex);
    setImageScale(1);

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = setTimeout(() => {
      setIsPageTransitioning(false);
      transitionTimerRef.current = null;
    }, 180);
  }

  async function handleMessageUploader() {
    if (!note.userId || !user?.id || note.userId === user.id) {
      return;
    }

    try {
      const targetUser = await getMessageableProfileById(note.userId);

      if (!targetUser) {
        Alert.alert('Messaging unavailable', 'This uploader cannot be reached from your current scope.');
        return;
      }

      navigation.navigate('Messages', {
        screen: 'Chat',
        params: {
          targetUser,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to open a direct message right now.';
      Alert.alert('Messaging unavailable', message);
    }
  }

  function renderDocumentViewer() {
    if (isPdf) {
      if (!note.fileUrl) {
        return (
          <Pressable onPress={enterFocusMode} style={styles.readerState}>
            <Text style={styles.readerStateTitle}>PDF unavailable</Text>
            <Text style={styles.readerStateText}>This PDF does not have a valid file URL.</Text>
          </Pressable>
        );
      }

      return (
        <PdfDocumentViewer
          accentColor={note.accentColor}
          currentPage={currentPdfPage}
          fileUrl={note.fileUrl}
          height={viewerHeight}
          onError={setPdfError}
          onLoadComplete={(pageCount) => {
            setPdfError(null);
            const normalizedPageCount = Math.max(pageCount, 1);
            setPdfPageCount(normalizedPageCount);
            void updateNotePageCount(note.id, normalizedPageCount);
          }}
          onInteraction={revealChrome}
          onPageChanged={setCurrentPdfPage}
          onScaleChanged={(nextScale) => setPdfScale(clampScale(nextScale))}
          onSingleTap={toggleFocusMode}
          scale={pdfScale}
          width={viewerWidth}
        />
      );
    }

    if (isMultiImage) {
      if (isPagesLoading) {
        return (
          <Pressable onPress={enterFocusMode} style={styles.readerState}>
            <ActivityIndicator color={note.accentColor} />
            <Text style={styles.readerStateText}>Loading pages...</Text>
          </Pressable>
        );
      }

      if (pagesError) {
        return (
          <Pressable onPress={enterFocusMode} style={styles.readerState}>
            <Text style={styles.readerStateTitle}>Pages unavailable</Text>
            <Text style={styles.readerStateText}>{pagesError}</Text>
          </Pressable>
        );
      }

      if (!activePage) {
        return (
          <Pressable onPress={enterFocusMode} style={styles.readerState}>
            <Text style={styles.readerStateTitle}>No pages</Text>
            <Text style={styles.readerStateText}>No pages are available for this note yet.</Text>
          </Pressable>
        );
      }

      return (
        <ZoomableImageViewer
          accentColor={note.accentColor}
          controlledScale={imageScale}
          height={viewerHeight}
          imageUrl={activePage.imageUrl}
          onScaleChanged={(nextScale) => setImageScale(clampScale(nextScale))}
          onSingleTap={toggleFocusMode}
          pageKey={activePage.id}
          width={viewerWidth}
        />
      );
    }

    if (!note.fileUrl) {
      return (
        <Pressable onPress={enterFocusMode} style={styles.readerState}>
          <Text style={styles.readerStateTitle}>Image unavailable</Text>
          <Text style={styles.readerStateText}>This image note does not have a valid file URL.</Text>
        </Pressable>
      );
    }

    return (
      <ZoomableImageViewer
        accentColor={note.accentColor}
        controlledScale={imageScale}
        height={viewerHeight}
        imageUrl={note.fileUrl}
        onScaleChanged={(nextScale) => setImageScale(clampScale(nextScale))}
        onSingleTap={toggleFocusMode}
        pageKey={note.id}
        width={viewerWidth}
      />
    );
  }

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <View style={styles.readerRoot}>
        <LinearGradient
          colors={['#050305', '#120706', '#050305']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundGradient}
        />
        <View pointerEvents="none" style={styles.orangeGlow} />
        <View pointerEvents="none" style={styles.purpleGlow} />

        <View style={styles.documentStage}>{renderDocumentViewer()}</View>

        {pdfError ? (
          <Animated.View
            pointerEvents={isFocusMode ? 'none' : 'auto'}
            style={[styles.viewerError, headerAnimatedStyle]}
          >
            <Text style={styles.viewerErrorText}>{pdfError}</Text>
          </Animated.View>
        ) : null}

        <Animated.View
          pointerEvents={chromeHidden ? 'none' : 'auto'}
          style={[styles.topHeader, { top: insets.top + 8 }, headerAnimatedStyle]}
        >
          <LinearGradient
            colors={['rgba(3, 3, 8, 0.96)', 'rgba(14, 9, 7, 0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topHeaderGradient}
          >
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={23} color={colors.primarySoft} />
            </Pressable>

            <View style={styles.headerTitleWrap}>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {note.title}
              </Text>
            </View>

            <Pressable
              disabled={isSharingNote}
              onPress={() => void handleShareNote()}
              style={({ pressed }) => [
                styles.headerShareButton,
                pressed && !isSharingNote && styles.headerShareButtonPressed,
                isSharingNote && styles.headerShareButtonDisabled,
              ]}
            >
              {isSharingNote ? (
                <ActivityIndicator color={colors.primarySoft} size="small" />
              ) : (
                <Ionicons name="share-social-outline" size={22} color={colors.primarySoft} />
              )}
            </Pressable>
            {note.userId !== user?.id ? (
              <Pressable
                onPress={handleOpenReport}
                style={({ pressed }) => [
                  styles.headerShareButton,
                  pressed && styles.headerShareButtonPressed,
                ]}
              >
                <Ionicons name="ellipsis-vertical" size={21} color={colors.primarySoft} />
              </Pressable>
            ) : null}
          </LinearGradient>
        </Animated.View>

        <Animated.View
          pointerEvents={chromeHidden ? 'none' : 'auto'}
          style={[
            styles.pageBadge,
            {
              top: insets.top + 102,
            },
            headerAnimatedStyle,
          ]}
        >
          <Text style={styles.pageBadgeText}>
            {activePageNumber} / {activePageCount}
          </Text>
        </Animated.View>

        <Animated.View
          pointerEvents={chromeHidden ? 'none' : 'auto'}
          style={[
            styles.sideControls,
            {
              top: Math.max(height * 0.3, insets.top + 150),
            },
            sideControlsAnimatedStyle,
          ]}
        >
          <ReaderControl icon="add-circle-outline" label="Zoom In" onPress={handleZoomIn} />
          <ReaderControl icon="remove-circle-outline" label="Zoom Out" onPress={handleZoomOut} />
          <ReaderControl icon="scan-outline" label="Fit" onPress={handleFitToScreen} />
        </Animated.View>

        {isMultiImage ? (
          <Animated.View
            pointerEvents={chromeHidden ? 'none' : 'auto'}
            style={[
              styles.multiPageControls,
              {
                bottom: insets.bottom + (canMessageUploader ? 316 : 276),
              },
              bottomPanelAnimatedStyle,
            ]}
          >
            <Pressable
              disabled={isFirstMultiPage || isPageTransitioning}
              onPress={() => setViewerPage(currentPageIndex - 1)}
              style={({ pressed }) => [
                styles.multiPageButton,
                (isFirstMultiPage || isPageTransitioning) && styles.multiPageButtonDisabled,
                pressed && !isFirstMultiPage && !isPageTransitioning && styles.multiPageButtonPressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={isFirstMultiPage || isPageTransitioning ? colors.muted : colors.primarySoft}
              />
              <Text
                style={[
                  styles.multiPageButtonText,
                  (isFirstMultiPage || isPageTransitioning) && styles.multiPageButtonTextDisabled,
                ]}
              >
                Previous
              </Text>
            </Pressable>

            <View style={styles.multiPageIndicator}>
              <Text style={styles.multiPageIndicatorText}>
                {activePageNumber} / {activePageCount}
              </Text>
            </View>

            <Pressable
              disabled={isLastMultiPage || isPageTransitioning}
              onPress={() => setViewerPage(currentPageIndex + 1)}
              style={({ pressed }) => [
                styles.multiPageButton,
                (isLastMultiPage || isPageTransitioning) && styles.multiPageButtonDisabled,
                pressed && !isLastMultiPage && !isPageTransitioning && styles.multiPageButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.multiPageButtonText,
                  (isLastMultiPage || isPageTransitioning) && styles.multiPageButtonTextDisabled,
                ]}
              >
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isLastMultiPage || isPageTransitioning ? colors.muted : colors.primarySoft}
              />
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View
          pointerEvents={chromeHidden ? 'none' : 'auto'}
          style={[
            styles.aboutPanel,
            {
              bottom: insets.bottom + 14,
            },
            bottomPanelAnimatedStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(4, 4, 6, 0.97)', 'rgba(12, 8, 6, 0.97)', 'rgba(3, 3, 6, 0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aboutPanelGradient}
          >
            <View style={styles.aboutHandle} />
            <View style={styles.aboutHeader}>
              <Text style={styles.aboutTitle}>About this note</Text>
              <Ionicons name="chevron-up" size={20} color={colors.primarySoft} />
            </View>

            <View style={styles.aboutDivider} />

            <View style={styles.infoGrid}>
              <InfoItem label="Subject" value={note.subject} />
              <InfoItem label="Class" value={classScope} />
              <InfoItem label="School" value={schoolName} />
              <InfoItem label="Uploaded by" value={uploadedBy} />
              <InfoItem label="Uploaded on" value={uploadDate} />
              <InfoItem label="File type" value={fileTypeLabel} />
            </View>

            <View style={styles.tagsRow}>
              <View style={styles.tagPill}>
                <Text style={styles.tagText}>{note.subject}</Text>
              </View>
              <View style={[styles.tagPill, styles.tagPillSecondary]}>
                <Text style={[styles.tagText, styles.tagTextSecondary]}>
                  {displayedPageCount} {displayedPageCount === 1 ? 'page' : 'pages'}
                </Text>
              </View>
            </View>

            {canMessageUploader ? (
              <Pressable onPress={() => void handleMessageUploader()} style={styles.messageButton}>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.background} />
                <Text style={styles.messageButtonText}>Message uploader</Text>
              </Pressable>
            ) : null}
          </LinearGradient>
        </Animated.View>

        <Animated.View
          pointerEvents={chromeHidden ? 'auto' : 'none'}
          style={[
            styles.restoreWrap,
            {
              bottom: insets.bottom + 26,
              right: 18,
            },
            restoreButtonAnimatedStyle,
          ]}
        >
          <Pressable onPress={exitFocusMode} style={styles.restoreButton}>
            <Ionicons name="options-outline" size={23} color={colors.primarySoft} />
          </Pressable>
        </Animated.View>
        <ReportNoteModal
          visible={isReportModalVisible}
          note={note}
          isSubmitting={isSubmittingReport}
          onClose={() => setIsReportModalVisible(false)}
          onSubmit={handleSubmitReport}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030303',
  },
  readerRoot: {
    flex: 1,
    backgroundColor: '#030303',
    overflow: 'hidden',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  orangeGlow: {
    position: 'absolute',
    right: -120,
    top: 170,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 138, 26, 0.13)',
  },
  purpleGlow: {
    position: 'absolute',
    left: -130,
    bottom: 140,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(109, 69, 255, 0.13)',
  },
  documentStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090706',
  },
  topHeader: {
    position: 'absolute',
    left: 8,
    right: 8,
    minHeight: 78,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.08)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  topHeaderGradient: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.32)',
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  headerShareButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(185, 92, 255, 0.36)',
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B95CFF',
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  headerShareButtonPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: 'rgba(255, 138, 26, 0.12)',
  },
  headerShareButtonDisabled: {
    opacity: 0.68,
  },
  pageBadge: {
    position: 'absolute',
    left: 18,
    minWidth: 84,
    minHeight: 40,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(8, 6, 5, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.18)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBadgeText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
  },
  sideControls: {
    position: 'absolute',
    right: 12,
    width: 94,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.24)',
    backgroundColor: 'rgba(12, 8, 5, 0.92)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  readerControl: {
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(247, 240, 232, 0.08)',
  },
  readerControlPressed: {
    backgroundColor: 'rgba(255, 138, 26, 0.12)',
  },
  readerControlDisabled: {
    opacity: 0.48,
  },
  readerControlText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.xs,
    textAlign: 'center',
  },
  readerControlTextDisabled: {
    color: colors.muted,
  },
  multiPageControls: {
    position: 'absolute',
    left: 22,
    right: 22,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.42)',
    backgroundColor: 'rgba(5, 4, 8, 0.9)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    gap: 8,
  },
  multiPageButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(185, 92, 255, 0.46)',
    backgroundColor: 'rgba(21, 10, 34, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  multiPageButtonPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: 'rgba(255, 138, 26, 0.16)',
  },
  multiPageButtonDisabled: {
    opacity: 0.46,
  },
  multiPageButtonText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  multiPageButtonTextDisabled: {
    color: colors.muted,
  },
  multiPageIndicator: {
    minHeight: 38,
    minWidth: 64,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.54)',
    backgroundColor: 'rgba(255, 138, 26, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  multiPageIndicatorText: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  aboutPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.46)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  aboutPanelGradient: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 11,
  },
  aboutHandle: {
    alignSelf: 'center',
    width: 50,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(247, 240, 232, 0.26)',
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  aboutTitle: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  aboutDivider: {
    height: 1,
    backgroundColor: 'rgba(247, 240, 232, 0.1)',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  infoItem: {
    width: '33.33%',
    minHeight: 44,
    paddingRight: 10,
    gap: 5,
  },
  infoLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  infoValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.xs,
    lineHeight: 17,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.66)',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 138, 26, 0.09)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagPillSecondary: {
    borderColor: 'rgba(166, 92, 255, 0.58)',
    backgroundColor: 'rgba(166, 92, 255, 0.09)',
  },
  tagText: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.xs,
  },
  tagTextSecondary: {
    color: '#B88EEB',
  },
  messageButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  messageButtonText: {
    color: colors.background,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  readerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 10,
  },
  readerStateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  readerStateText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  viewerError: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 108,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.38)',
    backgroundColor: 'rgba(20, 10, 7, 0.86)',
    padding: 12,
  },
  viewerErrorText: {
    color: '#FFB083',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  restoreWrap: {
    position: 'absolute',
  },
  restoreButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.42)',
    backgroundColor: 'rgba(5, 4, 7, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 8,
  },
});
