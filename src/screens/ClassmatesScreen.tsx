import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserRow } from '../components';
import { useAuth, useClassPresence } from '../hooks';
import { fetchClassmates } from '../services';
import { colors, typography } from '../theme';
import type { DmUser, MessagesStackParamList } from '../types';

type ClassmatesScreenProps = NativeStackScreenProps<MessagesStackParamList, 'Classmates'>;

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return 'ZN';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function formatClassScope(classId: string, sectionId: string) {
  const classLabel = classId.replace(/-/g, ' ');
  return `${classLabel} / Section ${sectionId || 'Pending'}`;
}

export function ClassmatesScreen({ navigation }: ClassmatesScreenProps) {
  const { profile, user } = useAuth();
  const { isUserActive } = useClassPresence();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [classmates, setClassmates] = useState<DmUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadClassmates() {
    if (!user?.id || !profile?.schoolId || !profile?.classId || !profile?.sectionId) {
      setClassmates([]);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);
      const data = await fetchClassmates(user.id, profile);
      setClassmates(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load classmates right now.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      setIsLoading(true);
      void loadClassmates();
    }
  }, [isFocused, profile?.classId, profile?.schoolId, profile?.sectionId, user?.id]);

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await loadClassmates();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowOrange} />
      <View pointerEvents="none" style={styles.orbitLine} />
      <View pointerEvents="none" style={styles.starOne} />
      <View pointerEvents="none" style={styles.starTwo} />
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
            colors={['rgba(17, 9, 36, 0.96)', 'rgba(8, 5, 15, 0.96)', 'rgba(31, 11, 8, 0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View pointerEvents="none" style={styles.heroGlow} />
            <View style={styles.heroIcon}>
              <Ionicons name="people" size={28} color="#B76BFF" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Your Class</Text>
              <Text style={styles.title}>Classmates</Text>
              <Text style={styles.subtitle}>
                These students share your school, class, and section scope, so you can message them directly.
              </Text>
            </View>
          </LinearGradient>
        </View>

        {errorMessage ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Classmates unavailable</Text>
            <Text style={styles.feedbackText}>{errorMessage}</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Loading classmates</Text>
            <Text style={styles.feedbackText}>Building your safe classroom contact list now.</Text>
          </View>
        ) : classmates.length > 0 ? (
          <View style={styles.list}>
            {classmates.map((classmate) => (
              <UserRow
                key={classmate.id}
                title={classmate.fullName}
                subtitle={`@${classmate.username}`}
                helper={formatClassScope(classmate.classId, classmate.sectionId)}
                initials={getInitials(classmate.fullName)}
                isActive={isUserActive(classmate.id)}
                showPresence
                badgeLabel="Your Class"
                onPress={() => navigation.navigate('Chat', { targetUser: classmate })}
                actionLabel="Message"
                onActionPress={() => navigation.navigate('Chat', { targetUser: classmate })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>No classmates visible</Text>
            <Text style={styles.feedbackText}>
              Once more students join your exact class scope, they will appear here for direct messaging.
            </Text>
          </View>
        )}
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
    top: 80,
    left: -120,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(151, 71, 255, 0.2)',
  },
  cosmicGlowOrange: {
    position: 'absolute',
    right: -140,
    top: 230,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 122, 45, 0.14)',
  },
  orbitLine: {
    position: 'absolute',
    right: -70,
    top: 130,
    width: 285,
    height: 100,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.28)',
    borderRadius: 150,
    transform: [{ rotate: '-17deg' }],
  },
  starOne: {
    position: 'absolute',
    top: 92,
    right: 64,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C65BFF',
  },
  starTwo: {
    position: 'absolute',
    top: 402,
    left: 34,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF8A1A',
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
    borderColor: 'rgba(255, 138, 26, 0.58)',
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 7,
  },
  heroGradient: {
    minHeight: 188,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -54,
    top: -70,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255, 138, 26, 0.12)',
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(183, 107, 255, 0.66)',
    backgroundColor: 'rgba(114, 45, 210, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    color: '#B76BFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 38,
    lineHeight: 42,
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
  list: {
    gap: 12,
  },
  feedbackCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.48)',
    backgroundColor: 'rgba(8, 6, 18, 0.9)',
    padding: 18,
    gap: 8,
    shadowColor: '#A855F7',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
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
