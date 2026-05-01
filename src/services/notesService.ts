import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { getSubjectAccentColor } from '../constants/subjects';
import { isValidSection, normalizeSectionId } from '../lib/normalizeSectionId';
import { supabase } from '../lib/supabase';
import type { NotePage, PageImage, RecentNote, UploadDraftFile, UploadProgressPhase } from '../types';
import { ensureCurrentUserNotBanned } from './banService';

type NoteRow = {
  id: string;
  title: string;
  subject: string | null;
  file_type: string | null;
  file_url: string | null;
  user_id: string | null;
  user_name: string | null;
  pages: number | null;
  school_id: string | null;
  class_id: string | null;
  section_id: string | null;
  uploaded_at: string | null;
};

type OwnedNoteMetaRow = {
  id: string;
  file_url: string | null;
  file_type: string | null;
};

type NotePageRow = {
  id: string;
  page_number: number | null;
  image_url: string | null;
};

type UploadNoteInput = {
  title: string;
  subject: string;
  file: UploadDraftFile;
  userId: string;
  userName: string;
  schoolId: string;
  classId: string;
  sectionId: string;
};

type UploadMultiImageNoteInput = {
  title: string;
  subject: string;
  pages: PageImage[];
  userId: string;
  userName: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  onProgress?: (phase: UploadProgressPhase) => void;
};

type FetchRecentNotesInput = {
  schoolId: string;
  classId: string;
  sectionId: string;
};

type FetchUserNotesInput = {
  userId: string;
};

type FetchNoteByIdInput = {
  noteId: string;
  schoolId: string;
  classId: string;
  sectionId: string;
};

type UpdateOwnedNoteInput = {
  noteId: string;
  userId: string;
  title: string;
  subject: string;
};

type DeleteOwnedNoteInput = {
  noteId: string;
  userId: string;
  storagePath?: string | null;
};

const noteSelectFields =
  'id, title, subject, file_type, file_url, user_id, user_name, pages, school_id, class_id, section_id, uploaded_at';
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

function logSupabaseError(context: string, error: unknown) {
  if (!error || typeof error !== 'object') {
    console.error(`[notesService] ${context}`, error);
    return;
  }

  const candidate = error as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  console.error(`[notesService] ${context}`, {
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    details: typeof candidate.details === 'string' ? candidate.details : undefined,
    hint: typeof candidate.hint === 'string' ? candidate.hint : undefined,
  });
}

function toAppError(error: unknown, fallbackMessage: string) {
  logSupabaseError(fallbackMessage, error);

  if (error instanceof Error && error.message.trim()) {
    return new Error(error.message);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === 'string' && message.trim()) {
      return new Error(message);
    }
  }

  return new Error(fallbackMessage);
}

function formatUploadFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) {
    return 'unknown';
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBrowserUploadFile(file?: File | Blob) {
  if (Platform.OS !== 'web' || typeof Blob === 'undefined' || !file || !(file instanceof Blob)) {
    return null;
  }

  return file;
}

function isGenericMimeType(value?: string | null) {
  return !value || value === 'application/octet-stream' || value === 'binary/octet-stream';
}

function getUploadFileName(file: UploadDraftFile | PageImage, fallbackName: string) {
  return file.name || fallbackName;
}

function getUploadMimeType(file: UploadDraftFile | PageImage) {
  const browserFile = getBrowserUploadFile(file.file);
  const mimeType = file.mimeType || browserFile?.type || 'application/octet-stream';
  const fileName = getUploadFileName(file, '');

  if (fileName.toLowerCase().endsWith('.pdf') && isGenericMimeType(mimeType)) {
    return 'application/pdf';
  }

  return mimeType;
}

function getUploadFileSize(file: UploadDraftFile | PageImage) {
  const browserFile = getBrowserUploadFile(file.file);

  return file.sizeBytes ?? browserFile?.size ?? null;
}

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith('image/');
}

function isPdfMimeType(mimeType: string, fileName: string) {
  return mimeType === 'application/pdf' || (fileName.toLowerCase().endsWith('.pdf') && isGenericMimeType(mimeType));
}

