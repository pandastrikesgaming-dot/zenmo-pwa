import { getSubjectAccentColor } from '../constants/subjects';
import { isValidSection, normalizeSectionId } from '../lib/normalizeSectionId';
import { supabase } from '../lib/supabase';
import { ensureCurrentUserNotBanned } from './banService';
import type {
  CreateNoteRequestInput,
  DeleteOwnedNoteRequestInput,
  FetchNoteRequestByIdInput,
  FetchScopedNoteRequestsInput,
  MarkRequestFulfilledInput,
  NoteRequest,
  NoteRequestStatus,
  UpdateOwnedNoteRequestStatusInput,
} from '../types';

type NoteRequestRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  school_id: string | null;
  class_id: string | null;
  section_id: string | null;
  subject: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  fulfilled_by_user_id: string | null;
  fulfilled_by_note_id: string | null;
  fulfilled_at: string | null;
};

const requestSelectFields =
  'id, user_id, user_name, school_id, class_id, section_id, subject, title, description, status, created_at, fulfilled_by_user_id, fulfilled_by_note_id, fulfilled_at';

function normalizeStatus(value: string | null): NoteRequestStatus {
  if (value === 'fulfilled' || value === 'closed') {
    return value;
  }

  return 'open';
}

function formatRequestTimestamp(value: string | null) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mapNoteRequestRow(row: NoteRequestRow): NoteRequest {
  const subject = row.subject?.trim() || 'General';

  return {
    id: row.id,
    userId: row.user_id ?? '',
    userName: row.user_name?.trim() || 'Unknown',
    schoolId: row.school_id ?? '',
    classId: row.class_id ?? '',
    sectionId: normalizeSectionId(row.section_id ?? ''),
    subject,
    title: row.title?.trim() || 'Untitled request',
    description: row.description?.trim() || '',
    status: normalizeStatus(row.status),
    createdAt: row.created_at ?? new Date().toISOString(),
    createdLabel: formatRequestTimestamp(row.created_at),
    fulfilledByUserId: row.fulfilled_by_user_id ?? null,
    fulfilledByNoteId: row.fulfilled_by_note_id ?? null,
    fulfilledAt: row.fulfilled_at ?? null,
    fulfilledLabel: row.fulfilled_at ? formatRequestTimestamp(row.fulfilled_at) : null,
    accentColor: getSubjectAccentColor(subject),
  };
}

export async function createNoteRequest(input: CreateNoteRequestInput) {
  await ensureCurrentUserNotBanned();

  if (!isValidSection(input.sectionId)) {
    throw new Error('Please update your section (A-Z) in profile');
  }

  const payload = {
    user_id: input.userId,
    user_name: input.userName.trim() || 'Unknown',
    school_id: input.schoolId.trim(),
    class_id: input.classId.trim(),
    section_id: normalizeSectionId(input.sectionId),
    subject: input.subject.trim(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: 'open' as const,
  };

  const { data, error } = await supabase
    .from('note_requests')
    .insert(payload)
    .select(requestSelectFields)
    .single();

  if (error) {
    throw error;
  }

  return mapNoteRequestRow(data as NoteRequestRow);
}

export async function fetchScopedNoteRequests(input: FetchScopedNoteRequestsInput) {
  if (!isValidSection(input.sectionId)) {
    return [];
  }

  let query = supabase
    .from('note_requests')
    .select(requestSelectFields)
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('section_id', normalizeSectionId(input.sectionId))
    .order('created_at', { ascending: false });

  if (input.status) {
    query = query.eq('status', input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapNoteRequestRow(row as NoteRequestRow));
}

export async function fetchOpenScopedNoteRequests(input: Omit<FetchScopedNoteRequestsInput, 'status'>) {
  return fetchScopedNoteRequests({
    ...input,
    status: 'open',
  });
}

export async function fetchFulfilledScopedNoteRequests(
  input: Omit<FetchScopedNoteRequestsInput, 'status'>
) {
  return fetchScopedNoteRequests({
    ...input,
    status: 'fulfilled',
  });
}

export async function fetchMyNoteRequests(userId: string) {
  const { data, error } = await supabase
    .from('note_requests')
    .select(requestSelectFields)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapNoteRequestRow(row as NoteRequestRow));
}

export async function fetchNoteRequestById(input: FetchNoteRequestByIdInput) {
  if (!isValidSection(input.sectionId)) {
    return null;
  }

  const { data, error } = await supabase
    .from('note_requests')
    .select(requestSelectFields)
    .eq('id', input.requestId)
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('section_id', normalizeSectionId(input.sectionId))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapNoteRequestRow(data as NoteRequestRow);
}

export async function updateOwnedNoteRequestStatus(input: UpdateOwnedNoteRequestStatusInput) {
  const { data, error } = await supabase
    .from('note_requests')
    .update({ status: input.status })
    .eq('id', input.requestId)
    .eq('user_id', input.userId)
    .select(requestSelectFields)
    .single();

  if (error) {
    throw error;
  }

  return mapNoteRequestRow(data as NoteRequestRow);
}

export async function markRequestFulfilled(input: MarkRequestFulfilledInput) {
  const { data, error } = await supabase.rpc('fulfill_note_request', {
    target_request_id: input.requestId,
    target_note_id: input.noteId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Unable to fulfill this request right now.');
  }

  return mapNoteRequestRow(data as NoteRequestRow);
}

export async function deleteOwnedNoteRequest(input: DeleteOwnedNoteRequestInput) {
  const { error } = await supabase
    .from('note_requests')
    .delete()
    .eq('id', input.requestId)
    .eq('user_id', input.userId);

  if (error) {
    throw error;
  }
}
