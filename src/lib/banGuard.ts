import type { UserProfile } from '../types';

export const BANNED_ACCOUNT_MESSAGE =
  'Your account has been restricted due to policy violations.';

export function checkIfBanned(profile?: Pick<UserProfile, 'isBanned'> | null) {
  if (profile?.isBanned) {
    throw new Error(BANNED_ACCOUNT_MESSAGE);
  }
}
