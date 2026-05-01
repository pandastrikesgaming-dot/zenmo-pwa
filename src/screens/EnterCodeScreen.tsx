import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserRow } from '../components';
import { useAuth } from '../hooks';
import { findProfileByCode } from '../services';
import { colors, typography } from '../theme';
import type { DmUser, MessagesStackParamList } from '../types';

type EnterCodeScreenProps = NativeStackScreenProps<MessagesStackParamList, 'EnterCode'>;

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return 'ZN';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function EnterCodeScreen({ navigation }: EnterCodeScreenProps) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [matchedUser, setMatchedUser] = useState<DmUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch() {
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setMatchedUser(null);
      setErrorMessage('Enter a valid user code first.');
      return;
    }

    if (normalizedCode === profile?.userCode) {
      setMatchedUser(null);
      setErrorMessage('Your own code cannot be used to start a chat.');
      return;
    }

    try {
      setIsSearching(true);
      setErrorMessage(null);
      const user = await findProfileByCode(normalizedCode);

      if (!user) {
        setMatchedUser(null);
        setErrorMessage('User not found for that code.');
        return;
      }

      setMatchedUser(user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to search this code right now.';
      setMatchedUser(null);
      setErrorMessage(message);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowBlue} />
      <View pointerEvents="none" style={styles.orbitLine} />
      <View pointerEvents="none" style={styles.starOne} />
      <View pointerEvents="none" style={styles.starTwo} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: 126 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Ionicons name="chevron-back" size={19} color="#D8B6FF" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(7, 17, 40, 0.96)', 'rgba(8, 5, 18, 0.97)', 'rgba(24, 8, 35, 0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View pointerEvents="none" style={styles.heroGlow} />
            <View style={styles.heroIcon}>
              <Ionicons name="lock-closed" size={26} color="#2F8BFF" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Private Access</Text>
              <Text style={styles.title}>Enter User Code</Text>
              <Text style={styles.subtitle}>
                Use an exact code to start a direct chat outside your classroom scope.
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.inputCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="key-outline" size={22} color={colors.primarySoft} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Find by Code</Text>
              <Text style={styles.cardText}>Codes unlock private 1-to-1 access without public discovery.</Text>
            </View>
          </View>

          <Text style={styles.label}>User Code</Text>
          <View style={styles.inputShell}>
            <Ionicons name="scan-outline" size={21} color="rgba(216, 182, 255, 0.66)" />
            <TextInput
              value={code}
              onChangeText={(value) => setCode(value.toUpperCase())}
              placeholder="e.g. ZM-29KF"
              placeholderTextColor="rgba(199, 186, 205, 0.55)"
              style={styles.input}
              selectionColor={colors.primary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <Pressable
            onPress={() => void handleSearch()}
            style={({ pressed }) => [styles.searchButton, pressed && styles.buttonPressed]}
          >
            <LinearGradient
              colors={['#FF7A1A', '#FFB54A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchButtonGradient}
            >
              {isSearching ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#160A04" />
                  <Text style={styles.searchButtonText}>Searching...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="search" size={18} color="#160A04" />
                  <Text style={styles.searchButtonText}>Find User</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        {matchedUser ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>User Found</Text>
            <UserRow
              title={matchedUser.fullName}
              subtitle={`@${matchedUser.username}`}
              helper={`${matchedUser.classId.replace(/-/g, ' ')} / Section ${matchedUser.sectionId || 'Pending'}`}
              initials={getInitials(matchedUser.fullName)}
              badgeLabel={matchedUser.userCode}
            />

            <Pressable
              onPress={() =>
                navigation.navigate('Chat', {
                  targetUser: matchedUser,
                  connectCode: code.trim().toUpperCase(),
                })
              }
              style={({ pressed }) => [styles.startButton, pressed && styles.buttonPressed]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primarySoft} />
              <Text style={styles.startButtonText}>Start Chat</Text>
            </Pressable>
          </View>
        ) : null}
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
    top: 70,
    left: -130,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(151, 71, 255, 0.2)',
  },
  cosmicGlowBlue: {
    position: 'absolute',
    right: -150,
    top: 260,
    width: 305,
    height: 305,
    borderRadius: 153,
    backgroundColor: 'rgba(47, 139, 255, 0.14)',
  },
  orbitLine: {
    position: 'absolute',
    right: -64,
    top: 120,
    width: 280,
    height: 104,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.26)',
    borderRadius: 150,
    transform: [{ rotate: '-17deg' }],
  },
  starOne: {
    position: 'absolute',
    top: 88,
    right: 54,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C65BFF',
  },
  starTwo: {
    position: 'absolute',
    top: 430,
    left: 36,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#2F8BFF',
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
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 4,
  },
  backButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
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
    borderColor: 'rgba(47, 139, 255, 0.62)',
    overflow: 'hidden',
    shadowColor: '#2F8BFF',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 7,
  },
  heroGradient: {
    minHeight: 192,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -52,
    top: -62,
    width: 185,
    height: 185,
    borderRadius: 93,
    backgroundColor: 'rgba(47, 139, 255, 0.14)',
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(47, 139, 255, 0.72)',
    backgroundColor: 'rgba(47, 139, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F8BFF',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 5,
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    color: '#2F8BFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 36,
    lineHeight: 40,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.18)',
    textShadowRadius: 10,
  },
  subtitle: {
    color: '#C7BACD',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
    maxWidth: 330,
  },
  inputCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    backgroundColor: 'rgba(8, 6, 18, 0.92)',
    padding: 17,
    gap: 12,
    shadowColor: '#A855F7',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.58)',
    backgroundColor: 'rgba(255, 138, 26, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  cardText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  label: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    paddingVertical: 13,
  },
  inputShell: {
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.52)',
    backgroundColor: 'rgba(3, 3, 12, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    shadowColor: '#A855F7',
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  searchButton: {
    minHeight: 48,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.36,
    shadowRadius: 16,
    elevation: 6,
  },
  searchButtonGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  searchButtonText: {
    color: '#160A04',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: '#FFB083',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  previewCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.48)',
    backgroundColor: 'rgba(8, 6, 18, 0.92)',
    padding: 17,
    gap: 14,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  previewTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  startButton: {
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.72)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  startButtonText: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
