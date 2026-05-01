import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilePreviewCard, UploadActionCard } from '../components';
import { fixedSubjects, getSubjectAccentColor } from '../constants/subjects';
import { useAuth } from '../hooks';
import { isValidSection } from '../lib/normalizeSectionId';
import {
  markRequestFulfilled,
  triggerRequestFulfilledNotification,
  uploadMultiImageNote,
  uploadNote,
} from '../services';
import { colors, typography } from '../theme';
import type {
  PageImage,
  RootTabParamList,
  UploadActionType,
  UploadDraftFile,
  UploadProgressPhase,
  UploadSubject,
} from '../types';

const subjects: UploadSubject[] = fixedSubjects.map((subject) => ({
  id: subject.toLowerCase(),
  label: subject,
  accentColor: getSubjectAccentColor(subject),
}));

const actionConfig: Array<{
  type: UploadActionType;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
}> = [
  {
    type: 'camera',
    title: 'Take Photo',
    description: 'Capture a new note image with the camera.',
    icon: 'C',
    accentColor: colors.primary,
  },
  {
    type: 'gallery',
    title: 'Choose from Gallery',
    description: 'Select an existing note image from the library.',
    icon: 'G',
    accentColor: colors.accentBlue,
  },
  {
    type: 'pdf',
    title: 'Import PDF',
    description: 'Import a PDF note from local storage.',
    icon: 'P',
    accentColor: colors.accentYellow,
  },
];

const WEB_UPLOAD_ACCEPT = 'image/*,.pdf';
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) {
    return undefined;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revokeObjectUrl(uri?: string | null) {
  if (Platform.OS === 'web' && uri?.startsWith('blob:') && typeof URL !== 'undefined') {
    URL.revokeObjectURL(uri);
  }
}

function revokeDraftFile(file?: UploadDraftFile | null) {
  revokeObjectUrl(file?.uri);

  if (file?.previewUri && file.previewUri !== file.uri) {
    revokeObjectUrl(file.previewUri);
  }
}

function revokePageImages(pages: PageImage[]) {
  pages.forEach((page) => revokeObjectUrl(page.uri));
}

function createBrowserFile(file: File | Blob, fallbackName: string, fallbackType?: string): File {
  const hasFileConstructor = typeof File !== 'undefined';
  const browserFile = hasFileConstructor && file instanceof File ? file : null;
  const name = browserFile?.name || fallbackName;
  const type = file.type || fallbackType || '';

  if (browserFile?.name && browserFile.type) {
    return browserFile;
  }

  return new File([file], name, {
    type,
    lastModified: Date.now(),
  });
}

function getWebFileKind(file: File): 'image' | 'pdf' | null {
  if (file.type.startsWith('image/')) {
    return 'image';
  }

  if (file.type === 'application/pdf') {
    return 'pdf';
  }

  return null;
}

function logWebSelectedFile(file: File) {
  console.log('[UploadScreen] selected file', {
    name: file.name,
    size: file.size,
    type: file.type,
  });
}

function getFallbackWebMimeType(fileName: string, actionType: UploadActionType) {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (normalizedName.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedName.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedName.endsWith('.gif')) {
    return 'image/gif';
  }

  if (normalizedName.endsWith('.heic') || normalizedName.endsWith('.heif')) {
    return 'image/heic';
  }

  return actionType === 'pdf' ? '' : 'image/jpeg';
}

function validateWebSelectedFile(file: File) {
  logWebSelectedFile(file);

  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error(
      `"${file.name}" is too large. Upload files up to ${formatFileSize(MAX_UPLOAD_FILE_BYTES)}.`
    );
  }

  if (!getWebFileKind(file)) {
    throw new Error('Unsupported file type. Please choose an image or PDF file.');
  }
}

function openWebFileDialog({
  accept,
  capture,
  multiple,
}: {
  accept: string;
  capture?: boolean;
  multiple?: boolean;
}) {
  return new Promise<File[]>((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve([]);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = Boolean(multiple);

    if (capture) {
      input.setAttribute('capture', 'environment');
    }

    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    let settled = false;
    const settle = (files: File[]) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(files);
    };
    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          settle([]);
        }
      }, 350);
    };
    const cleanup = () => {
      window.removeEventListener('focus', handleWindowFocus);
      input.remove();
    };

    input.addEventListener('change', () => {
      settle(Array.from(input.files ?? []));
    });
    window.addEventListener('focus', handleWindowFocus);

    input.click();
  });
}