function assertSupportedUploadFile(
  file: UploadDraftFile | PageImage,
  expectedType: 'image' | 'pdf',
  fallbackName: string
) {
  const fileName = getUploadFileName(file, fallbackName);
  const mimeType = getUploadMimeType(file);
  const sizeBytes = getUploadFileSize(file);

  console.log('[notesService] upload file', {
    name: fileName,
    size: sizeBytes,
    type: mimeType,
  });

  if (sizeBytes && sizeBytes > MAX_UPLOAD_FILE_BYTES) {
    throw new Error(
      `"${fileName}" is too large. Upload files up to ${formatUploadFileSize(MAX_UPLOAD_FILE_BYTES)}.`
    );
  }

  if (expectedType === 'pdf' && !isPdfMimeType(mimeType, fileName)) {
    throw new Error('Unsupported file type. Please choose a PDF file.');
  }

  if (expectedType === 'image' && !isImageMimeType(mimeType)) {
    throw new Error('Unsupported file type. Please choose an image file.');
  }
}

async function getStorageUploadBody(file: UploadDraftFile | PageImage) {
  const browserFile = getBrowserUploadFile(file.file);

  if (browserFile) {
    return browserFile;
  }

  return readFileAsArrayBuffer(file.uri);
}

function logStorageUploadResponse(
  context: string,
  path: string,
  data: unknown,
  error: unknown
) {
  console.log('[notesService] upload response', {
    context,
    data,
    error: error
      ? {
          message: error instanceof Error ? error.message : String(error),
        }
      : null,
    path,
  });
}

