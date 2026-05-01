import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks';
import { flushPendingNavigationAction, navigationRef } from '../lib/navigationRef';
import { hasRecentWebUploadDraftPending } from '../lib/webUploadDraft';
import { fetchConversationPreviews } from '../services';
import { colors } from '../theme';
import type {
  ConversationPreview,
  MessagesStackParamList,
  RequestsStackParamList,
  RootStackParamList,
  RootTabParamList,
} from '../types';
import {
  AdminReportsScreen,
  AuthScreen,
  BannedAccountScreen,
  ChatListScreen,
  ChatScreen,
  ClassmatesScreen,
  EnterCodeScreen,
  HomeScreen,
  NoteDetailScreen,
  ProfileScreen,
  ProfileSetupScreen,
  RequestDetailScreen,
  RequestNoteScreen,
  RequestsFeedScreen,
  UploadScreen,
} from '../screens';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const RequestsStack = createNativeStackNavigator<RequestsStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const TAB_BAR_BASE_HEIGHT = 82;

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
  },
};

function getIconName(routeName: keyof RootTabParamList, focused: boolean): keyof typeof Ionicons.glyphMap {
  if (routeName === 'Home') {
    return focused ? 'home' : 'home-outline';
  }

  if (routeName === 'Requests') {
    return focused ? 'document-text' : 'document-text-outline';
  }

  if (routeName === 'Messages') {
    return focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
  }

  return focused ? 'person' : 'person-outline';
}

function MessagesBadge() {
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadCount() {
      if (!session) {
        if (isMounted) {
          setUnreadCount(0);
        }
        return;
      }

      try {
        const conversations = await fetchConversationPreviews();

        if (isMounted) {
          const nextCount = conversations.reduce(
            (total: number, conversation: ConversationPreview) => total + conversation.unreadCount,
            0
          );
          setUnreadCount(nextCount);
        }
      } catch {
        if (isMounted) {
          setUnreadCount(0);
        }
      }
    }

    void loadUnreadCount();
    const intervalId = setInterval(() => {
      void loadUnreadCount();
    }, 12000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [session]);

  if (unreadCount <= 0) {
    return null;
  }

  return (
    <View style={styles.messagesBadge}>
      <Text style={styles.messagesBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
    </View>
  );
}

function StandardTabButton({
  focused,
  onLongPress,
  onPress,
  routeName,
}: {
  focused: boolean;
  onLongPress: () => void;
  onPress: () => void;
  routeName: keyof RootTabParamList;
}) {
  const isHome = routeName === 'Home';
  const activeColor = isHome ? colors.primary : '#B88EEB';
  const tintColor = focused ? activeColor : '#8D7A91';
  const label = routeName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.standardTabButton,
        pressed && styles.standardTabButtonPressed,
      ]}
    >
      <View style={styles.standardIconFrame}>
        <Ionicons name={getIconName(routeName, focused)} size={23} color={tintColor} />
        {routeName === 'Messages' ? <MessagesBadge /> : null}
      </View>
      <Text style={[styles.standardTabLabel, focused && { color: tintColor }]} numberOfLines={1}>
        {label}
      </Text>
      {isHome && focused ? <View style={styles.homeUnderline} /> : null}
    </Pressable>
  );
}

function UploadTabButton({
  focused,
  onLongPress,
  onPress,
}: {
  focused: boolean;
  onLongPress: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.uploadButtonWrap,
        pressed && styles.uploadButtonWrapPressed,
      ]}
    >
      <View style={[styles.uploadOuterRing, focused && styles.uploadOuterRingFocused]}>
        <View style={styles.uploadInnerButton}>
          <Ionicons name="add" size={30} color="#FFFFFF" />
          <Text style={styles.uploadButtonLabel}>Upload</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CosmicTabBarBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.tabBarBackgroundWrap}>
      <View style={styles.tabBarGlowPurple} />
      <View style={styles.tabBarGlowOrange} />
      <View style={styles.tabBarShell}>
        <View style={styles.tabBarInner} />
        {children}
      </View>
    </View>
  );
}

