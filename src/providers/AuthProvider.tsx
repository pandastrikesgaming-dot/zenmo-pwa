import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';
import { getProfileById, upsertProfile } from '../services';
import type { CompleteProfileInput, UserProfile } from '../types';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeProfile: (input: CompleteProfileInput) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const nativeRedirectTo = 'zenmo://auth/callback';
const authCallbackParamNames = new Set([
  'access_token',
  'code',
  'error',
  'error_code',
  'error_description',
  'expires_at',
  'expires_in',
  'provider_refresh_token',
  'provider_token',
  'refresh_token',
  'token_type',
  'type',
]);
const sensitiveAuthParamNames = new Set([
  'access_token',
  'code',
  'id_token',
  'provider_refresh_token',
  'provider_token',
  'refresh_token',
]);

function getWebRedirectTo() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  throw new Error('Unable to determine this browser origin for Google sign-in.');
}

function getRedirectTo() {
  return Platform.OS === 'web' ? getWebRedirectTo() : nativeRedirectTo;
}

function logStartup(step: string, payload?: Record<string, unknown>) {
  if (__DEV__) {
    console.log('[startup][AuthProvider]', step, payload ?? {});
  }
}

function logOAuth(step: string, payload?: Record<string, unknown>) {
  console.log('[auth][oauth]', step, payload ?? {});
}

function getCurrentWebUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  return window.location.href;
}

function createUrlFromString(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return new URL(url, window.location.origin);
  }

  return new URL(url);
}

function getAuthParamsFromUrl(url: string) {
  const params = new URLSearchParams();

  try {
    const parsedUrl = createUrlFromString(url);

    parsedUrl.searchParams.forEach((value, key) => {
      params.set(key, value);
    });

    if (parsedUrl.hash) {
      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

      hashParams.forEach((value, key) => {
        params.set(key, value);
      });
    }
  } catch {
    return params;
  }

  return params;
}

function hasAuthCallbackParams(url: string) {
  const params = getAuthParamsFromUrl(url);

  return Array.from(authCallbackParamNames).some((paramName) => params.has(paramName));
}

