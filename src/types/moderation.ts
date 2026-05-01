import type { RecentNote } from './home';

export type NoteReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';

export type NoteReportReason =
  | 'Inappropriate content'
  | 'Spam'
  | 'Misleading / wrong note'
  | 'Harassment'
  | 'Other';

export type SubmitNoteReportInput = {
  noteId: string;
  reporterId: string;
  reportedUserId: string;
  reason: NoteReportReason;
  details?: string;
};

export type AdminNoteReport = {
  id: string;
  noteId: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details: string | null;
  status: NoteReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  note: RecentNote;
  reporterName: string;
  reportedUserName: string;
  reportedUserIsBanned: boolean;
};
