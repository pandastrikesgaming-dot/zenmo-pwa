import { buildSchoolSlug, normalizeSchoolName, type SchoolOption } from '../constants/schools';
import { supabase } from '../lib/supabase';

type SchoolRow = {
  id: string;
  name: string | null;
  slug: string | null;
  status: 'pending' | 'approved' | 'rejected' | null;
};

type RequestSchoolInput = {
  name: string;
  userId: string;
  approvedSchools?: SchoolOption[];
};

type RequestSchoolResult =
  | { type: 'created'; slug: string; name: string }
  | { type: 'existing-approved'; school: SchoolOption }
  | { type: 'existing-pending' }
  | { type: 'duplicate' };

function mapSchoolRow(row: SchoolRow): SchoolOption {
  return {
    id: row.id,
    name: row.name?.trim() || 'Unnamed School',
    slug: row.slug?.trim() || '',
    status: row.status ?? 'pending',
  };
}

function isDuplicateError(message: string) {
  return /duplicate key|unique constraint/i.test(message);
}

function logSupabaseError(context: string, error: unknown) {
  if (!error || typeof error !== 'object') {
    console.error(`[schoolsService] ${context}`, error);
    return;
  }

  const candidate = error as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  console.error(`[schoolsService] ${context}`, {
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    details: typeof candidate.details === 'string' ? candidate.details : undefined,
    hint: typeof candidate.hint === 'string' ? candidate.hint : undefined,
  });
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return null;
}

export async function fetchApprovedSchools() {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, slug, status')
    .eq('status', 'approved')
    .order('name', { ascending: true });

  if (error) {
    logSupabaseError('fetchApprovedSchools failed', error);
    throw error;
  }

  return (data ?? []).map((row) => mapSchoolRow(row as SchoolRow));
}

export async function fetchSchoolBySlug(slug: string) {
  if (!slug.trim()) {
    return null;
  }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (error) {
    logSupabaseError('fetchSchoolBySlug failed', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapSchoolRow(data as SchoolRow);
}

export async function requestSchoolApproval(input: RequestSchoolInput): Promise<RequestSchoolResult> {
  const normalizedName = normalizeSchoolName(input.name);
  const slug = buildSchoolSlug(normalizedName);

  if (!normalizedName || !slug) {
    throw new Error('Enter a valid school name to request approval.');
  }

  const localMatch = (input.approvedSchools ?? []).find(
    (school) =>
      school.slug === slug || school.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (localMatch) {
    return {
      type: 'existing-approved',
      school: localMatch,
    };
  }

  const insertPayload = {
    name: normalizedName,
    slug,
    status: 'pending' as const,
    created_by: input.userId,
  };

  const { error } = await supabase
    .from('schools')
    .insert(insertPayload);

  if (error) {
    logSupabaseError('requestSchoolApproval insert failed', error);

    if (isDuplicateError(error.message)) {
      const approvedSchool = await fetchSchoolBySlug(slug);

      if (approvedSchool) {
        return {
          type: 'existing-approved',
          school: approvedSchool,
        };
      }

      return {
        type: 'existing-pending',
      };
    }

    const message = getSupabaseErrorMessage(error);
    throw new Error(message ?? 'Unable to submit a school request right now.');
  }

  return {
    type: 'created',
    slug,
    name: normalizedName,
  };
}