function formatUploadedDate(value: string | null) {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function normalizeFileType(value: string | null): 'image' | 'pdf' | 'multi_image' {
  if (value === 'pdf' || value === 'multi_image') {
    return value;
  }

  return 'image';
}

function getAccentColor(subject: string | null) {
  return getSubjectAccentColor(subject ?? '');
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function getFileExtension(file: UploadDraftFile) {
  const parts = file.name.split('.');
  const lastPart = parts[parts.length - 1];

  if (lastPart && lastPart !== file.name) {
    return lastPart.toLowerCase();
  }

  if (file.type === 'pdf') {
    return 'pdf';
  }

  if (file.mimeType.includes('png')) {
    return 'png';
  }

  return 'jpg';
}

function getImageExtension(page: PageImage) {
  const fileName = page.name ?? '';
  const parts = fileName.split('.');
  const lastPart = parts[parts.length - 1];

  if (lastPart && lastPart !== fileName) {
    return lastPart.toLowerCase();
  }

  if (page.mimeType.includes('png')) {
    return 'png';
  }

  return 'jpg';
}

function replaceFileExtension(value: string, nextExtension: string) {
  if (!value.includes('.')) {
    return `${value}.${nextExtension}`;
  }

  return value.replace(/\.[^.]+$/, `.${nextExtension}`);
}

function buildStoragePath(file: UploadDraftFile, userId: string) {
  const extension = getFileExtension(file);
  const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `${userId}/${timestamp}-${baseName}.${extension}`;
}

function buildMultiImageStoragePath(
  page: PageImage,
  userId: string,
  uploadBatchId: string,
  pageNumber: number
) {
  const extension = getImageExtension(page);
  const baseName = sanitizeFileName((page.name ?? `page-${pageNumber}`).replace(/\.[^.]+$/, ''));

  return `${userId}/multi-image/${uploadBatchId}/${pageNumber}-${baseName}.${extension}`;
}

async function readFileAsArrayBuffer(uri: string) {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error('Unable to read the selected file.');
  }

  return response.arrayBuffer();
}

async function compressImagePage(page: PageImage, pageNumber: number): Promise<PageImage> {
  const compressedName = replaceFileExtension(page.name ?? `page-${pageNumber}`, 'jpg');
  const result = await manipulateAsync(
    page.uri,
    [{ resize: { width: 1600 } }],
    {
      compress: 0.7,
      format: SaveFormat.JPEG,
    }
  );

  return {
    ...page,
    uri: result.uri,
    name: compressedName,
    mimeType: 'image/jpeg',
    sizeBytes: undefined,
  };
}

async function compressUploadImage(file: UploadDraftFile): Promise<UploadDraftFile> {
  const compressedName = replaceFileExtension(file.name, 'jpg');
  const result = await manipulateAsync(
    file.uri,
    [{ resize: { width: 1600 } }],
    {
      compress: 0.7,
      format: SaveFormat.JPEG,
    }
  );

  return {
    ...file,
    uri: result.uri,
    previewUri: result.uri,
    name: compressedName,
    mimeType: 'image/jpeg',
    sizeBytes: undefined,
    sizeLabel: undefined,
  };
}

function extractStoragePath(fileUrl: string | null) {
  if (!fileUrl) {
    return null;
  }

  const bucketSegment = '/storage/v1/object/public/notes/';
  const segmentIndex = fileUrl.indexOf(bucketSegment);

  if (segmentIndex === -1) {
    return null;
  }

  const rawPath = fileUrl.slice(segmentIndex + bucketSegment.length);
  const [pathWithoutQuery] = rawPath.split('?');

  if (!pathWithoutQuery) {
    return null;
  }

  return decodeURIComponent(pathWithoutQuery);
}

function mapNoteRow(row: NoteRow): RecentNote {
  const uploadedAt = row.uploaded_at ?? new Date().toISOString();
  const subject = row.subject ?? 'Science';
  const fileType = normalizeFileType(row.file_type);

  return {
    id: row.id,
    title: row.title,
    subject,
    fileType,
    fileUrl: row.file_url ?? '',
    storagePath: extractStoragePath(row.file_url),
    userId: row.user_id ?? 'unknown-user',
    userName: row.user_name?.trim() || 'Unknown',
    schoolId: row.school_id ?? '',
    classId: row.class_id ?? '',
    sectionId: row.section_id ?? '',
    date: formatUploadedDate(uploadedAt),
    uploadedAt,
    pages: Math.max(row.pages ?? 1, 1),
    accentColor: getAccentColor(subject),
  };
}

function mapNotePageRow(row: NotePageRow): NotePage {
  return {
    id: row.id,
    pageNumber: Math.max(row.page_number ?? 1, 1),
    imageUrl: row.image_url ?? '',
  };
}

async function removeStoragePaths(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from('notes').remove(paths);

  if (error) {
    console.warn('Unable to remove note file(s) from storage:', error.message);
  }
}

async function fetchOwnedNoteMeta(noteId: string, userId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('id, file_url, file_type')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw toAppError(error, 'Unable to verify note ownership right now.');
  }

  if (!data) {
    throw new Error('This note was not found or you no longer have permission to manage it.');
  }

  return data as OwnedNoteMetaRow;
}

export async function fetchRecentNotes(input: FetchRecentNotesInput) {
  if (!isValidSection(input.sectionId)) {
    return [];
  }

  const { data, error } = await supabase
    .from('notes')
    .select(noteSelectFields)
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('section_id', input.sectionId.trim().toUpperCase())
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw toAppError(error, 'Unable to load recent notes right now.');
  }

  return (data ?? []).map((row) => mapNoteRow(row as NoteRow));
}

export async function fetchUserNotes(input: FetchUserNotesInput) {
  const { data, error } = await supabase
    .from('notes')
    .select(noteSelectFields)
    .eq('user_id', input.userId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw toAppError(error, 'Unable to load your notes right now.');
  }

  return (data ?? []).map((row) => mapNoteRow(row as NoteRow));
}

export async function fetchNoteById(input: FetchNoteByIdInput) {
  if (!isValidSection(input.sectionId)) {
    return null;
  }

  const { data, error } = await supabase
    .from('notes')
    .select(noteSelectFields)
    .eq('id', input.noteId)
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('section_id', normalizeSectionId(input.sectionId))
    .maybeSingle();

  if (error) {
    throw toAppError(error, 'Unable to load this note right now.');
  }

  if (!data) {
    return null;
  }

  return mapNoteRow(data as NoteRow);
}

