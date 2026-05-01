import type { UploadFileType } from './upload';

export type SubjectSummary = {
  id: string;
  name: string;
  noteCount: number;
  accentColor: string;
};

export type RecentNote = {
  id: string;
  title: string;
  subject: string;
  fileType: UploadFileType;
  fileUrl: string;
  storagePath: string | null;
  userId: string;
  userName: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  date: string;
  uploadedAt: string;
  pages: number;
  accentColor: string;
};

export type NotePage = {
  id: string;
  pageNumber: number;
  imageUrl: string;
};