function ZenmoTabBar({ navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <CosmicTabBarBackground>
        <View style={styles.tabBarRow}>
          {state.routes.map((route, index) => {
            const routeName = route.name as keyof RootTabParamList;
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            if (routeName === 'Upload') {
              return (
                <View key={route.key} style={styles.uploadTabSlot}>
                  <UploadTabButton focused={focused} onLongPress={onLongPress} onPress={onPress} />
                </View>
              );
            }

            return (
              <View key={route.key} style={styles.standardTabSlot}>
                <StandardTabButton
                  focused={focused}
                  onLongPress={onLongPress}
                  onPress={onPress}
                  routeName={routeName}
                />
              </View>
            );
          })}
        </View>
      </CosmicTabBarBackground>
    </View>
  );
}

function getTabScreenOptions(routeName: keyof RootTabParamList): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarShowLabel: false,
    sceneStyle: {
      backgroundColor: colors.background,
    },
  };
}

function MainTabs() {
  const initialRouteName =
    Platform.OS === 'web' && hasRecentWebUploadDraftPending() ? 'Upload' : undefined;

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => getTabScreenOptions(route.name)}
      tabBar={(props) => <ZenmoTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Requests"
        component={RequestsNavigator}
        options={{
          title: 'Requests',
        }}
      />
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={{
          title: 'Messages',
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RequestsNavigator() {
  return (
    <RequestsStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <RequestsStack.Screen name="RequestsFeed" component={RequestsFeedScreen} />
      <RequestsStack.Screen name="RequestNote" component={RequestNoteScreen} />
      <RequestsStack.Screen name="RequestDetail" component={RequestDetailScreen} />
    </RequestsStack.Navigator>
  );
}

function MessagesNavigator() {
  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <MessagesStack.Screen name="ChatList" component={ChatListScreen} />
      <MessagesStack.Screen name="Classmates" component={ClassmatesScreen} />
      <MessagesStack.Screen name="EnterCode" component={EnterCodeScreen} />
      <MessagesStack.Screen name="Chat" component={ChatScreen} />
    </MessagesStack.Navigator>
  );
}

export function AppNavigator() {
  const { initializing, profile, session } = useAuth();

  useEffect(() => {
    if (__DEV__) {
      console.log('[startup][AppNavigator]', {
        hasProfile: Boolean(profile),
        hasSession: Boolean(session),
        initializing,
      });
    }
  }, [initializing, profile, session]);

  if (initializing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={flushPendingNavigationAction}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {session ? (
          profile ? (
            profile.isBanned ? (
              <Stack.Screen name="BannedAccount" component={BannedAccountScreen} />
            ) : (
              <>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen name="Messages" component={MessagesNavigator} />
                <Stack.Screen name="NoteDetail" component={NoteDetailScreen} />
                <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
              </>
            )
          ) : (
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    height: TAB_BAR_BASE_HEIGHT,
    paddingTop: 0,
    paddingHorizontal: 6,
    paddingBottom: 0,
    backgroundColor: '#020106',
  },
  tabBarBackgroundWrap: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  tabBarGlowPurple: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 126,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(139, 71, 255, 0.08)',
  },
  tabBarGlowOrange: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 128,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 136, 31, 0.035)',
  },
  tabBarShell: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 132, 37, 0.55)',
    backgroundColor: '#000000',
    overflow: 'visible',
    shadowColor: '#8B3FFF',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 8,
  },
  tabBarInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(145, 74, 255, 0.4)',
    backgroundColor: 'rgba(2, 1, 10, 0.96)',
  },
  tabBarRow: {
    flex: 1,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  standardTabSlot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTabSlot: {
    width: 78,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardTabButton: {
    width: 60,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardTabButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  standardIconFrame: {
    minWidth: 40,
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  standardTabLabel: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 12,
    color: '#8D7A91',
    fontFamily: 'SpaceGrotesk-Medium',
    textAlign: 'center',
    width: 58,
  },
  homeUnderline: {
    width: 28,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 6,
  },
  messagesBadge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6D4A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#FFB08F',
  },
  messagesBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  uploadButtonWrap: {
    top: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonWrapPressed: {
    transform: [{ scale: 0.96 }],
  },
  uploadOuterRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(216, 148, 255, 0.65)',
    backgroundColor: '#34135E',
  },
  uploadOuterRingFocused: {
    borderColor: '#E4AEFF',
  },
  uploadInnerButton: {
    flex: 1,
    borderRadius: 29,
    backgroundColor: '#8B3FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9E54FF',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 10,
  },
  uploadButtonLabel: {
    marginTop: 1,
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 10,
    fontFamily: 'SpaceGrotesk-Bold',
  },
});