export async function fetchVisibleNoteById(noteId: string) {
  const { data, error } = await supabase.rpc('get_visible_note', {
    target_note_id: noteId,
  });

  if (error) {
    throw toAppError(error, 'Unable to load this shared note right now.');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return null;
  }

  return mapNoteRow(row as NoteRow);
}

export async function fetchShareableNotes() {
  const { data, error } = await supabase.rpc('get_shareable_notes');

  if (error) {
    throw toAppError(error, 'Unable to load notes you can share right now.');
  }

  return (data ?? []).map((row: unknown) => mapNoteRow(row as NoteRow));
}

export async function fetchNotePages(noteId: string) {
  const { data, error } = await supabase
    .from('note_pages')
    .select('id, page_number, image_url')
    .eq('note_id', noteId)
    .order('page_number', { ascending: true });

  if (error) {
    throw toAppError(error, 'Unable to load note pages right now.');
  }

  return (data ?? []).map((row) => mapNotePageRow(row as NotePageRow));
}

export async function updateNotePageCount(noteId: string, pageCount: number) {
  const normalizedPageCount = Math.max(Math.floor(pageCount), 1);

  if (!noteId.trim() || normalizedPageCount < 1) {
    return;
  }

  await supabase
    .from('notes')
    .update({ pages: normalizedPageCount })
    .eq('id', noteId);
}

export async function uploadNote(input: UploadNoteInput) {
  await ensureCurrentUserNotBanned();

  if (!isValidSection(input.sectionId)) {
    throw new Error('Please update your section (A-Z) in profile');
  }

  const uploadStart = Date.now();
  const fileToUpload =
    input.file.type === 'image' && Platform.OS !== 'web'
      ? await compressUploadImage(input.file)
      : input.file;
  const expectedType = fileToUpload.type === 'pdf' ? 'pdf' : 'image';

  assertSupportedUploadFile(fileToUpload, expectedType, fileToUpload.name);

  const filePath = buildStoragePath(fileToUpload, input.userId);
  const fileBody = await getStorageUploadBody(fileToUpload);
  const contentType = getUploadMimeType(fileToUpload);

  const { data: storageData, error: storageError } = await supabase.storage.from('notes').upload(filePath, fileBody, {
    contentType,
    upsert: false,
  });
  logStorageUploadResponse('single-file', filePath, storageData, storageError);

  if (storageError) {
    throw toAppError(storageError, 'Unable to upload this note file right now.');
  }

  const { data: publicUrlData } = supabase.storage.from('notes').getPublicUrl(filePath);
  const uploadedAt = new Date().toISOString();

  const insertPayload = {
    title: input.title,
    subject: input.subject,
    file_type: fileToUpload.type,
    file_url: publicUrlData.publicUrl,
    file_name: fileToUpload.name,
    user_id: input.userId,
    user_name: input.userName,
    pages: Math.max(fileToUpload.pageCount ?? 1, 1),
    school_id: input.schoolId,
    class_id: input.classId,
    section_id: normalizeSectionId(input.sectionId),
    uploaded_at: uploadedAt,
  };

  const { data, error } = await supabase
    .from('notes')
    .insert(insertPayload)
    .select(noteSelectFields)
    .single();

  if (error) {
    await removeStoragePaths([filePath]);
    throw toAppError(error, 'Unable to save this note right now.');
  }

  console.log(`[notesService] single-file upload finished in ${Date.now() - uploadStart}ms`);

  return mapNoteRow(data as NoteRow);
}

