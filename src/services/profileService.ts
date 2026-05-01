import { supabase } from '../lib/supabase';
import { normalizeSectionId } from '../lib/normalizeSectionId';
import type { CompleteProfileInput, DmUser, UserProfile } from '../types';
import { ensureCurrentUserNotBanned } from './banService';

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  school_id: string | null;
  class_id: string | null;
  section_id: string | null;
  user_code: string | null;
  avatar_url: string | null;
  profile_edit_count: number | null;
  is_admin: boolean | null;
  is_banned: boolean | null;
  banned_at: string | null;
  banned_reason: string | null;
  created_at: string | null;
};

const extendedProfileSelect =
  'id, full_name, username, school_id, class_id, section_id, user_code, avatar_url, profile_edit_count, is_admin, is_banned, banned_at, banned_reason, created_at';
const legacyProfileSelect = 'id, full_name, school_id, class_id, section_id, created_at';

function normalizeClassId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '-');
}

function normalizeStoredSectionId(value: string | null) {
  return value?.trim().toUpperCase() ?? '';
}

function toAppError(error: unknown, fallbackMessage: string) {
  if (__DEV__) {
    console.error('[profileService]', fallbackMessage, error);
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

function mapDmProfileRow(row: ProfileRow): DmUser {
  return {
    id: row.id,
    fullName: row.full_name ?? 'Zenmo Student',
    username: row.username ?? 'zenmo-student',
    schoolId: row.school_id ?? '',
    classId: row.class_id ?? '',
    sectionId: normalizeStoredSectionId(row.section_id),
    userCode: row.user_code ?? '',
    avatarUrl: row.avatar_url ?? null,
  };
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    username: row.username ?? '',
    schoolId: row.school_id ?? '',
    classId: row.class_id ?? '',
    sectionId: normalizeStoredSectionId(row.section_id),
    userCode: row.user_code ?? '',
    avatarUrl: row.avatar_url ?? null,
    profileEditCount: Math.max(row.profile_edit_count ?? 0, 0),
    isAdmin: Boolean(row.is_admin),
    isBanned: Boolean(row.is_banned),
    bannedAt: row.banned_at ?? null,
    bannedReason: row.banned_reason ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function getProfileById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(extendedProfileSelect)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    const legacyResult = await supabase
      .from('profiles')
      .select(legacyProfileSelect)
      .eq('id', userId)
      .maybeSingle();

    if (legacyResult.error) {
      throw toAppError(error, 'Unable to load your profile right now.');
    }

    if (!legacyResult.data) {
      return null;
    }

    return mapProfileRow(legacyResult.data as ProfileRow);
  }

  if (!data) {
    return null;
  }

  return mapProfileRow(data as ProfileRow);
}

export async function upsertProfile(userId: string, input: CompleteProfileInput) {
  await ensureCurrentUserNotBanned();

  if (!userId.trim()) {
    throw new Error('You must be signed in to save your profile.');
  }

  const { data, error } = await supabase.rpc('save_profile_with_edit_limit', {
    profile_class_id: normalizeClassId(input.classLabel),
    profile_full_name: input.fullName.trim(),
    profile_school_id: input.schoolId.trim(),
    profile_section_id: normalizeSectionId(input.sectionId),
  });

  if (error) {
    throw toAppError(error, 'Unable to save your profile right now.');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Unable to save your profile right now.');
  }

  return mapProfileRow(row as ProfileRow);
}

export async function fetchClassmates(currentUserId: string, profile: UserProfile) {
  const { data, error } = await supabase
    .from('profiles')
    .select(extendedProfileSelect)
    .eq('school_id', profile.schoolId)
    .eq('class_id', profile.classId)
    .eq('section_id', profile.sectionId)
    .neq('id', currentUserId)
    .order('full_name', { ascending: true });

  if (error) {
    const legacyResult = await supabase
      .from('profiles')
      .select(legacyProfileSelect)
      .eq('school_id', profile.schoolId)
      .eq('class_id', profile.classId)
      .eq('section_id', profile.sectionId)
      .neq('id', currentUserId)
      .order('full_name', { ascending: true });

    if (legacyResult.error) {
      throw toAppError(legacyResult.error, 'Unable to load classmates right now.');
    }

    return (legacyResult.data ?? []).map((row) => mapDmProfileRow(row as ProfileRow));
  }

  return (data ?? []).map((row) => mapDmProfileRow(row as ProfileRow));
}

export async function findProfileByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  const { data, error } = await supabase.rpc('find_profile_by_code', {
    search_code: normalizedCode,
  });

  if (error) {
    throw toAppError(error, 'Unable to search that code right now.');
  }

  const row = Array.isArray(data) ? data[0] : null;

  if (!row) {
    return null;
  }

  return mapDmProfileRow(row as ProfileRow);
}

export async function getMessageableProfileById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(extendedProfileSelect)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    const legacyResult = await supabase
      .from('profiles')
      .select(legacyProfileSelect)
      .eq('id', userId)
      .maybeSingle();

    if (legacyResult.error) {
      throw toAppError(legacyResult.error, 'Unable to load this profile right now.');
    }

    if (!legacyResult.data) {
      return null;
    }

    return mapDmProfileRow(legacyResult.data as ProfileRow);
  }

  if (!data) {
    return null;
  }

  return mapDmProfileRow(data as ProfileRow);
}
