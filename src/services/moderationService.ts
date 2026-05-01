import { supabase } from '../lib/supabase';
import type {
  AdminNoteReport,
  NoteReportStatus,
  SubmitNoteReportInput,
  UploadFileType,
} from '../types';

type AdminReportRow = {
  id: string;
  note_id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: NoteReportStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  note_title: string | null;
  note_subject: string | null;
  note_file_type: UploadFileType | null;
  note_file_url: string | null;
  note_pages: number | null;
  note_school_id: string | null;
  note_class_id: string | null;
  note_section_id: string | null;
  note_uploaded_at: string | null;
  reporter_name: string | null;
  reported_user_name: string | null;
  reported_user_is_banned: boolean | null;
};

function toModerationError(error: unknown, fallbackMessage: string) {
  if (__DEV__) {
    console.error('[moderationService]', fallbackMessage, error);
  }

  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  ) {
    return new Error("You've already reported this note.");
  }

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

function mapAdminReportRow(row: AdminReportRow): AdminNoteReport {
  const uploadedAt = row.note_uploaded_at ?? row.created_at;

  return {
    id: row.id,
    noteId: row.note_id,
    reporterId: row.reporter_id,
    reportedUserId: row.reported_user_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    note: {
      id: row.note_id,
      title: row.note_title ?? 'Untitled note',
      subject: row.note_subject ?? 'General',
      fileType: row.note_file_type ?? 'image',
      fileUrl: row.note_file_url ?? '',
      storagePath: null,
      userId: row.reported_user_id,
      userName: row.reported_user_name ?? 'Zenmo Student',
      schoolId: row.note_school_id ?? '',
      classId: row.note_class_id ?? '',
      sectionId: row.note_section_id ?? '',
      date: uploadedAt,
      uploadedAt,
      pages: row.note_pages ?? 1,
      accentColor: '#FF8A1F',
    },
    reporterName: row.reporter_name ?? 'Zenmo Student',
    reportedUserName: row.reported_user_name ?? 'Zenmo Student',
    reportedUserIsBanned: Boolean(row.reported_user_is_banned),
  };
}

export async function submitNoteReport(input: SubmitNoteReportInput) {
  const { error } = await supabase.from('note_reports').insert({
    note_id: input.noteId,
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId,
    reason: input.reason,
    details: input.details?.trim() || null,
  });

  if (error) {
    throw toModerationError(error, 'Unable to submit this report right now.');
  }
}

export async function fetchAdminNoteReports() {
  const { data, error } = await supabase.rpc('admin_get_note_reports');

  if (error) {
    throw toModerationError(error, 'Unable to load reports right now.');
  }

  return ((data ?? []) as AdminReportRow[]).map(mapAdminReportRow);
}

export async function updateAdminReportStatus(reportId: string, status: NoteReportStatus) {
  const { error } = await supabase.rpc('admin_update_report_status', {
    target_report_id: reportId,
    next_status: status,
  });

  if (error) {
    throw toModerationError(error, 'Unable to update this report right now.');
  }
}

export async function setAdminUserBan(userId: string, shouldBan: boolean, reason?: string) {
  const { error } = await supabase.rpc('admin_set_user_ban', {
    target_user_id: userId,
    should_ban: shouldBan,
    reason: reason?.trim() || null,
  });

  if (error) {
    throw toModerationError(error, 'Unable to update this user restriction right now.');
  }
}
