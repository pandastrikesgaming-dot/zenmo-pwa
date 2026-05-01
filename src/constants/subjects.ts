import { colors } from '../theme';

export const fixedSubjects = [
  'Maths',
  'Physics',
  'Chemistry',
  'Biology',
  'Science',
  'English',
  'Hindi',
  'Kannada',
  'SST',
  'General',
] as const;

export type FixedSubject = (typeof fixedSubjects)[number];

export const subjectAccentMap: Record<FixedSubject, string> = {
  Maths: colors.accentBlue,
  Physics: colors.primary,
  Chemistry: colors.accentYellow,
  Biology: colors.primarySoft,
  Science: colors.accentBlue,
  English: colors.primarySoft,
  Hindi: colors.primary,
  Kannada: colors.accentYellow,
  SST: colors.primarySoft,
  General: colors.primary,
};

export function getSubjectAccentColor(subject: string) {
  return subjectAccentMap[subject as FixedSubject] ?? colors.primary;
}
