const DB_NAME = 'zenmo-web-upload-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const PDF_DRAFT_ID = 'pdf';
const PENDING_UPLOAD_KEY = 'zenmo.pendingWebUpload';
const DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

type WebPdfDraftMetadata = {
  noteTitle?: string;
  subjectId?: string;
};

type StoredWebPdfDraft = WebPdfDraftMetadata & {
  blob: Blob;
  fileName: string;
  id: typeof PDF_DRAFT_ID;
  lastModified?: number;
  mimeType: string;
  sizeBytes: number;
  updatedAt: number;
};

export type RestoredWebPdfDraft = WebPdfDraftMetadata & {
  file: File;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: number;
};

function canUseBrowserDraftStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof indexedDB !== 'undefined' &&
    typeof Blob !== 'undefined'
  );
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.oncomplete = () => resolve();
  });
}

function openDraftDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!canUseBrowserDraftStorage()) {
      reject(new Error('Browser draft storage is unavailable.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error('Unable to open browser draft storage.'));
    request.onblocked = () => reject(new Error('Browser draft storage is blocked by another tab.'));
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readStoredPdfDraft() {
  if (!canUseBrowserDraftStorage()) {
    return null;
  }

  const db = await openDraftDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const draft = await requestToPromise<StoredWebPdfDraft | undefined>(
      transaction.objectStore(STORE_NAME).get(PDF_DRAFT_ID)
    );

    return draft ?? null;
  } finally {
    db.close();
  }
}

async function writeStoredPdfDraft(draft: StoredWebPdfDraft) {
  const db = await openDraftDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(draft);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export function markWebUploadDraftPending(reason: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      PENDING_UPLOAD_KEY,
      JSON.stringify({
        reason,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // Storage can be unavailable in private browsing. The picker still works without recovery.
  }
}

export function clearWebUploadDraftPending() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(PENDING_UPLOAD_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function hasRecentWebUploadDraftPending() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const rawValue = window.localStorage.getItem(PENDING_UPLOAD_KEY);

    if (!rawValue) {
      return false;
    }

    const parsedValue = JSON.parse(rawValue) as { updatedAt?: unknown };
    const updatedAt = typeof parsedValue.updatedAt === 'number' ? parsedValue.updatedAt : 0;
    const isRecent = Date.now() - updatedAt <= DRAFT_MAX_AGE_MS;

    if (!isRecent) {
      clearWebUploadDraftPending();
    }

    return isRecent;
  } catch {
    clearWebUploadDraftPending();
    return false;
  }
}

export async function saveWebPdfDraft(file: File, metadata: WebPdfDraftMetadata = {}) {
  if (!canUseBrowserDraftStorage()) {
    return;
  }

  const mimeType = file.type || 'application/pdf';
  const storedDraft: StoredWebPdfDraft = {
    blob: new Blob([file], { type: mimeType }),
    fileName: file.name || `zenmo-${Date.now()}.pdf`,
    id: PDF_DRAFT_ID,
    lastModified: file.lastModified,
    mimeType,
    noteTitle: metadata.noteTitle,
    sizeBytes: file.size,
    subjectId: metadata.subjectId,
    updatedAt: Date.now(),
  };

  markWebUploadDraftPending('pdf-draft-saved');
  await writeStoredPdfDraft(storedDraft);
}

export async function updateWebPdfDraftMetadata(metadata: WebPdfDraftMetadata) {
  if (!canUseBrowserDraftStorage()) {
    return;
  }

  const existingDraft = await readStoredPdfDraft();

  if (!existingDraft) {
    return;
  }

  await writeStoredPdfDraft({
    ...existingDraft,
    noteTitle: metadata.noteTitle,
    subjectId: metadata.subjectId,
    updatedAt: Date.now(),
  });
}

export async function loadWebPdfDraft(): Promise<RestoredWebPdfDraft | null> {
  if (!canUseBrowserDraftStorage() || typeof File === 'undefined') {
    return null;
  }

  const draft = await readStoredPdfDraft();

  if (!draft) {
    clearWebUploadDraftPending();
    return null;
  }

  if (Date.now() - draft.updatedAt > DRAFT_MAX_AGE_MS) {
    await clearWebPdfDraft();
    return null;
  }

  const file = new File([draft.blob], draft.fileName, {
    lastModified: draft.lastModified ?? draft.updatedAt,
    type: draft.mimeType || 'application/pdf',
  });

  markWebUploadDraftPending('pdf-draft-restored');

  return {
    file,
    fileName: draft.fileName,
    mimeType: draft.mimeType,
    noteTitle: draft.noteTitle,
    sizeBytes: draft.sizeBytes,
    subjectId: draft.subjectId,
    updatedAt: draft.updatedAt,
  };
}

export async function clearWebPdfDraft() {
  clearWebUploadDraftPending();

  if (!canUseBrowserDraftStorage()) {
    return;
  }

  const db = await openDraftDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(PDF_DRAFT_ID);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}
