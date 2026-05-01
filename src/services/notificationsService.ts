import { supabase } from '../lib/supabase';
import type {
  RegisterPushTokenInput,
  TriggerRequestNotificationInput,
} from '../types';

async function logNotificationError(context: string, error: unknown) {
  if (__DEV__) {
    if (
      error &&
      typeof error === 'object' &&
      'context' in error &&
      error.context instanceof Response
    ) {
      const response = error.context as Response;
      let responseBody = '';

      try {
        responseBody = await response.clone().text();
      } catch {
        responseBody = '[unable to read response body]';
      }

      console.error(`[notificationsService] ${context}`, {
        message: error instanceof Error ? error.message : String(error),
        responseBody,
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    console.error(`[notificationsService] ${context}`, error);
  }
}

export async function registerPushToken(input: RegisterPushTokenInput) {
  const payload = {
    user_id: input.userId,
    expo_push_token: input.expoPushToken,
    platform: input.platform,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('push_tokens').upsert(payload, {
    onConflict: 'expo_push_token',
  });

  if (error) {
    await logNotificationError('registerPushToken', error);
    throw error;
  }
}

export async function updatePushToken(input: RegisterPushTokenInput) {
  await registerPushToken(input);
}

async function triggerRequestNotification(
  eventType: 'created' | 'fulfilled',
  input: TriggerRequestNotificationInput
) {
  const { data, error } = await supabase.functions.invoke('send-request-push', {
    body: {
      eventType,
      requestId: input.requestId,
    },
  });

  if (error) {
    await logNotificationError(`triggerRequestNotification:${eventType}`, error);
    throw error;
  }

  return data;
}

export async function triggerRequestCreatedNotification(input: TriggerRequestNotificationInput) {
  return triggerRequestNotification('created', input);
}

export async function triggerRequestFulfilledNotification(input: TriggerRequestNotificationInput) {
  return triggerRequestNotification('fulfilled', input);
}
