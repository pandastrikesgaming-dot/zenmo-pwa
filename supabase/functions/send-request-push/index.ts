// @ts-nocheck
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

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
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

  if (!payload.requestId || (payload.eventType !== 'created' && payload.eventType !== 'fulfilled')) {
    return jsonResponse(400, { error: 'requestId and valid eventType are required' });
  }

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

  const typedRequest = noteRequest as NoteRequestRow;

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

  if (payload.eventType === 'created') {
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

  if (uniqueTokens.length === 0) {
    return jsonResponse(200, {
      sentCount: 0,
      skippedCount: 0,
      message: 'No valid Expo push tokens found',
    });
  }

  const content = buildNotificationContent(payload.eventType, typedRequest);
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

  const invalidTokens = new Set<string>();
  let sentCount = 0;

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

  return jsonResponse(200, {
    sentCount,
    skippedCount: uniqueTokens.length - sentCount,
    invalidTokenCount: invalidTokens.size,
  });
});
