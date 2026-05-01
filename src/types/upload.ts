export type UploadFileType = 'image' | 'pdf' | 'multi_image';

export type UploadActionType = 'camera' | 'gallery' | 'pdf';

export type UploadSubject = {
  id: string;
  label: string;
  accentColor: string;
};

export type PageImage = {
  id: string;
  uri: string;
  name?: string;
  mimeType: string;
  sizeBytes?: number;
};

export type UploadProgressPhase = 'compressing' | 'uploading' | 'saving';

export type UploadDraftFile = {
  id: string;
  name: string;
  type: UploadFileType;
  source: UploadActionType;
  uri: string;
  mimeType: string;
  previewUri?: string;
  pageCount?: number;
  sizeLabel?: string;
  sizeBytes?: number;
};
