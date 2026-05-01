import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClassPresence } from '../hooks';
import { fetchConversationPreviews } from '../services';
import { colors, typography } from '../theme';
import type { ConversationPreview, MessagesStackParamList } from '../types';

type ChatListScreenProps = NativeStackScreenProps<MessagesStackParamList, 'ChatList'>;

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return 'ZN';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function ChatPreviewRow({
  conversation,
  isActive,
  onPress,
}: {
  conversation: ConversationPreview;
  isActive: boolean;
  onPress: () => void;
}) {
  const initials = getInitials(conversation.user.fullName);
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chatCard, pressed && styles.pressedCard]}
    >
      <LinearGradient
        colors={
          hasUnread
            ? ['rgba(58, 25, 87, 0.92)', 'rgba(10, 7, 21, 0.98)', 'rgba(31, 13, 9, 0.9)']
            : ['rgba(17, 13, 32, 0.96)', 'rgba(6, 5, 15, 0.98)', 'rgba(11, 7, 14, 0.96)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.chatCardGradient}
      >
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={
              hasUnread
                ? ['rgba(255, 138, 26, 0.28)', 'rgba(151, 71, 255, 0.22)']
                : ['rgba(151, 71, 255, 0.24)', 'rgba(26, 118, 255, 0.14)']
            }
            style={styles.avatar}
          >
            <Text style={[styles.avatarText, hasUnread && styles.avatarTextUnread]}>{initials}</Text>
          </LinearGradient>
          <View style={[styles.onlineDot, isActive ? styles.onlineDotActive : styles.onlineDotOffline]} />
        </View>

        <View style={styles.chatCopy}>
          <Text numberOfLines={1} style={styles.chatName}>
            {conversation.user.fullName}
          </Text>
          <Text numberOfLines={1} style={styles.chatMessage}>
            {conversation.lastMessage}
          </Text>
          <View style={styles.presenceRow}>
            <View style={[styles.presenceDot, isActive ? styles.presenceDotActive : styles.presenceDotOffline]} />
            <Text style={[styles.presenceText, isActive ? styles.presenceTextActive : styles.presenceTextOffline]}>
              {isActive ? 'Active now' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.chatMeta}>
          <Text style={styles.chatTime}>{conversation.lastMessageLabel}</Text>
          {hasUnread ? (
            <LinearGradient
              colors={['#FF8A1A', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.unreadBadge}
            >
              <Text style={styles.unreadBadgeText}>
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </Text>
            </LinearGradient>
          ) : (
            <Ionicons name="sparkles-outline" size={16} color="rgba(182, 167, 155, 0.5)" />
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function ChatListScreen({ navigation }: ChatListScreenProps) {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { isUserActive } = useClassPresence();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      [conversation.user.fullName, conversation.user.username, conversation.lastMessage]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [conversations, searchQuery]);

  async function loadConversations() {
    try {
      setErrorMessage(null);
      const data = await fetchConversationPreviews();
      setConversations(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load your direct messages right now.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      setIsLoading(true);
      void loadConversations();
    }
  }, [isFocused]);

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await loadConversations();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowOrange} />
      <View pointerEvents="none" style={styles.starOne} />
      <View pointerEvents="none" style={styles.starTwo} />
      <View pointerEvents="none" style={styles.orbitLine} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: 126 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#D8B6FF" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(18, 9, 40, 0.96)', 'rgba(5, 4, 14, 0.98)', 'rgba(33, 10, 8, 0.88)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Private Messaging</Text>
              <Text style={styles.titleLine}>Direct</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={styles.messagesTitle}
              >
                Messages
              </Text>
              <Text style={styles.subtitle}>
                Chat with your class directly, or start a private chat with a code.
              </Text>
            </View>

            <View pointerEvents="none" style={styles.chatIllustration}>
              <View style={styles.chatOrbit} />
              <LinearGradient
                colors={['#B95CFF', '#712AFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bubble, styles.bubbleBack]}
              >
                <View style={styles.dotRow}>
                  <View style={styles.chatDot} />
                  <View style={styles.chatDot} />
                </View>
              </LinearGradient>
              <LinearGradient
                colors={['#D176FF', '#8D35FF', '#FF7A2D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bubble, styles.bubbleFront]}
              >
                <View style={styles.dotRow}>
                  <View style={styles.chatDot} />
                  <View style={styles.chatDot} />
                  <View style={styles.chatDot} />
                </View>
              </LinearGradient>
              <View style={styles.sparkleDot} />
            </View>
          </LinearGradient>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>Search Existing Chats</Text>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={23} color="rgba(225, 214, 233, 0.58)" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search name, username, or message"
                placeholderTextColor="rgba(225, 214, 233, 0.52)"
                style={styles.searchInput}
                selectionColor={colors.primary}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start New Chat</Text>

          <View style={styles.actionGrid}>
            <Pressable
              onPress={() => navigation.navigate('Classmates')}
              style={({ pressed }) => [styles.actionCard, pressed && styles.pressedCard]}
            >
              <LinearGradient
                colors={['rgba(52, 16, 74, 0.9)', 'rgba(10, 6, 18, 0.98)', 'rgba(41, 13, 13, 0.88)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.actionGradient, styles.actionGradientClass]}
              >
                <View style={styles.actionIconShell}>
                  <Ionicons name="people" size={28} color="#A855F7" />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionEyebrow}>Your Class</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.actionTitle}>
                    Classmates
                  </Text>
                  <Text style={styles.actionText}>
                    Browse only students in your current school, class, and section scope.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={28} color="#C65BFF" />
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('EnterCode')}
              style={({ pressed }) => [styles.actionCard, pressed && styles.pressedCard]}
            >
              <LinearGradient
                colors={['rgba(4, 27, 63, 0.92)', 'rgba(4, 6, 19, 0.98)', 'rgba(19, 8, 45, 0.84)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.actionGradient, styles.actionGradientCode]}
              >
                <View style={[styles.actionIconShell, styles.actionIconShellBlue]}>
                  <Ionicons name="lock-closed" size={25} color="#2F8BFF" />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={[styles.actionEyebrow, styles.actionEyebrowBlue]}>Private Access</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.actionTitle}>
                    Enter Code
                  </Text>
                  <Text style={styles.actionText}>
                    Start a controlled chat with someone outside your classroom scope.
                  </Text>
                </View>
                <View style={styles.codeArrowButton}>
                  <Ionicons name="chevron-forward" size={26} color="#2F8BFF" />
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Existing Chats</Text>

          {errorMessage ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>Messages unavailable</Text>
              <Text style={styles.feedbackText}>{errorMessage}</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>Loading chats</Text>
              <Text style={styles.feedbackText}>Pulling in your private conversations now.</Text>
            </View>
          ) : filteredConversations.length > 0 ? (
            <View style={styles.list}>
              {filteredConversations.map((conversation) => (
                <ChatPreviewRow
                  key={conversation.user.id}
                  conversation={conversation}
                  isActive={isUserActive(conversation.user.id)}
                  onPress={() => navigation.navigate('Chat', { targetUser: conversation.user })}
                />
              ))}
            </View>
          ) : (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>No chats yet</Text>
              <Text style={styles.feedbackText}>
                Message a classmate or enter a valid user code to start your first conversation.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020106',
    overflow: 'hidden',
  },
  cosmicGlowPurple: {
    position: 'absolute',
    top: 72,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(151, 71, 255, 0.2)',
    opacity: 0.85,
  },
  cosmicGlowOrange: {
    position: 'absolute',
    top: 210,
    right: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 122, 45, 0.17)',
    opacity: 0.9,
  },
  starOne: {
    position: 'absolute',
    top: 82,
    right: 64,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C65BFF',
  },
  starTwo: {
    position: 'absolute',
    top: 410,
    left: 36,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF8A1A',
  },
  orbitLine: {
    position: 'absolute',
    top: 105,
    right: -60,
    width: 280,
    height: 104,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.34)',
    borderRadius: 150,
    transform: [{ rotate: '-17deg' }],
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.62)',
    backgroundColor: 'rgba(8, 6, 20, 0.88)',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#A855F7',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 4,
  },
  backButtonText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.58)',
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 6,
  },
  heroGradient: {
    minHeight: 238,
    paddingHorizontal: 20,
    paddingVertical: 22,
    overflow: 'hidden',
  },
  heroCopy: {
    width: '74%',
    minWidth: 0,
    paddingRight: 8,
    gap: 5,
    zIndex: 2,
  },
  eyebrow: {
    color: '#6D7BFF',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  titleLine: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 39,
    lineHeight: 43,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.18)',
    textShadowRadius: 10,
  },
  messagesTitle: {
    color: '#FF8A1A',
    fontFamily: typography.fontFamily.display,
    fontSize: 39,
    lineHeight: 43,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 138, 26, 0.38)',
    textShadowRadius: 12,
    marginTop: -4,
  },
  subtitle: {
    color: 'rgba(247, 240, 232, 0.78)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    lineHeight: 24,
    marginTop: 6,
  },
  chatIllustration: {
    position: 'absolute',
    right: -10,
    top: 26,
    width: 142,
    height: 168,
    opacity: 0.9,
  },
  chatOrbit: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 62,
    height: 72,
    borderWidth: 2,
    borderColor: 'rgba(255, 138, 26, 0.62)',
    borderLeftColor: 'rgba(151, 71, 255, 0.9)',
    borderBottomColor: 'rgba(151, 71, 255, 0.5)',
    borderRadius: 90,
    transform: [{ rotate: '-14deg' }],
  },
  bubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    shadowColor: '#A855F7',
    shadowOpacity: 0.48,
    shadowRadius: 18,
    elevation: 6,
  },
  bubbleBack: {
    left: 5,
    top: 78,
    width: 66,
    height: 54,
    opacity: 0.9,
  },
  bubbleFront: {
    right: 4,
    top: 34,
    width: 84,
    height: 72,
    transform: [{ rotate: '-7deg' }],
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  sparkleDot: {
    position: 'absolute',
    right: 10,
    top: 132,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF8A1A',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  searchCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.5)',
    backgroundColor: 'rgba(12, 8, 22, 0.88)',
    padding: 16,
    gap: 12,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  searchLabel: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.42)',
    borderRadius: 13,
    backgroundColor: 'rgba(2, 1, 8, 0.74)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.15)',
    textShadowRadius: 8,
  },
  actionGrid: {
    gap: 14,
  },
  actionCard: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  actionGradient: {
    minHeight: 128,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  actionGradientClass: {
    borderColor: 'rgba(203, 91, 255, 0.82)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  actionGradientCode: {
    borderColor: 'rgba(47, 139, 255, 0.82)',
    shadowColor: '#2F8BFF',
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  actionIconShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.66)',
    backgroundColor: 'rgba(92, 38, 162, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  actionIconShellBlue: {
    borderColor: 'rgba(47, 139, 255, 0.7)',
    backgroundColor: 'rgba(18, 70, 160, 0.28)',
    shadowColor: '#2F8BFF',
  },
  actionCopy: {
    flex: 1,
    gap: 5,
  },
  actionEyebrow: {
    color: '#B56DFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  actionEyebrowBlue: {
    color: '#2F8BFF',
  },
  actionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 21,
    lineHeight: 25,
    textTransform: 'uppercase',
  },
  actionText: {
    color: 'rgba(247, 240, 232, 0.72)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: 21,
  },
  codeArrowButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47, 139, 255, 0.11)',
  },
  list: {
    gap: 10,
  },
  chatCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  chatCardGradient: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.58)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#A855F7',
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  avatarWrap: {
    width: 58,
    height: 58,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#9A58FF',
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    textTransform: 'uppercase',
  },
  avatarTextUnread: {
    color: '#FF9D2E',
  },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#05030A',
  },
  onlineDotActive: {
    backgroundColor: '#17E88C',
  },
  onlineDotOffline: {
    backgroundColor: 'rgba(145, 132, 151, 0.72)',
  },
  chatCopy: {
    flex: 1,
    gap: 5,
  },
  chatName: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
  },
  chatMessage: {
    color: 'rgba(247, 240, 232, 0.68)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  presenceDotActive: {
    backgroundColor: '#17E88C',
  },
  presenceDotOffline: {
    backgroundColor: 'rgba(145, 132, 151, 0.7)',
  },
  presenceText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.xs,
  },
  presenceTextActive: {
    color: '#8EFFC6',
  },
  presenceTextOffline: {
    color: 'rgba(199, 186, 205, 0.58)',
  },
  chatMeta: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  chatTime: {
    color: 'rgba(247, 240, 232, 0.72)',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  unreadBadgeText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
  },
  pressedCard: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94,
  },
  feedbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.42)',
    backgroundColor: 'rgba(12, 8, 22, 0.88)',
    padding: 16,
    gap: 8,
  },
  feedbackTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  feedbackText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
  },
});
