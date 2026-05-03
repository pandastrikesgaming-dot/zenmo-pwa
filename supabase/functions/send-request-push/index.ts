// @ts-nocheck
import webpush from 'npm:web-push';
import { createClient } from 'npm:@supabase/supabase-js@2';

type RequestNotificationEventType = 'created' | 'fulfilled';

type NoteRequestRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  school_id: string;
  class_id: string;
  section_id: string;
  subject: string;
  title: string;
  status: 'open' | 'fulfilled' | 'closed';
  fulfilled_by_user_id: string | null;
  fulfilled_by_note_id: string | null;
  fulfilled_at: string | null;
};

type PushTokenRow = {
  expo_push_token: string;
  user_id: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? Deno.env.get('EXPO_PUBLIC_VAPID_KEY') ?? '';
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isValidExpoPushToken(token: string) {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

function buildNotificationContent(eventType: RequestNotificationEventType, request: NoteRequestRow) {
  if (eventType === 'fulfilled') {
    return {
      title: 'Your request was fulfilled',
      body: `${request.subject}: ${request.title} has been answered`,
    };
  }
  if (eventType === 'test') {
    return {
      title: 'Test Web Push Successful!',
      body: 'Your PWA push notifications are working perfectly.',
    };
  }

  return {
    title: 'New note request',
    body: `${request.subject}: ${request.title}`,
  };
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizeExpoResponseData(data: unknown) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data) {
    return [data];
  }

  return [];
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment configuration' });
  }

  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    return jsonResponse(401, { error: 'Authorization required' });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const jwt = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!jwt) {
    return jsonResponse(401, { error: 'Bearer token required' });
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(jwt);

  if (userError || !user) {
    return jsonResponse(401, {
      error: userError?.message ?? 'Unable to verify the authenticated user',
    });
  }

  let payload: { eventType?: RequestNotificationEventType; requestId?: string };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!payload.requestId || (payload.eventType !== 'created' && payload.eventType !== 'fulfilled' && payload.eventType !== 'test')) {
    return jsonResponse(400, { error: 'requestId and valid eventType are required' });
  }

  let typedRequest: NoteRequestRow = {
    id: 'test-id',
    user_id: user.id,
    user_name: 'Test User',
    school_id: 'test',
    class_id: 'test',
    section_id: 'test',
    subject: 'System Test',
    title: 'Notification Test',
    status: 'open',
    fulfilled_by_user_id: null,
    fulfilled_by_note_id: null,
    fulfilled_at: null
  };

  if (payload.eventType !== 'test') {
    const { data: noteRequest, error: noteRequestError } = await adminClient
      .from('note_requests')
      .select(
        'id, user_id, user_name, school_id, class_id, section_id, subject, title, status, fulfilled_by_user_id, fulfilled_by_note_id, fulfilled_at'
      )
      .eq('id', payload.requestId)
      .maybeSingle();

    if (noteRequestError) {
      console.error('[send-request-push] request lookup failed', noteRequestError);
      return jsonResponse(500, { error: 'Unable to load request details' });
    }

    if (!noteRequest) {
      return jsonResponse(404, { error: 'Request not found' });
    }
    
    typedRequest = noteRequest as NoteRequestRow;
  }

  if (payload.eventType === 'created' && typedRequest.user_id !== user.id) {
    return jsonResponse(403, { error: 'Only the requester can send created notifications' });
  }

  if (payload.eventType === 'fulfilled') {
    if (typedRequest.status !== 'fulfilled') {
      return jsonResponse(409, { error: 'Only fulfilled requests can trigger fulfilled notifications' });
    }

    if (typedRequest.fulfilled_by_user_id !== user.id) {
      return jsonResponse(403, { error: 'Only the fulfiller can send fulfilled notifications' });
    }
  }

  let recipientUserIds: string[] = [];

  if (payload.eventType === 'test') {
    recipientUserIds = [user.id]; // Test pushes go directly to the person who triggered it
  } else if (payload.eventType === 'created') {
    const { data: scopedProfiles, error: scopedProfilesError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('school_id', typedRequest.school_id)
      .eq('class_id', typedRequest.class_id)
      .eq('section_id', typedRequest.section_id)
      .neq('id', typedRequest.user_id);

    if (scopedProfilesError) {
      console.error('[send-request-push] scoped profile lookup failed', scopedProfilesError);
      return jsonResponse(500, { error: 'Unable to resolve classmates for this request' });
    }

    recipientUserIds = (scopedProfiles ?? [])
      .map((profile) => (profile as { id?: string }).id)
      .filter((value): value is string => Boolean(value));
  } else {
    recipientUserIds = typedRequest.user_id ? [typedRequest.user_id] : [];
  }

  if (recipientUserIds.length === 0) {
    return jsonResponse(200, {
      sentCount: 0,
      skippedCount: 0,
      message: 'No eligible recipients found',
    });
  }

  const { data: pushTokens, error: pushTokensError } = await adminClient
    .from('push_tokens')
    .select('expo_push_token, user_id')
    .in('user_id', recipientUserIds);

  if (pushTokensError) {
    console.error('[send-request-push] token lookup failed', pushTokensError);
    return jsonResponse(500, { error: 'Unable to load recipient push tokens' });
  }

  const uniqueTokens = [
    ...new Set(
      (pushTokens as PushTokenRow[] | null ?? [])
        .map((row) => row.expo_push_token)
        .filter((token): token is string => Boolean(token) && isValidExpoPushToken(token))
    ),
  ];

  const content = buildNotificationContent(payload.eventType, typedRequest);
  
  let sentCount = 0;
  let skippedCount = 0;
  let invalidTokenCount = 0;
  const invalidTokens = new Set<string>();

  if (uniqueTokens.length > 0) {
    const messages = uniqueTokens.map((token) => ({
      to: token,
      title: content.title,
      body: content.body,
      sound: 'default',
      data: {
        requestId: typedRequest.id,
        type: payload.eventType,
      },
    }));

    for (const chunk of chunkArray(messages, 100)) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error('[send-request-push] expo push request failed', await response.text());
        continue;
      }

      const responseBody = await response.json();
      const tickets = normalizeExpoResponseData((responseBody as { data?: unknown }).data);

      tickets.forEach((ticket, index) => {
        const token = chunk[index]?.to;

        if (!token || !ticket || typeof ticket !== 'object') {
          return;
        }

        const candidate = ticket as {
          status?: string;
          details?: {
            error?: string;
          };
        };

        if (candidate.status === 'ok') {
          sentCount += 1;
          return;
        }

        if (candidate.details?.error === 'DeviceNotRegistered') {
          invalidTokens.add(token);
        }

        console.error('[send-request-push] expo push ticket error', {
          ticket: candidate,
          token,
        });
      });
    }

    if (invalidTokens.size > 0) {
      const { error: deleteInvalidTokensError } = await adminClient
        .from('push_tokens')
        .delete()
        .in('expo_push_token', [...invalidTokens]);

      if (deleteInvalidTokensError) {
        console.error('[send-request-push] unable to remove invalid tokens', deleteInvalidTokensError);
      }
    }
    
    skippedCount = uniqueTokens.length - sentCount;
    invalidTokenCount = invalidTokens.size;
  }

  // --- Web Push (PWA) ---
  const { data: pushSubscriptions } = await adminClient
    .from('push_subscriptions')
    .select('id, subscription')
    .in('user_id', recipientUserIds);

  let webSentCount = 0;
  if (pushSubscriptions && pushSubscriptions.length > 0) {
    for (const sub of pushSubscriptions) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: content.title,
            body: content.body,
            url: `/requests/${typedRequest.id}`
          })
        );
        webSentCount++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        }
        console.error('[send-request-push] web-push error', err);
      }
    }
  }

  return jsonResponse(200, {
    sentCount,
    skippedCount,
    invalidTokenCount,
    webSentCount
  });
});