function redactAuthUrlForLog(url: string) {
  try {
    const parsedUrl = createUrlFromString(url);

    sensitiveAuthParamNames.forEach((paramName) => {
      if (parsedUrl.searchParams.has(paramName)) {
        parsedUrl.searchParams.set(paramName, 'redacted');
      }
    });

    if (parsedUrl.hash) {
      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      let redactedHash = false;

      sensitiveAuthParamNames.forEach((paramName) => {
        if (hashParams.has(paramName)) {
          hashParams.set(paramName, 'redacted');
          redactedHash = true;
        }
      });

      if (redactedHash) {
        parsedUrl.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
      }
    }

    return parsedUrl.toString();
  } catch {
    return url.replace(
      /(access_token|code|id_token|provider_refresh_token|provider_token|refresh_token)=([^&#]+)/gi,
      '$1=redacted'
    );
  }
}

function clearWebAuthCallbackFromUrl(url: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history?.replaceState) {
    return;
  }

  try {
    const parsedUrl = createUrlFromString(url);

    authCallbackParamNames.forEach((paramName) => {
      parsedUrl.searchParams.delete(paramName);
    });

    if (parsedUrl.hash) {
      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      let removedAuthParam = false;

      authCallbackParamNames.forEach((paramName) => {
        if (hashParams.has(paramName)) {
          hashParams.delete(paramName);
          removedAuthParam = true;
        }
      });

      if (removedAuthParam) {
        parsedUrl.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
      }
    }

    window.history.replaceState(
      window.history.state,
      '',
      `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/'
    );
  } catch {
    window.history.replaceState(window.history.state, '', window.location.pathname || '/');
  }
}

function summarizeSession(nextSession: Session | null) {
  return {
    email: nextSession?.user?.email ?? null,
    expiresAt: nextSession?.expires_at ?? null,
    hasSession: Boolean(nextSession),
    userId: nextSession?.user?.id ?? null,
  };
}

async function createSessionFromUrl(url: string) {
  const params = getAuthParamsFromUrl(url);
  const errorCode = params.get('error_code') ?? params.get('error');
  const errorDescription = params.get('error_description');

  if (errorCode) {
    throw new Error(errorDescription ?? errorCode);
  }

  const code = params.get('code');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return data.session;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  function applySession(nextSession: Session | null) {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }

  async function refreshProfileForUser(userId: string) {
    logStartup('refreshProfileForUser:start', { userId });
    setProfileLoading(true);

    try {
      const nextProfile = await getProfileById(userId);
      setProfile(nextProfile);
      logStartup('refreshProfileForUser:success', {
        hasProfile: Boolean(nextProfile),
        userId,
      });
    } finally {
      setProfileLoading(false);
    }
  }

  async function syncSessionAndProfile(nextSession: Session | null) {
    logStartup('syncSessionAndProfile:start', {
      hasSession: Boolean(nextSession),
      userId: nextSession?.user?.id ?? null,
    });
    applySession(nextSession);

    if (!nextSession?.user?.id) {
      setProfile(null);
      logStartup('syncSessionAndProfile:no-session');
      return;
    }

    await refreshProfileForUser(nextSession.user.id);
    logStartup('syncSessionAndProfile:done', {
      userId: nextSession.user.id,
    });
  }

  async function refreshProfile() {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    await refreshProfileForUser(user.id);
  }

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      logStartup('restoreSession:start');
      try {
        let restoredSession: Session | null = null;
        const currentWebUrl = getCurrentWebUrl();

        if (currentWebUrl) {
          logOAuth('current URL after redirect', {
            hasAuthCallback: hasAuthCallbackParams(currentWebUrl),
            url: redactAuthUrlForLog(currentWebUrl),
          });

          if (hasAuthCallbackParams(currentWebUrl)) {
            try {
              restoredSession = await createSessionFromUrl(currentWebUrl);
            } finally {
              clearWebAuthCallbackFromUrl(currentWebUrl);
            }
          }
        } else {
          const initialUrl = await Linking.getInitialURL();

          logStartup('restoreSession:initialUrl', {
            hasInitialUrl: Boolean(initialUrl),
          });

          if (initialUrl) {
            const callbackSession = await createSessionFromUrl(initialUrl);

            restoredSession = callbackSession ?? null;
          }
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        const nextSession = restoredSession ?? data.session;

        logOAuth('auth session after app load', summarizeSession(nextSession));
        await syncSessionAndProfile(nextSession);
        logStartup('restoreSession:completed', {
          hasSession: Boolean(nextSession),
        });
      } catch (error) {
        logOAuth('auth session after app load', {
          error: error instanceof Error ? error.message : 'Unknown auth restore error',
          hasSession: false,
        });
        logStartup('restoreSession:error', {
          message: error instanceof Error ? error.message : 'Unknown auth restore error',
        });
      } finally {
        if (isMounted) {
          setSessionLoading(false);
          setInitializing(false);
          logStartup('restoreSession:finalized', {
            initializing: false,
            sessionLoading: false,
          });
        }
      }
    };

    void restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      logStartup('onAuthStateChange', {
        event,
        hasSession: Boolean(nextSession),
      });

      if (!isMounted) {
        return;
      }

      if (event === 'SIGNED_OUT') {
        applySession(null);
        setProfile(null);
        setInitializing(false);
        setSessionLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        setInitializing(true);

        void syncSessionAndProfile(nextSession)
          .finally(() => {
            if (isMounted) {
              setInitializing(false);
              setSessionLoading(false);
            }
          });
        return;
      }

      applySession(nextSession);
      setSessionLoading(false);
    });

    const linkingSubscription =
      Platform.OS !== 'web'
        ? Linking.addEventListener('url', ({ url }) => {
            logStartup('linking:url', { url });
            void createSessionFromUrl(url)
              .then((callbackSession) => {
                if (callbackSession && isMounted) {
                  setInitializing(true);

                  void syncSessionAndProfile(callbackSession)
                    .finally(() => {
                      if (isMounted) {
                        setInitializing(false);
                      }
                    });
                }
              })
              .catch((error) => {
                logStartup('linking:error', {
                  message: error instanceof Error ? error.message : 'Unknown linking error',
                });
                // The screen-level action surfaces the auth error state.
              });
          })
        : null;

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      linkingSubscription?.remove();
    };
  }, []);

  async function signInWithGoogle() {
    const redirectTo = getRedirectTo();

    logOAuth('redirectTo before signInWithOAuth', {
      platform: Platform.OS,
      redirectTo,
    });

    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        throw error;
      }

      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('Supabase did not return an OAuth URL.');
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success') {
      const callbackSession = await createSessionFromUrl(result.url);

      if (callbackSession) {
        setInitializing(true);

        try {
          await syncSessionAndProfile(callbackSession);
        } finally {
          setInitializing(false);
        }
      }
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  async function completeProfile(input: CompleteProfileInput) {
    if (!user?.id) {
      throw new Error('You must be signed in to complete your profile.');
    }

    setProfileLoading(true);

    try {
      const nextProfile = await upsertProfile(user.id, input);
      setProfile(nextProfile);
      return nextProfile;
    } finally {
      setProfileLoading(false);
    }
  }

  const loading = profileLoading;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      initializing,
      loading,
      signInWithGoogle,
      signOut,
      completeProfile,
      refreshProfile,
    }),
    [initializing, loading, profile, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
