import type { RecentNote } from './home';

export type DirectMessageType = 'text' | 'note';

export type DmUser = {
  id: string;
  fullName: string;
  username: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  userCode: string;
  avatarUrl: string | null;
};

export type ConversationPreview = {
  user: DmUser;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageLabel: string;
  lastMessageSenderId: string;
  unreadCount: number;
};

export type DirectMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: DirectMessageType;
  noteId: string | null;
  sharedNote?: RecentNote | null;
  noteLoadError?: string | null;
  createdAt: string;
  createdLabel: string;
  isRead: boolean;
};
