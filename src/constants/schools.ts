export type SchoolStatus = 'pending' | 'approved' | 'rejected';

export type SchoolOption = {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
};

export function normalizeSchoolName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function buildSchoolSlug(value: string) {
  return normalizeSchoolName(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