function buildImageDraftFile(
  page: PageImage,
  source: 'camera' | 'gallery'
): UploadDraftFile {
  const fileName = page.name ?? `zenmo-${Date.now()}.jpg`;
  const mimeType = page.mimeType;

  return {
    id: page.id,
    name: fileName,
    type: 'image',
    source,
    uri: page.uri,
    previewUri: page.uri,
    mimeType,
    file: page.file,
    sizeBytes: page.sizeBytes ?? undefined,
    sizeLabel: formatFileSize(page.sizeBytes),
  };
}

function buildPageImage(
  asset: ImagePicker.ImagePickerAsset,
  source: 'camera' | 'gallery'
): PageImage {
  return {
    id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uri: asset.uri,
    name: asset.fileName ?? `zenmo-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    sizeBytes: asset.fileSize ?? undefined,
  };
}

function buildWebPageImage(file: File, source: 'camera' | 'gallery'): PageImage {
  const mimeType = file.type || 'image/jpeg';

  return {
    id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uri: URL.createObjectURL(file),
    name: file.name || `zenmo-${Date.now()}.jpg`,
    mimeType,
    file,
    sizeBytes: file.size,
  };
}

function buildPdfDraftFile(asset: DocumentPicker.DocumentPickerAsset): UploadDraftFile {
  const mimeType = asset.mimeType ?? 'application/pdf';

  return {
    id: `pdf-${Date.now()}`,
    name: asset.name,
    type: 'pdf',
    source: 'pdf',
    uri: asset.uri,
    mimeType,
    pageCount: 1,
    sizeBytes: asset.size ?? undefined,
    sizeLabel: formatFileSize(asset.size),
  };
}

function buildWebPdfDraftFile(file: File): UploadDraftFile {
  const mimeType = file.type || 'application/pdf';

  return {
    id: `pdf-${Date.now()}`,
    name: file.name || `zenmo-${Date.now()}.pdf`,
    type: 'pdf',
    source: 'pdf',
    uri: URL.createObjectURL(file),
    mimeType,
    file,
    pageCount: 1,
    sizeBytes: file.size,
    sizeLabel: formatFileSize(file.size),
  };
}

function formatFileTypeLabel(value: UploadDraftFile['type']) {
  return value === 'multi_image' ? 'MULTI IMAGE' : value.toUpperCase();
}

export function UploadScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList, 'Upload'>>();
  const route = useRoute<RouteProp<RootTabParamList, 'Upload'>>();
  const { profile, user } = useAuth();
  const [selectedAction, setSelectedAction] = useState<UploadActionType | null>(null);
  const [selectedFile, setSelectedFile] = useState<UploadDraftFile | null>(null);
  const [pageImages, setPageImages] = useState<PageImage[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadProgressPhase | null>(null);
  const requestContext = route.params;

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId]
  );
  const previewFile = useMemo<UploadDraftFile | null>(() => {
    if (selectedFile) {
      return selectedFile;
    }

    if (pageImages.length === 1) {
      return buildImageDraftFile(pageImages[0], selectedAction === 'camera' ? 'camera' : 'gallery');
    }

    if (pageImages.length > 1) {
      const firstPage = pageImages[0];

      return {
        id: `pending-multi-image-${pageImages.length}`,
        name: `zenmo-pages-${pageImages.length}`,
        type: 'multi_image',
        source: selectedAction === 'camera' ? 'camera' : 'gallery',
        uri: firstPage.uri,
        previewUri: firstPage.uri,
        mimeType: firstPage.mimeType,
        pageCount: pageImages.length,
      };
    }

    return null;
  }, [pageImages, selectedAction, selectedFile]);

  useEffect(() => {
    if (!requestContext) {
      return;
    }

    if (requestContext.requestTitle) {
      setNoteTitle((current) => current.trim() ? current : requestContext.requestTitle ?? '');
    }

    if (requestContext.requestSubject) {
      const matchingSubject = subjects.find((subject) => subject.label === requestContext.requestSubject);

      if (matchingSubject) {
        setSelectedSubjectId(matchingSubject.id);
      }
    }
  }, [requestContext]);

  function resetSelectedPages(nextAction: UploadActionType) {
    if (nextAction === 'pdf') {
      revokePageImages(pageImages);
      setPageImages([]);
      return;
    }

    revokeDraftFile(selectedFile);
    setSelectedFile(null);
  }

  function appendPageImages(nextPages: PageImage[], actionType: 'camera' | 'gallery') {
    if (nextPages.length === 0) {
      return;
    }

    resetSelectedPages(actionType);
    setSelectedAction(actionType);
    setPageImages((current) => [...current, ...nextPages]);
  }

  function applyWebSelectedFiles(files: File[], actionType: UploadActionType) {
    if (files.length === 0) {
      return;
    }

    const normalizedFiles = files.map((file) => {
      const fallbackName = file.name || `zenmo-${Date.now()}`;
      const fallbackType = getFallbackWebMimeType(fallbackName, actionType);
      const normalizedFile = createBrowserFile(file, fallbackName, fallbackType);

      validateWebSelectedFile(normalizedFile);
      return normalizedFile;
    });
    const fileKinds = normalizedFiles.map((file) => getWebFileKind(file));
    const containsPdf = fileKinds.includes('pdf');

    if (containsPdf) {
      if (normalizedFiles.length > 1 || fileKinds.some((kind) => kind !== 'pdf')) {
        throw new Error('Select either one PDF or one or more images, not both.');
      }

      revokePageImages(pageImages);
      revokeDraftFile(selectedFile);
      setPageImages([]);
      setSelectedAction('pdf');
      setSelectedFile(buildWebPdfDraftFile(normalizedFiles[0]));
      return;
    }

    if (actionType === 'pdf') {
      throw new Error('Please choose a PDF file.');
    }

    appendPageImages(
      normalizedFiles.map((file) =>
        buildWebPageImage(file, actionType === 'camera' ? 'camera' : 'gallery')
      ),
      actionType === 'camera' ? 'camera' : 'gallery'
    );
  }

  function askToAddAnotherPage() {
    return new Promise<boolean>((resolve) => {
      Alert.alert('Add another page?', 'Capture another page or finish this note set.', [
        {
          text: 'Done',
          onPress: () => resolve(false),
        },
        {
          text: 'Add another page',
          onPress: () => resolve(true),
        },
      ]);
    });
  }

  async function pickFromCamera() {
    if (Platform.OS === 'web') {
      const files = await openWebFileDialog({
        accept: WEB_UPLOAD_ACCEPT,
        capture: true,
        multiple: false,
      });

      applyWebSelectedFiles(files, 'camera');
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to capture a note photo.');
      return;
    }

    const capturedPages: PageImage[] = [];
    let keepCapturing = true;

    while (keepCapturing) {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) {
        break;
      }

      capturedPages.push(buildPageImage(result.assets[0], 'camera'));
      keepCapturing = await askToAddAnotherPage();
    }

    appendPageImages(capturedPages, 'camera');
  }

  async function pickFromGallery() {
    if (Platform.OS === 'web') {
      const files = await openWebFileDialog({
        accept: WEB_UPLOAD_ACCEPT,
        multiple: true,
      });

      applyWebSelectedFiles(files, 'gallery');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Gallery permission needed', 'Allow photo library access to choose a note image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      orderedSelection: true,
      quality: 1,
      selectionLimit: 0,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    appendPageImages(
      result.assets.map((asset) => buildPageImage(asset, 'gallery')),
      'gallery'
    );
  }

  async function pickPdf() {
    if (Platform.OS === 'web') {
      const files = await openWebFileDialog({
        accept: WEB_UPLOAD_ACCEPT,
        multiple: false,
      });

      applyWebSelectedFiles(files, 'pdf');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    revokePageImages(pageImages);
    revokeDraftFile(selectedFile);
    setPageImages([]);
    setSelectedAction('pdf');
    setSelectedFile(buildPdfDraftFile(result.assets[0]));
  }

  async function handleActionPress(actionType: UploadActionType) {
    if (isUploading) {
      return;
    }

    try {
      if (actionType === 'camera') {
        await pickFromCamera();
        return;
      }

      if (actionType === 'gallery') {
        await pickFromGallery();
        return;
      }

      await pickPdf();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pick a file right now.';
      Alert.alert('Selection failed', message);
    }
  }

  function handleClearFile() {
    if (isUploading) {
      return;
    }

    revokeDraftFile(selectedFile);
    revokePageImages(pageImages);
    setSelectedAction(null);
    setSelectedFile(null);
    setPageImages([]);
  }

  function handleRemovePage(pageId: string) {
    if (isUploading) {
      return;
    }

    setPageImages((current) => {
      const pageToRemove = current.find((page) => page.id === pageId);
      revokeObjectUrl(pageToRemove?.uri);
      return current.filter((page) => page.id !== pageId);
    });
  }

  function handleMovePage(pageId: string, direction: 'up' | 'down') {
    if (isUploading) {
      return;
    }

    setPageImages((current) => {
      const index = current.findIndex((page) => page.id === pageId);

      if (index === -1) {
        return current;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const nextPages = [...current];
      const [page] = nextPages.splice(index, 1);
      nextPages.splice(targetIndex, 0, page);
      return nextPages;
    });
  }

  function resetForm() {
    revokeDraftFile(selectedFile);
    revokePageImages(pageImages);
    setSelectedAction(null);
    setSelectedFile(null);
    setPageImages([]);
    setNoteTitle('');
    setSelectedSubjectId(subjects[0]?.id ?? '');
    setUploadPhase(null);
    navigation.setParams({
      requestId: undefined,
      requestSubject: undefined,
      requestTitle: undefined,
    });
  }

  function getUploadButtonLabel() {
    if (!isUploading) {
      return 'Save / Upload';
    }

    if (uploadPhase === 'compressing') {
      return 'Compressing pages...';
    }

    if (uploadPhase === 'uploading') {
      return pageImages.length > 1 ? 'Uploading pages...' : 'Uploading...';
    }

    if (uploadPhase === 'saving') {
      return 'Saving note...';
    }

    return 'Uploading...';
  }

  async function handleUpload() {
    if (isUploading) {
      return;
    }

    if ((!selectedFile && pageImages.length === 0) || !selectedSubject || !noteTitle.trim()) {
      return;
    }

    if (!profile?.schoolId || !profile?.classId || !user?.id) {
      Alert.alert('Profile required', 'Your class profile is still loading. Please try again in a moment.');
      return;
    }

    if (!isValidSection(profile.sectionId)) {
      Alert.alert('Section required', 'Please update your section (A-Z) in profile');
      return;
    }

    try {
      setIsUploading(true);
      setUploadPhase(pageImages.length > 1 ? 'compressing' : 'uploading');
      let createdNote = null;

      if (selectedFile?.source === 'pdf') {
        createdNote = await uploadNote({
          title: noteTitle.trim(),
          subject: selectedSubject.label,
          file: selectedFile,
          userId: user.id,
          userName: profile.fullName || 'Unknown',
          schoolId: profile.schoolId,
          classId: profile.classId,
          sectionId: profile.sectionId,
        });
      } else if (pageImages.length > 1) {
        createdNote = await uploadMultiImageNote({
          title: noteTitle.trim(),
          subject: selectedSubject.label,
          pages: pageImages,
          userId: user.id,
          userName: profile.fullName || 'Unknown',
          schoolId: profile.schoolId,
          classId: profile.classId,
          sectionId: profile.sectionId,
          onProgress: setUploadPhase,
        });
      } else if (pageImages.length === 1) {
        createdNote = await uploadNote({
          title: noteTitle.trim(),
          subject: selectedSubject.label,
          file: buildImageDraftFile(
            pageImages[0],
            selectedAction === 'camera' ? 'camera' : 'gallery'
          ),
          userId: user.id,
          userName: profile.fullName || 'Unknown',
          schoolId: profile.schoolId,
          classId: profile.classId,
          sectionId: profile.sectionId,
        });
      } else {
        throw new Error('Select at least one page before uploading.');
      }

      if (requestContext?.requestId && createdNote) {
        try {
          const fulfilledRequest = await markRequestFulfilled({
            requestId: requestContext.requestId,
            noteId: createdNote.id,
          });

          void triggerRequestFulfilledNotification({
            requestId: fulfilledRequest.id,
          }).catch((error) => {
            if (__DEV__) {
              console.error('[UploadScreen] request fulfilled notification failed', error);
            }
          });
        } catch (error) {
          resetForm();
          navigation.navigate('Home');

          const message =
            error instanceof Error
              ? error.message
              : 'Your note uploaded successfully, but the request could not be marked fulfilled.';
          Alert.alert('Note uploaded', message);
          return;
        }
      }

      resetForm();
      navigation.navigate('Home');
      Alert.alert('Upload complete', 'Your note is now available in the feed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload the note.';
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploading(false);
      setUploadPhase(null);
    }
  }

  const isReadyToUpload = Boolean(
    (selectedFile || pageImages.length > 0) &&
      noteTitle.trim() &&
      selectedSubject &&
      profile?.schoolId &&
      profile?.classId &&
      isValidSection(profile?.sectionId ?? '') &&
      user?.id &&
      !isUploading
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowOrange} />
      <View pointerEvents="none" style={styles.lightStreak} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Capture Workspace</Text>
          <Text style={styles.title}>Upload Note</Text>
          <Text style={styles.subtitle}>
            Prepare photo and PDF notes in a clean mobile upload flow.
          </Text>
        </View>

        {requestContext?.requestId ? (
          <View style={styles.requestCard}>
            <Text style={styles.requestLabel}>Fulfilling Request</Text>
            <Text style={styles.requestTitle}>{requestContext.requestTitle ?? 'Requested note'}</Text>
            <Text style={styles.requestMeta}>
              {requestContext.requestSubject ?? 'General'} / This request will be marked fulfilled after a successful upload.
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Source</Text>
          <View style={styles.actionGrid}>
            {actionConfig.map((action) => (
              <UploadActionCard
                key={action.type}
                title={action.title}
                description={action.description}
                icon={action.icon}
                accentColor={action.accentColor}
                active={selectedAction === action.type}
                onPress={() => void handleActionPress(action.type)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.gradientHintWrap}>
              <Text style={styles.sectionHintPurple}>Image</Text>
              <Text style={styles.sectionHint}> or </Text>
              <Text style={styles.sectionHintOrange}>PDF</Text>
            </View>
          </View>

          <FilePreviewCard file={previewFile} onClear={handleClearFile} />

          {pageImages.length > 0 ? (
            <View style={styles.pageListCard}>
              <View style={styles.pageListHeader}>
                <Text style={styles.pageListTitle}>Selected Pages</Text>
                <Text style={styles.pageListHint}>
                  {pageImages.length > 1 ? 'Multi-image note ready' : 'Single image upload ready'}
                </Text>
              </View>

              <View style={styles.pageList}>
                {pageImages.map((page, index) => (
                  <View key={page.id} style={styles.pageRow}>
                    <Image source={{ uri: page.uri }} style={styles.pageThumb} resizeMode="cover" />

                    <View style={styles.pageCopy}>
                      <Text style={styles.pageTitle}>Page {index + 1}</Text>
                      <Text style={styles.pageMeta}>Ready for upload</Text>
                    </View>

                    <View style={styles.pageActions}>
                      <Pressable
                        onPress={() => handleMovePage(page.id, 'up')}
                        disabled={index === 0}
                        style={[styles.pageActionButton, index === 0 && styles.pageActionButtonDisabled]}
                      >
                        <Text style={styles.pageActionLabel}>Up</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleMovePage(page.id, 'down')}
                        disabled={index === pageImages.length - 1}
                        style={[
                          styles.pageActionButton,
                          index === pageImages.length - 1 && styles.pageActionButtonDisabled,
                        ]}
                      >
                        <Text style={styles.pageActionLabel}>Down</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemovePage(page.id)}
                        style={[styles.pageActionButton, styles.pageRemoveButton]}
                      >
                        <Text style={[styles.pageActionLabel, styles.pageRemoveLabel]}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              {selectedAction === 'camera' ? (
                <Pressable
                  disabled={isUploading}
                  onPress={() => void pickFromCamera()}
                  style={[styles.addPageButton, isUploading && styles.pageActionButtonDisabled]}
                >
                  <Text style={styles.addPageButtonLabel}>Add another page</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.fileInfoCard}>
            <Text style={styles.fileInfoLabel}>File Info</Text>
            <Text style={styles.fileInfoValue}>
              {previewFile
                ? `${formatFileTypeLabel(previewFile.type)} / ${previewFile.sizeLabel ?? (pageImages.length > 1 ? `${pageImages.length} pages` : 'Unknown size')}`
                : 'No file selected'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Note Title</Text>
              <TextInput
                value={noteTitle}
                onChangeText={setNoteTitle}
                placeholder="Enter a clear title"
                placeholderTextColor={colors.muted}
                style={styles.input}
                selectionColor={colors.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subject</Text>
              <View style={styles.chipRow}>
                {subjects.map((subject) => {
                  const active = subject.id === selectedSubjectId;

                  return (
                    <Pressable
                      key={subject.id}
                      onPress={() => setSelectedSubjectId(subject.id)}
                      style={[
                        styles.subjectChip,
                        active && styles.subjectChipActive,
                        active && { borderColor: subject.accentColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subjectChipText,
                          active && { color: subject.accentColor },
                        ]}
                      >
                        {subject.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <Pressable
          disabled={!isReadyToUpload}
          onPress={() => void handleUpload()}
          style={[styles.saveButton, !isReadyToUpload && styles.saveButtonDisabled]}
        >
          <LinearGradient
            colors={isReadyToUpload ? ['#8F2CFF', '#FF8427'] : ['#2A1E19', '#2A1E19']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.saveButtonGradient}
          >
            {isUploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.saveButtonLabel}>{getUploadButtonLabel()}</Text>
              </View>
            ) : (
              <Text style={[styles.saveButtonLabel, !isReadyToUpload && styles.saveButtonLabelDisabled]}>
                Save / Upload
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
    gap: 30,
  },
  cosmicGlowPurple: {
    position: 'absolute',
    top: 110,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(143, 44, 255, 0.14)',
  },
  cosmicGlowOrange: {
    position: 'absolute',
    top: 236,
    right: -108,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255, 132, 39, 0.11)',
  },
  lightStreak: {
    position: 'absolute',
    top: 190,
    right: -30,
    width: 210,
    height: 2,
    backgroundColor: 'rgba(255, 132, 39, 0.22)',
    transform: [{ rotate: '-24deg' }],
  },
  header: {
    gap: 10,
  },
  eyebrow: {
    color: '#72C9FF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    color: '#FFF6EF',
    fontFamily: typography.fontFamily.display,
    fontSize: 43,
    lineHeight: 49,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 132, 39, 0.22)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    color: '#B5AAA7',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 17,
    lineHeight: 25,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: colors.accentBlue,
    borderRadius: 16,
    backgroundColor: 'rgba(14, 8, 15, 0.92)',
    padding: 16,
    gap: 6,
  },
  requestLabel: {
    color: colors.accentBlue,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  requestTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
  },
  requestMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
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
    fontSize: 28,
    lineHeight: 34,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.16)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  sectionHint: {
    color: '#B7AEB5',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
  },
  gradientHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHintPurple: {
    color: '#B45CFF',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  sectionHintOrange: {
    color: '#FF8427',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  actionGrid: {
    gap: 12,
  },
  fileInfoCard: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.36)',
    borderRadius: 14,
    backgroundColor: 'rgba(14, 8, 15, 0.9)',
    padding: 14,
    gap: 6,
  },
  pageListCard: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.36)',
    borderRadius: 14,
    backgroundColor: 'rgba(14, 8, 15, 0.9)',
    padding: 14,
    gap: 12,
  },
  pageListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageListTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pageListHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.xs,
  },
  pageList: {
    gap: 10,
  },
  pageRow: {
    borderWidth: 1,
    borderColor: 'rgba(255, 132, 39, 0.25)',
    borderRadius: 12,
    backgroundColor: 'rgba(8, 5, 10, 0.9)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageThumb: {
    width: 56,
    height: 72,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  pageCopy: {
    flex: 1,
    gap: 4,
  },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
  },
  pageMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.sm,
  },
  pageActions: {
    gap: 6,
  },
  pageActionButton: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.36)',
    borderRadius: 8,
    backgroundColor: 'rgba(14, 8, 15, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageActionButtonDisabled: {
    opacity: 0.45,
  },
  pageActionLabel: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pageRemoveButton: {
    borderColor: '#7C2F1E',
    backgroundColor: '#1B110E',
  },
  pageRemoveLabel: {
    color: '#FFB083',
  },
  addPageButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 132, 39, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addPageButtonLabel: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fileInfoLabel: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fileInfoValue: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  formCard: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.36)',
    borderRadius: 16,
    backgroundColor: 'rgba(14, 8, 15, 0.92)',
    padding: 16,
    gap: 18,
  },
  inputGroup: {
    gap: 10,
  },
  inputLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 132, 39, 0.32)',
    borderRadius: 10,
    backgroundColor: 'rgba(5, 3, 8, 0.9)',
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subjectChip: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.36)',
    borderRadius: 8,
    backgroundColor: 'rgba(5, 3, 8, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subjectChipActive: {
    backgroundColor: 'rgba(143, 44, 255, 0.16)',
  },
  subjectChipText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF8427',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    shadowOpacity: 0,
  },
  saveButtonLabel: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  saveButtonLabelDisabled: {
    color: colors.textMuted,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
