import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type DimensionValue,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { MessageBubble, NoteSharePicker } from '../components';
import { useAuth, useClassPresence } from '../hooks';
import {
  blockDmUser,
  fetchDmBlockStatus,
  fetchVisibleNoteById,
  fetchConversationMessages,
  hydrateDirectMessageNote,
  markConversationRead,
  sendDirectMessage,
  sendNoteMessage,
  subscribeToConversation,
  unblockDmUser,
  type DmBlockStatus,
} from '../services';
import { colors, typography } from '../theme';
import type { DirectMessage, MessagesStackParamList, RecentNote, RootStackParamList } from '../types';

type ChatScreenProps = CompositeScreenProps<
  NativeStackScreenProps<MessagesStackParamList, 'Chat'>,
  NativeStackScreenProps<RootStackParamList>
>;

const BACKDROP_DOTS = Array.from({ length: 120 }, (_, index) => ({
  id: index,
  left: `${(index * 17) % 100}%` as DimensionValue,
  top: `${(index * 29) % 100}%` as DimensionValue,
  opacity: 0.12 + ((index * 7) % 4) * 0.035,
}));

const initialBlockStatus: DmBlockStatus = {
  blockedByMe: false,
  blockedMe: false,
};

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return 'ZN';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function DottedBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backdropLayer}>
      <View style={styles.purpleOrb} />
      <View style={styles.orangeOrb} />
      {BACKDROP_DOTS.map((dot) => (
        <View
          key={dot.id}
          style={[
            styles.backdropDot,
            {
              left: dot.left,
              top: dot.top,
              opacity: dot.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function ChatScreen({ navigation, route }: ChatScreenProps) {
  const { targetUser } = route.params;
  const { user } = useAuth();
  const { isUserActive } = useClassPresence();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const hasInitialScrolledRef = useRef(false);
  const skipNextAutoScrollRef = useRef(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSharingNote, setIsSharingNote] = useState(false);
  const [isBlockStatusLoading, setIsBlockStatusLoading] = useState(false);
  const [blockStatus, setBlockStatus] = useState<DmBlockStatus>(initialBlockStatus);
  const [isNotePickerVisible, setIsNotePickerVisible] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState(route.params.connectCode?.trim().toUpperCase() || '');

  const isCompactLayout = width < 390 || height < 740;
  const isVeryNarrowLayout = width < 350;
  const isTargetActive = isUserActive(targetUser.id);
  const isMessagingBlocked = blockStatus.blockedByMe || blockStatus.blockedMe;
  const blockedNoticeText = blockStatus.blockedByMe
    ? 'You blocked this user. Unblock to message again.'
    : 'Message cannot be sent.';
  const canSend = draft.trim().length > 0 && !isSending && !isMessagingBlocked;

  function appendMessage(nextMessage: DirectMessage) {
    setMessages((current) => {
      if (current.some((message) => message.id === nextMessage.id)) {
        return current;
      }

      return [...current, nextMessage];
    });
  }

  function scrollToLatest(animated: boolean, delay = 100) {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, delay);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 80;
    const atBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    setIsNearBottom(atBottom);
  }

  async function loadMessages() {
    if (!user?.id) {
      setMessages([]);
      setErrorMessage('You need to be signed in to open chats.');
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);
      const data = await fetchConversationMessages(user.id, targetUser.id);
      setMessages(data);
      await markConversationRead(targetUser.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load this conversation right now.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshBlockStatus() {
    if (!user?.id) {
      setBlockStatus(initialBlockStatus);
      return;
    }

    try {
      setIsBlockStatusLoading(true);
      const nextStatus = await fetchDmBlockStatus(targetUser.id);
      setBlockStatus(nextStatus);
    } catch (error) {
      console.error('[ChatScreen] unable to load block status', error);
      setBlockStatus(initialBlockStatus);
    } finally {
      setIsBlockStatusLoading(false);
    }
  }

  useEffect(() => {
    navigation.setOptions?.({
      title: targetUser.fullName,
    });
  }, [navigation, targetUser.fullName]);

  useEffect(() => {
    hasInitialScrolledRef.current = false;
    setIsNearBottom(true);
    setIsLoading(true);
    void loadMessages();
    void refreshBlockStatus();
  }, [targetUser.id, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const unsubscribe = subscribeToConversation(user.id, targetUser.id, (message) => {
      void hydrateDirectMessageNote(message).then((hydratedMessage) => {
        if (blockStatus.blockedByMe && hydratedMessage.senderId === targetUser.id) {
          return;
        }

        appendMessage(hydratedMessage);

        if (hydratedMessage.senderId === targetUser.id) {
          void markConversationRead(targetUser.id);
        }
      });
    });

    return unsubscribe;
  }, [blockStatus.blockedByMe, targetUser.id, user?.id]);

  useEffect(() => {
    if (isLoading || messages.length === 0 || hasInitialScrolledRef.current) {
      return;
    }

    hasInitialScrolledRef.current = true;
    skipNextAutoScrollRef.current = true;
    scrollToLatest(false);
  }, [isLoading, messages.length]);

  useEffect(() => {
    if (messages.length === 0 || !hasInitialScrolledRef.current || !isNearBottom) {
      return;
    }

    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }

    scrollToLatest(true);
  }, [messages, isNearBottom]);

  async function handleSend() {
    if (!user?.id) {
      return;
    }

    if (isMessagingBlocked) {
      setErrorMessage(blockedNoticeText);
      return;
    }

    if (!canSend) {
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage(null);

      const sentMessage = await sendDirectMessage({
        receiverId: targetUser.id,
        content: draft.trim(),
        code: pendingCode || undefined,
      });

      appendMessage(sentMessage);
      setDraft('');
      scrollToLatest(true);

      if (pendingCode) {
        setPendingCode('');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send this message right now.';
      setErrorMessage(message);

      if (message === 'Message cannot be sent.') {
        void refreshBlockStatus();
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleShareNote(note: RecentNote) {
    if (!user?.id || isSharingNote) {
      return;
    }

    if (isMessagingBlocked) {
      const message = blockedNoticeText;
      setErrorMessage(message);
      Alert.alert('Unable to share note', message);
      return;
    }

    try {
      setIsSharingNote(true);
      setErrorMessage(null);

      const sentMessage = await sendNoteMessage({
        receiverId: targetUser.id,
        noteId: note.id,
        code: pendingCode || undefined,
      });

      appendMessage(sentMessage);
      setIsNotePickerVisible(false);
      scrollToLatest(true);

      if (pendingCode) {
        setPendingCode('');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to share this note right now.';
      setErrorMessage(message);
      Alert.alert('Unable to share note', message);

      if (message === 'Message cannot be sent.') {
        void refreshBlockStatus();
      }
    } finally {
      setIsSharingNote(false);
    }
  }

  async function handleBlockUser() {
    if (!user?.id || isBlockStatusLoading) {
      return;
    }

    try {
      setIsBlockStatusLoading(true);
      await blockDmUser(user.id, targetUser.id);
      setBlockStatus((current) => ({ ...current, blockedByMe: true }));
      setDraft('');
      setIsNotePickerVisible(false);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to block this user right now.';
      Alert.alert('Block failed', message);
    } finally {
      setIsBlockStatusLoading(false);
    }
  }

  async function handleUnblockUser() {
    if (!user?.id || isBlockStatusLoading) {
      return;
    }

    try {
      setIsBlockStatusLoading(true);
      await unblockDmUser(user.id, targetUser.id);
      setBlockStatus((current) => ({ ...current, blockedByMe: false }));
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to unblock this user right now.';
      Alert.alert('Unblock failed', message);
    } finally {
      setIsBlockStatusLoading(false);
    }
  }

  function handleMenuPress() {
    if (blockStatus.blockedByMe) {
      Alert.alert(
        'Unblock user?',
        `You will be able to message ${targetUser.fullName} again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unblock', onPress: () => void handleUnblockUser() },
        ]
      );
      return;
    }

    Alert.alert(
      'Block this user?',
      "They won't be able to message you.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void handleBlockUser() },
      ]
    );
  }

  async function handleOpenSharedNote(message: DirectMessage) {
    if (message.sharedNote) {
      navigation.navigate('NoteDetail', { note: message.sharedNote });
      return;
    }

    if (!message.noteId) {
      Alert.alert('Note unavailable', 'This note is no longer available.');
      return;
    }

    try {
      const note = await fetchVisibleNoteById(message.noteId);

      if (!note) {
        Alert.alert('Note unavailable', 'This note is no longer available.');
        return;
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, sharedNote: note, noteLoadError: null } : item
        )
      );
      navigation.navigate('NoteDetail', { note });
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : 'You do not have permission to view this note.';
      Alert.alert('Unable to open note', errorText);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient
          colors={['rgba(4, 3, 12, 0.98)', 'rgba(22, 9, 36, 0.96)', 'rgba(9, 4, 13, 0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, isCompactLayout && styles.headerCompact]}
        >
          <View pointerEvents="none" style={styles.headerGlow} />
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.headerBack, isCompactLayout && styles.headerBackCompact]}
          >
            <Ionicons name="chevron-back" size={isCompactLayout ? 17 : 19} color={colors.primarySoft} />
          </Pressable>

          <View style={[styles.headerIdentity, isCompactLayout && styles.headerIdentityCompact]}>
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={['rgba(255, 138, 26, 0.98)', 'rgba(166, 92, 255, 0.78)']}
                style={[styles.avatarBorder, isCompactLayout && styles.avatarBorderCompact]}
              >
                <View style={styles.avatar}>
                  <Text style={[styles.avatarText, isCompactLayout && styles.avatarTextCompact]}>
                    {getInitials(targetUser.fullName)}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.headerCopy}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.62}
                ellipsizeMode="tail"
                style={[styles.headerName, isCompactLayout && styles.headerNameCompact]}
              >
                {targetUser.fullName}
              </Text>
              <View style={styles.headerStatusRow}>
                <View
                  style={[
                    styles.headerStatusDot,
                    isTargetActive ? styles.headerStatusDotActive : styles.headerStatusDotOffline,
                  ]}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  ellipsizeMode="tail"
                  style={[
                    styles.headerMeta,
                    isCompactLayout && styles.headerMetaCompact,
                    isTargetActive ? styles.headerMetaActive : styles.headerMetaOffline,
                  ]}
                >
                  {isTargetActive ? 'Active now' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleMenuPress}
            disabled={isBlockStatusLoading}
            style={({ pressed }) => [
              styles.menuButton,
              isCompactLayout && styles.menuButtonCompact,
              pressed && styles.menuButtonPressed,
              blockStatus.blockedByMe && styles.menuButtonBlocked,
            ]}
          >
            <Ionicons
              name={blockStatus.blockedByMe ? 'ban-outline' : 'ellipsis-vertical'}
              size={isCompactLayout ? 21 : 24}
              color={blockStatus.blockedByMe ? '#FF6B5F' : colors.primarySoft}
            />
          </Pressable>
        </LinearGradient>

        {pendingCode ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Code-based DM unlocked. Your first message will start this private chat.
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.chatBody}>
          <DottedBackdrop />

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading conversation...</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.messageSeparator} />}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                if (messages.length === 0) {
                  return;
                }

                if (!hasInitialScrolledRef.current) {
                  hasInitialScrolledRef.current = true;
                  skipNextAutoScrollRef.current = true;
                  listRef.current?.scrollToEnd({ animated: false });
                  return;
                }

                if (isNearBottom) {
                  listRef.current?.scrollToEnd({ animated: true });
                }
              }}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  mine={item.senderId === user?.id}
                  onOpenNote={(message) => void handleOpenSharedNote(message)}
                />
              )}
              contentContainerStyle={[
                styles.listContent,
                isCompactLayout && styles.listContentCompact,
              ]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                messages.length > 0 ? (
                  <View style={styles.dateSeparatorWrap}>
                    <View style={styles.dateLine} />
                    <View style={styles.datePill}>
                      <Text style={styles.datePillText}>Today</Text>
                    </View>
                    <View style={styles.dateLine} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptyText}>
                    Send the first message to begin this private conversation.
                  </Text>
                </View>
              }
            />
          )}

          {isMessagingBlocked ? (
            <View style={styles.blockNotice}>
              <Ionicons
                name={blockStatus.blockedByMe ? 'ban-outline' : 'alert-circle-outline'}
                size={17}
                color={blockStatus.blockedByMe ? '#FF8276' : '#FFB083'}
              />
              <Text style={styles.blockNoticeText}>{blockedNoticeText}</Text>
            </View>
          ) : null}

          <View
            style={[
              styles.inputBar,
              isCompactLayout && styles.inputBarCompact,
              { marginBottom: (isCompactLayout ? 10 : 18) + Math.min(insets.bottom, 8) },
            ]}
          >
            <Pressable
              onPress={() => setIsNotePickerVisible(true)}
              disabled={isSharingNote || isLoading || isMessagingBlocked}
              style={({ pressed }) => [
                styles.attachButton,
                isCompactLayout && styles.attachButtonCompact,
                (isSharingNote || isLoading || isMessagingBlocked) && styles.attachButtonDisabled,
                pressed && !isSharingNote && !isLoading && !isMessagingBlocked && styles.attachButtonPressed,
              ]}
            >
              <Ionicons name="attach" size={isCompactLayout ? 22 : 26} color={colors.primarySoft} />
            </Pressable>

            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={isVeryNarrowLayout ? 'Message...' : 'Send a message...'}
              placeholderTextColor="#817886"
              editable={!isMessagingBlocked}
              style={[
                styles.input,
                isCompactLayout && styles.inputCompact,
                isMessagingBlocked && styles.inputDisabled,
              ]}
              selectionColor={colors.primary}
              multiline
            />

            <Pressable
              onPress={() => void handleSend()}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendButton,
                isCompactLayout && styles.sendButtonCompact,
                !canSend && styles.sendButtonDisabled,
                pressed && canSend && styles.sendButtonPressed,
              ]}
            >
              <Text style={styles.sendButtonText}>{isSending ? '...' : 'Send'}</Text>
            </Pressable>
          </View>
        </View>

        <NoteSharePicker
          visible={isNotePickerVisible && !isMessagingBlocked}
          isSharing={isSharingNote}
          onClose={() => setIsNotePickerVisible(false)}
          onShare={(note) => void handleShareNote(note)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030207',
  },
  keyboard: {
    flex: 1,
    backgroundColor: '#030207',
  },
  header: {
    minHeight: 172,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(166, 92, 255, 0.86)',
    overflow: 'hidden',
    shadowColor: '#A66BFF',
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
  },
  headerCompact: {
    minHeight: 116,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 9,
    shadowOpacity: 0.26,
    shadowRadius: 12,
  },
  headerGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -20,
    height: 48,
    backgroundColor: 'rgba(166, 92, 255, 0.18)',
  },
  headerBack: {
    width: 42,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.28)',
    backgroundColor: 'rgba(255, 138, 26, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackCompact: {
    width: 36,
    height: 40,
    borderRadius: 11,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minWidth: 0,
  },
  headerIdentityCompact: {
    gap: 10,
  },
  avatarWrap: {
    shadowColor: colors.primary,
    shadowOpacity: 0.44,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarBorder: {
    width: 88,
    height: 88,
    borderRadius: 17,
    padding: 2,
  },
  avatarBorderCompact: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  avatar: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: 'rgba(5, 4, 10, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 32,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  avatarTextCompact: {
    fontSize: 23,
    lineHeight: 27,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  headerName: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 30,
    lineHeight: 37,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.18)',
    textShadowRadius: 9,
  },
  headerNameCompact: {
    fontSize: 22,
    lineHeight: 27,
    textShadowRadius: 6,
  },
  headerMeta: {
    color: '#BDB2C5',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.md,
    lineHeight: 25,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  headerStatusDotActive: {
    backgroundColor: '#17E88C',
    shadowColor: '#17E88C',
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  headerStatusDotOffline: {
    backgroundColor: 'rgba(145, 132, 151, 0.72)',
  },
  headerMetaActive: {
    color: '#8EFFC6',
  },
  headerMetaOffline: {
    color: 'rgba(199, 186, 205, 0.7)',
  },
  headerMetaCompact: {
    fontSize: 12,
    lineHeight: 18,
  },
  menuButton: {
    width: 42,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  menuButtonCompact: {
    width: 30,
    height: 40,
  },
  menuButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  menuButtonBlocked: {
    backgroundColor: 'rgba(255, 88, 79, 0.08)',
  },
  banner: {
    borderBottomWidth: 1,
    borderBottomColor: colors.accentBlue,
    backgroundColor: '#141A1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: {
    color: colors.accentBlue,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  errorCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    color: '#FFB083',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  blockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 95, 0.34)',
    borderRadius: 16,
    backgroundColor: 'rgba(45, 7, 9, 0.76)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  blockNoticeText: {
    flex: 1,
    color: '#FFB7AE',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  chatBody: {
    flex: 1,
    backgroundColor: '#030207',
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  purpleOrb: {
    position: 'absolute',
    left: -120,
    top: 180,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(97, 47, 171, 0.12)',
  },
  orangeOrb: {
    position: 'absolute',
    right: -130,
    bottom: 80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
  },
  backdropDot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#A66BFF',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
  },
  listContent: {
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 38,
    flexGrow: 1,
  },
  listContentCompact: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 24,
  },
  messageSeparator: {
    height: 20,
  },
  dateSeparatorWrap: {
    marginTop: 8,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(166, 92, 255, 0.24)',
  },
  datePill: {
    minHeight: 42,
    minWidth: 96,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.36)',
    backgroundColor: 'rgba(7, 5, 15, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#A66BFF',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
  },
  datePillText: {
    color: '#C89BFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyState: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.28)',
    borderRadius: 18,
    backgroundColor: 'rgba(10, 7, 20, 0.8)',
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.26)',
    borderRadius: 30,
    backgroundColor: 'rgba(8, 6, 15, 0.94)',
    shadowColor: '#A66BFF',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  inputBarCompact: {
    gap: 9,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    borderRadius: 24,
  },
  attachButton: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.8)',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  attachButtonCompact: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  attachButtonDisabled: {
    opacity: 0.5,
  },
  attachButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  input: {
    flex: 1,
    minHeight: 62,
    maxHeight: 132,
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.34)',
    borderRadius: 10,
    backgroundColor: 'rgba(4, 3, 11, 0.78)',
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    paddingHorizontal: 17,
    paddingVertical: 17,
  },
  inputCompact: {
    minHeight: 48,
    borderRadius: 10,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputDisabled: {
    opacity: 0.55,
  },
  sendButton: {
    minWidth: 88,
    minHeight: 62,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.74)',
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 13,
    elevation: 6,
  },
  sendButtonCompact: {
    minWidth: 68,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  sendButtonDisabled: {
    opacity: 0.48,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  sendButtonText: {
    color: colors.background,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