export async function uploadMultiImageNote(input: UploadMultiImageNoteInput) {
  await ensureCurrentUserNotBanned();

  if (!isValidSection(input.sectionId)) {
    throw new Error('Please update your section (A-Z) in profile');
  }

  if (input.pages.length < 2) {
    throw new Error('Select at least two images to create a multi-image note.');
  }

  const uploadBatchId = new Date().toISOString().replace(/[:.]/g, '-');
  const uploadedPaths: string[] = [];
  const uploadedPages: Array<{ pageNumber: number; imageUrl: string; imageName: string }> = [];
  let insertedNoteId: string | null = null;
  const totalStart = Date.now();

  try {
    let pagesToUpload = input.pages;

    if (Platform.OS !== 'web') {
      input.onProgress?.('compressing');
      const compressionStart = Date.now();
      pagesToUpload = await Promise.all(
        input.pages.map((page, index) => compressImagePage(page, index + 1))
      );
      const compressionDuration = Date.now() - compressionStart;
      console.log(`[notesService] multi-image compression finished in ${compressionDuration}ms`);
    } else {
      console.log('[notesService] web multi-image upload using browser file payloads');
    }

    input.onProgress?.('uploading');
    const uploadStart = Date.now();
    const uploadResults = await Promise.all(
      pagesToUpload.map(async (page, index) => {
        const pageNumber = index + 1;
        const path = buildMultiImageStoragePath(
          page,
          input.userId,
          uploadBatchId,
          pageNumber
        );
        const pageUploadStart = Date.now();

        try {
          assertSupportedUploadFile(page, 'image', page.name ?? `Page ${pageNumber}`);

          const body = await getStorageUploadBody(page);
          const contentType = getUploadMimeType(page);
          const { data: storageData, error: storageError } = await supabase.storage.from('notes').upload(path, body, {
            contentType,
            upsert: false,
          });
          logStorageUploadResponse(`multi-image-page-${pageNumber}`, path, storageData, storageError);

          if (storageError) {
            throw storageError;
          }

          const { data: publicUrlData } = supabase.storage.from('notes').getPublicUrl(path);
          const durationMs = Date.now() - pageUploadStart;
          console.log(`[notesService] uploaded page ${pageNumber} in ${durationMs}ms`);

          return {
            ok: true as const,
            pageNumber,
            imageUrl: publicUrlData.publicUrl,
            imageName: page.name ?? `Page ${pageNumber}`,
            path,
            durationMs,
          };
        } catch (error) {
          const durationMs = Date.now() - pageUploadStart;
          console.log(`[notesService] failed page ${pageNumber} after ${durationMs}ms`);

          return {
            ok: false as const,
            error,
            pageNumber,
            path,
            durationMs,
          };
        }
      })
    );
    const uploadDuration = Date.now() - uploadStart;
    console.log(`[notesService] multi-image uploads finished in ${uploadDuration}ms`);

    const failedUpload = uploadResults.find((result) => !result.ok);

    if (failedUpload && !failedUpload.ok) {
      const successfulPaths = uploadResults
        .filter((result): result is Extract<(typeof uploadResults)[number], { ok: true }> => result.ok)
        .map((result) => result.path);

      await removeStoragePaths(successfulPaths);
      throw toAppError(failedUpload.error, 'Unable to upload one or more note pages right now.');
    }

    for (const result of uploadResults) {
      if (result.ok) {
        uploadedPaths.push(result.path);
        uploadedPages.push({
          pageNumber: result.pageNumber,
          imageUrl: result.imageUrl,
          imageName: result.imageName,
        });
      }
    }

    input.onProgress?.('saving');
    const dbStart = Date.now();
    const uploadedAt = new Date().toISOString();
    const firstPage = uploadedPages[0];
    const parentFileName = `${sanitizeFileName(input.title.trim() || 'zenmo-note')}-pages`;
    const { data: insertedNote, error: noteError } = await supabase
      .from('notes')
      .insert({
        title: input.title,
        subject: input.subject,
        file_type: 'multi_image',
        file_url: firstPage.imageUrl,
        file_name: parentFileName,
        user_id: input.userId,
        user_name: input.userName,
        pages: uploadedPages.length,
        school_id: input.schoolId,
        class_id: input.classId,
        section_id: normalizeSectionId(input.sectionId),
        uploaded_at: uploadedAt,
      })
      .select(noteSelectFields)
      .single();

    if (noteError) {
      throw toAppError(noteError, 'Unable to save the multi-image note right now.');
    }

    insertedNoteId = (insertedNote as NoteRow).id;

    const pageRows = uploadedPages.map((page) => ({
      note_id: insertedNoteId,
      page_number: page.pageNumber,
      image_url: page.imageUrl,
      image_name: page.imageName,
    }));

    const { error: notePagesError } = await supabase.from('note_pages').insert(pageRows);

    if (notePagesError) {
      throw toAppError(notePagesError, 'Unable to save note pages right now.');
    }

    const dbDuration = Date.now() - dbStart;
    const totalDuration = Date.now() - totalStart;
    console.log(`[notesService] multi-image db insert finished in ${dbDuration}ms`);
    console.log(`[notesService] multi-image total upload finished in ${totalDuration}ms`);

    return mapNoteRow(insertedNote as NoteRow);
  } catch (error) {
    if (insertedNoteId) {
      await supabase.from('notes').delete().eq('id', insertedNoteId).eq('user_id', input.userId);
    }

    await removeStoragePaths(uploadedPaths);
    throw error;
  }
}

