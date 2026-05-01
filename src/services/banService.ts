import { supabase } from '../lib/supabase';
import { BANNED_ACCOUNT_MESSAGE } from '../lib/banGuard';

export async function ensureCurrentUserNotBanned() {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  const userId = authData.user?.id;

  if (!userId) {
    throw new Error('You must be signed in to continue.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('is_banned')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.is_banned) {
    throw new Error(BANNED_ACCOUNT_MESSAGE);
  }
}
