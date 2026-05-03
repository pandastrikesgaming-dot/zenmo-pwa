import { type PropsWithChildren, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { useAuth } from '../hooks';
import { navigateToRequestDetail, navigateToRequestsFeed } from '../lib/navigationRef';
import { registerPushToken, updatePushToken } from '../services';
import type { PushTokenPlatform } from '../types';

const fallbackProjectId = '391f5cc1-dbfc-4357-8977-e655ecc16758';

function logNotificationBootstrap(step: string, payload?: Record<string, unknown>) {
  if (__DEV__) {
    console.log('[notifications]', step, payload ?? {});
  }
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    fallbackProjectId
  );
}

async function isPhysicalDevice() {
  try {
    const Device = await import('expo-device');
    return Boolean(Device.isDevice);
  } catch (error) {
    logNotificationBootstrap('device-check-error', {
      message: error instanceof Error ? error.message : 'Unable to detect device type',
    });
    return false;
  }
}

function getRequestIdFromData(data: unknown) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const maybeRequestId = (data as { requestId?: unknown }).requestId;
  return typeof maybeRequestId === 'string' && maybeRequestId.trim() ? maybeRequestId : null;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  const Notifications = await import('expo-notifications');

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF922B',
  });
}

async function requestExpoPushTokenAsync() {
  const isDevice = await isPhysicalDevice();
  const Notifications = await import('expo-notifications');

  await ensureAndroidChannel();

  if (!isDevice) {
    logNotificationBootstrap('skip-device', { reason: 'physical device required' });
    return null;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    logNotificationBootstrap('permission-denied', { finalStatus });
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId: getProjectId(),
  });

  return tokenResponse.data;
}

function getPlatform(): PushTokenPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function handleNotificationNavigation(data: unknown) {
  const requestId = getRequestIdFromData(data);

  if (requestId) {
    navigateToRequestDetail(requestId);
    return;
  }

  navigateToRequestsFeed();
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { profile, user } = useAuth();
  const attemptedRegistrationForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !profile || Platform.OS !== 'web') {
      return;
    }

    const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!VAPID_PUBLIC_KEY) return;

    void (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          return;
        }

        const permission = await window.Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY
          });
        }

        const subJson = subscription.toJSON();
        const subStr = JSON.stringify(subJson);
        const cacheKey = `zenmo_push_sub_${user.id}`;
        
        if (localStorage.getItem(cacheKey) === subStr) {
          return;
        }

        const { supabase } = await import('../lib/supabase');
        const { error: insertError } = await supabase.from('push_subscriptions').insert({
          user_id: user.id,
          subscription: subJson,
        });
        
        if (insertError) {
          console.error('[web-push] Failed to save subscription to Supabase:', insertError);
          return;
        }
        
        localStorage.setItem(cacheKey, subStr);
      } catch (error) {
        logNotificationBootstrap('web-push-error', {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  }, [profile, user?.id]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const isDevice = await isPhysicalDevice();

        if (!isDevice) {
          logNotificationBootstrap('handler-skipped', { reason: 'non-physical device' });
          return;
        }

        const Notifications = await import('expo-notifications');

        if (cancelled) {
          return;
        }

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        logNotificationBootstrap('handler-ready');
      } catch (error) {
        logNotificationBootstrap('handler-error', {
          message: error instanceof Error ? error.message : 'Unable to initialize notifications module',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !profile) {
      attemptedRegistrationForUserId.current = null;
      return;
    }

    if (attemptedRegistrationForUserId.current === user.id) {
      return;
    }

    attemptedRegistrationForUserId.current = user.id;

    void (async () => {
      try {
        logNotificationBootstrap('register:start', { userId: user.id });
        const expoPushToken = await requestExpoPushTokenAsync();

        if (!expoPushToken) {
          return;
        }

        await registerPushToken({
          userId: user.id,
          expoPushToken,
          platform: getPlatform(),
        });

        logNotificationBootstrap('register:success', { userId: user.id });
      } catch (error) {
        logNotificationBootstrap('register:error', {
          message: error instanceof Error ? error.message : 'Unknown notification registration error',
        });
      }
    })();
  }, [profile, user?.id]);

  useEffect(() => {
    let cancelled = false;
    let responseSubscription: { remove: () => void } | null = null;
    let pushTokenSubscription: { remove: () => void } | null = null;

    void (async () => {
      try {
        const isDevice = await isPhysicalDevice();

        if (!isDevice) {
          logNotificationBootstrap('listeners-skipped', { reason: 'non-physical device' });
          return;
        }

        const Notifications = await import('expo-notifications');

        if (cancelled) {
          return;
        }

        const response = await Notifications.getLastNotificationResponseAsync();

        if (!cancelled && response) {
          handleNotificationNavigation(response.notification.request.content.data);
        }

        responseSubscription = Notifications.addNotificationResponseReceivedListener((nextResponse) => {
          handleNotificationNavigation(nextResponse.notification.request.content.data);
        });

        pushTokenSubscription = Notifications.addPushTokenListener((token) => {
          if (!user?.id) {
            return;
          }

          void updatePushToken({
            userId: user.id,
            expoPushToken: token.data,
            platform: getPlatform(),
          }).catch((error) => {
            logNotificationBootstrap('token-refresh:error', {
              message: error instanceof Error ? error.message : 'Unknown push token refresh error',
            });
          });
        });

        logNotificationBootstrap('listeners-ready');
      } catch (error) {
        logNotificationBootstrap('listeners-error', {
          message: error instanceof Error ? error.message : 'Unable to start notification listeners',
        });
      }
    })();

    return () => {
      cancelled = true;
      responseSubscription?.remove();
      pushTokenSubscription?.remove();
    };
  }, [user?.id]);

  return children;
}