export async function updateOwnedNote(input: UpdateOwnedNoteInput) {
  await ensureCurrentUserNotBanned();

  if (!input.noteId.trim()) {
    throw new Error('A valid note is required before editing.');
  }

  await fetchOwnedNoteMeta(input.noteId, input.userId);

  const payload = {
    title: input.title.trim(),
    subject: input.subject.trim(),
  };

  const { data, error } = await supabase
    .from('notes')
    .update(payload)
    .eq('id', input.noteId)
    .eq('user_id', input.userId)
    .select(noteSelectFields)
    .maybeSingle();

  if (error) {
    throw toAppError(error, 'Unable to update this note right now.');
  }

  if (!data) {
    throw new Error(
      'This note update is being blocked by database permissions. Apply the latest note owner actions migration and try again.'
    );
  }

  return mapNoteRow(data as NoteRow);
}

export async function deleteOwnedNote(input: DeleteOwnedNoteInput) {
  if (!input.noteId.trim()) {
    throw new Error('A valid note is required before deleting.');
  }

  console.log('[notesService] delete note request', {
    noteId: input.noteId,
    userId: input.userId,
  });

  const ownedNote = await fetchOwnedNoteMeta(input.noteId, input.userId);
  const pathsToRemove = new Set<string>();

  const parentStoragePath = input.storagePath ?? extractStoragePath(ownedNote.file_url);

  if (parentStoragePath) {
    pathsToRemove.add(parentStoragePath);
  }

  const { data: notePagesData, error: notePagesError } = await supabase
    .from('note_pages')
    .select('image_url')
    .eq('note_id', input.noteId);

  if (notePagesError) {
    logSupabaseError('Unable to inspect note pages before delete', notePagesError);
  } else {
    for (const row of notePagesData ?? []) {
      const storagePath = extractStoragePath((row as { image_url?: string | null }).image_url ?? null);

      if (storagePath) {
        pathsToRemove.add(storagePath);
      }
    }
  }

  const { error: deletePagesError } = await supabase
    .from('note_pages')
    .delete()
    .eq('note_id', input.noteId);

  if (deletePagesError) {
    logSupabaseError('Unable to delete note pages before parent delete; continuing', deletePagesError);
  }

  const { data, error } = await supabase
    .from('notes')
    .delete()
    .eq('id', input.noteId)
    .eq('user_id', input.userId)
    .select('id')
    .maybeSingle();

  console.log('[notesService] delete note parent response', {
    noteId: input.noteId,
    deleted: Boolean(data),
    error: error ? ('message' in error ? error.message : String(error)) : null,
  });

  if (error) {
    throw toAppError(error, 'Unable to delete this note right now.');
  }

  if (!data) {
    throw new Error(
      'This note delete is being blocked by database permissions. Apply the latest note owner actions migration and try again.'
    );
  }

  await removeStoragePaths([...pathsToRemove]);

  return {
    id: ownedNote.id,
    fileType: normalizeFileType(ownedNote.file_type),
    removedStoragePaths: [...pathsToRemove],
  };
}
