import { supabase } from '../lib/supabase';
import type { ConversationPreview, DirectMessage, DirectMessageType, DmUser } from '../types';
import { ensureCurrentUserNotBanned } from './banService';
import { fetchVisibleNoteById } from './notesService';

type ConversationRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  school_id: string | null;
  class_id: string | null;
  section_id: string | null;
  user_code: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  message_type: string | null;
  note_id: string | null;
  created_at: string | null;
  is_read: boolean | null;
};

type BlockStatusRow = {
  blocked_by_me: boolean | null;
  blocked_me: boolean | null;
};

export type DmBlockStatus = {
  blockedByMe: boolean;
  blockedMe: boolean;
};

function formatMessageTimestamp(value: string | null) {
  if (!value) {
    return 'Now';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function mapConversationRow(row: ConversationRow): ConversationPreview {
  const user: DmUser = {
    id: row.user_id,
    fullName: row.full_name ?? 'Zenmo Student',
    username: row.username ?? 'zenmo-student',
    schoolId: row.school_id ?? '',
    classId: row.class_id ?? '',
    sectionId: row.section_id ?? '',
    userCode: row.user_code ?? '',
    avatarUrl: row.avatar_url ?? null,
  };

  return {
    user,
    lastMessage: row.last_message?.trim() || 'Start your conversation',
    lastMessageAt: row.last_message_at ?? new Date().toISOString(),
    lastMessageLabel: formatMessageTimestamp(row.last_message_at),
    lastMessageSenderId: row.last_message_sender_id ?? '',
    unreadCount: Math.max(row.unread_count ?? 0, 0),
  };
}

function mapMessageRow(row: MessageRow): DirectMessage {
  const messageType: DirectMessageType = row.message_type === 'note' ? 'note' : 'text';

  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content?.trim() || '',
    messageType,
    noteId: messageType === 'note' ? row.note_id ?? null : null,
    sharedNote: null,
    noteLoadError: null,
    createdAt: row.created_at ?? new Date().toISOString(),
    createdLabel: formatMessageTimestamp(row.created_at),
    isRead: Boolean(row.is_read),
  };
}

function mapBlockStatusRow(row: BlockStatusRow | null | undefined): DmBlockStatus {
  return {
    blockedByMe: Boolean(row?.blocked_by_me),
    blockedMe: Boolean(row?.blocked_me),
  };
}

function toMessageSendError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '';

  if (message.includes('Message cannot be sent')) {
    return new Error('Message cannot be sent.');
  }

  return error;
}

export async function hydrateDirectMessageNote(message: DirectMessage) {
  if (message.messageType !== 'note' || !message.noteId || message.sharedNote) {
    return message;
  }

  try {
    const sharedNote = await fetchVisibleNoteById(message.noteId);

    return {
      ...message,
      sharedNote,
      noteLoadError: sharedNote ? null : 'This note is no longer available.',
    };
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : 'Unable to load this shared note right now.';

    return {
      ...message,
      sharedNote: null,
      noteLoadError: messageText,
    };
  }
}

export async function fetchConversationPreviews() {
  const { data, error } = await supabase.rpc('get_dm_conversations');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: unknown) => mapConversationRow(row as ConversationRow));
}

export async function fetchConversationMessages(currentUserId: string, otherUserId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, content, message_type, note_id, created_at, is_read')
    .or(
      `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
    )
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const mappedMessages = (data ?? []).map((row) => mapMessageRow(row as MessageRow));

  return Promise.all(mappedMessages.map((message) => hydrateDirectMessageNote(message)));
}

export async function sendDirectMessage(input: {
  receiverId: string;
  content: string;
  code?: string;
}) {
  await ensureCurrentUserNotBanned();

  const blockStatus = await fetchDmBlockStatus(input.receiverId);

  if (blockStatus.blockedByMe || blockStatus.blockedMe) {
    throw new Error('Message cannot be sent.');
  }

  const { data, error } = await supabase.rpc('send_direct_message', {
    target_user_id: input.receiverId,
    message_content: input.content,
    target_code: input.code?.trim().toUpperCase() || null,
  });

  if (error) {
    throw toMessageSendError(error);
  }

  return mapMessageRow(data as MessageRow);
}

export async function sendNoteMessage(input: {
  receiverId: string;
  noteId: string;
  code?: string;
}) {
  await ensureCurrentUserNotBanned();

  const blockStatus = await fetchDmBlockStatus(input.receiverId);

  if (blockStatus.blockedByMe || blockStatus.blockedMe) {
    throw new Error('Message cannot be sent.');
  }

  const { data, error } = await supabase.rpc('send_note_direct_message', {
    shared_note_id: input.noteId,
    target_user_id: input.receiverId,
    target_code: input.code?.trim().toUpperCase() || null,
  });

  if (error) {
    throw toMessageSendError(error);
  }

  return hydrateDirectMessageNote(mapMessageRow(data as MessageRow));
}

export async function fetchDmBlockStatus(targetUserId: string) {
  const { data, error } = await supabase.rpc('get_dm_block_status', {
    target_user_id: targetUserId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return mapBlockStatusRow(row as BlockStatusRow | null | undefined);
}

export async function blockDmUser(currentUserId: string, targetUserId: string) {
  const { error } = await supabase.from('blocked_users').upsert(
    {
      blocker_id: currentUserId,
      blocked_id: targetUserId,
    },
    {
      onConflict: 'blocker_id,blocked_id',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    throw error;
  }
}

export async function unblockDmUser(currentUserId: string, targetUserId: string) {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', currentUserId)
    .eq('blocked_id', targetUserId);

  if (error) {
    throw error;
  }
}

export async function markConversationRead(otherUserId: string) {
  const { error } = await supabase.rpc('mark_dm_conversation_read', {
    other_user_id: otherUserId,
  });

  if (error) {
    throw error;
  }
}

export function subscribeToConversation(
  currentUserId: string,
  otherUserId: string,
  onMessage: (message: DirectMessage) => void
) {
  const channel = supabase.channel(`dm:${currentUserId}:${otherUserId}`);

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${currentUserId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow;

        if (row.receiver_id === otherUserId) {
          onMessage(mapMessageRow(row));
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow;

        if (row.sender_id === otherUserId) {
          onMessage(mapMessageRow(row));
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
