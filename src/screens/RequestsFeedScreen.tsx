import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../hooks';
import { isValidSection } from '../lib/normalizeSectionId';
import { fetchFulfilledScopedNoteRequests, fetchMyNoteRequests, fetchOpenScopedNoteRequests } from '../services';
import { colors, typography } from '../theme';
import type { NoteRequest, RequestsStackParamList } from '../types';

type RequestsFeedScreenProps = NativeStackScreenProps<RequestsStackParamList, 'RequestsFeed'>;

type FilterMode = 'open' | 'fulfilled' | 'mine';

function getStatusAccent(status: NoteRequest['status']) {
  if (status === 'fulfilled') {
    return colors.accentBlue;
  }

  if (status === 'closed') {
    return colors.muted;
  }

  return colors.primary;
}

function getDescriptionPreview(value: string) {
  if (!value.trim()) {
    return 'No extra description provided yet.';
  }

  return value.length > 96 ? `${value.slice(0, 93)}...` : value;
}

export function RequestsFeedScreen({ navigation }: RequestsFeedScreenProps) {
  const { profile, user } = useAuth();
  const isFocused = useIsFocused();
  const [requests, setRequests] = useState<NoteRequest[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('open');

  async function loadRequests() {
    if (!profile?.schoolId || !profile?.classId || !isValidSection(profile?.sectionId ?? '')) {
      setRequests([]);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    if (filterMode === 'mine' && !user?.id) {
      setRequests([]);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);
      const data =
        filterMode === 'fulfilled'
          ? await fetchFulfilledScopedNoteRequests({
              schoolId: profile.schoolId,
              classId: profile.classId,
              sectionId: profile.sectionId,
            })
          : filterMode === 'mine'
            ? await fetchMyNoteRequests(user?.id ?? '')
            : await fetchOpenScopedNoteRequests({
                schoolId: profile.schoolId,
                classId: profile.classId,
                sectionId: profile.sectionId,
              });
      setRequests(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load request board right now.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      setIsLoading(true);
      void loadRequests();
    }
  }, [filterMode, isFocused, profile?.classId, profile?.schoolId, profile?.sectionId, user?.id]);

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await loadRequests();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowOrange} />
      <View pointerEvents="none" style={styles.lightStreak} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('RequestNote')} style={styles.createButton}>
            <LinearGradient
              colors={['#FF8427', '#FF4B72']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.createButtonGradient}
            >
              <Ionicons name="add" size={23} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Request</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(143, 44, 255, 0.18)', 'rgba(5, 3, 11, 0.9)', 'rgba(255, 132, 39, 0.14)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroPlanetGlow} />
          <View style={styles.heroStreak} />
          <Text style={styles.eyebrow}>Community Demand</Text>
          <Text style={styles.title}>Requests Feed</Text>
          <Text style={styles.subtitle}>
            Live note requests from your school, class, and section only.
          </Text>
        </View>

        <View style={styles.filterRow}>
          {(['open', 'fulfilled', 'mine'] as const).map((mode) => {
            const active = filterMode === mode;

            return (
              <Pressable
                key={mode}
                onPress={() => setFilterMode(mode)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {mode === 'open'
                    ? 'Open'
                    : mode === 'fulfilled'
                      ? 'Fulfilled'
                      : 'My Requests'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {errorMessage ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Request board unavailable</Text>
            <Text style={styles.feedbackText}>{errorMessage}</Text>
            <Pressable onPress={() => void handleRefresh()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Loading requests</Text>
            <Text style={styles.feedbackText}>Refreshing your class request board now.</Text>
          </View>
        ) : requests.length > 0 ? (
          <View style={styles.requestList}>
            {requests.map((request) => {
              const statusAccent = getStatusAccent(request.status);

              return (
                <Pressable
                  key={request.id}
                  onPress={() => navigation.navigate('RequestDetail', { requestId: request.id })}
                  style={({ pressed }) => [
                    styles.requestCard,
                    pressed && styles.requestCardPressed,
                  ]}
                >
                  <LinearGradient
                    colors={[
                      'rgba(143, 44, 255, 0.14)',
                      'rgba(5, 3, 11, 0.96)',
                      'rgba(255, 132, 39, 0.1)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.requestCardGradient}
                  />
                  <View style={styles.requestPlanetGlow} />
                  <View style={[styles.requestCornerGlow, { backgroundColor: statusAccent }]} />
                  <View style={styles.requestHeader}>
                    <View style={[styles.subjectPill, { borderColor: request.accentColor }]}>
                      <Text style={[styles.subjectPillText, { color: request.accentColor }]}>
                        {request.subject}
                      </Text>
                    </View>

                    <View style={[styles.statusPill, { borderColor: statusAccent }]}>
                      <Text style={[styles.statusPillText, { color: statusAccent }]}>
                        {request.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.requestTitle}>{request.title}</Text>
                  <Text style={styles.requestPreview}>{getDescriptionPreview(request.description)}</Text>

                  <View style={styles.requestFooter}>
                    <Text style={styles.requestMeta}>Requested by {request.userName}</Text>
                    <Text style={styles.requestMeta}>{request.createdLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>
              {filterMode === 'fulfilled'
                ? 'No fulfilled requests'
                : filterMode === 'mine'
                  ? 'No requests posted yet'
                  : 'No open requests'}
            </Text>
            <Text style={styles.feedbackText}>
              {filterMode === 'fulfilled'
                ? 'Fulfilled requests will appear here once classmates upload notes for them.'
                : filterMode === 'mine'
                  ? 'Create your first note request for classmates in your section.'
                  : 'Be the first to ask your classmates for a note set in this section.'}
            </Text>
            <Pressable onPress={() => navigation.navigate('RequestNote')} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Create request</Text>
            </Pressable>
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
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 4,
    gap: 28,
  },
  cosmicGlowPurple: {
    position: 'absolute',
    top: 116,
    left: -84,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(143, 44, 255, 0.16)',
  },
  cosmicGlowOrange: {
    position: 'absolute',
    top: 254,
    right: -116,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 132, 39, 0.12)',
  },
  lightStreak: {
    position: 'absolute',
    top: 156,
    right: -34,
    width: 210,
    height: 2,
    backgroundColor: 'rgba(255, 132, 39, 0.24)',
    transform: [{ rotate: '-24deg' }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(181, 123, 255, 0.42)',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 6, 15, 0.84)',
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  backLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  createButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF8427',
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#A13BFF',
    borderRadius: 18,
    backgroundColor: '#07030D',
    padding: 24,
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPlanetGlow: {
    position: 'absolute',
    right: -58,
    bottom: -82,
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 3,
    borderColor: 'rgba(255, 132, 39, 0.35)',
    backgroundColor: 'rgba(104, 37, 153, 0.16)',
  },
  heroStreak: {
    position: 'absolute',
    right: -32,
    bottom: 68,
    width: 220,
    height: 2,
    backgroundColor: 'rgba(255, 132, 39, 0.34)',
    transform: [{ rotate: '-24deg' }],
  },
  eyebrow: {
    color: '#4C7CFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 42,
    lineHeight: 48,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    maxWidth: 310,
    color: '#B9B1B9',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 18,
    lineHeight: 28,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(157, 82, 255, 0.45)',
    borderRadius: 8,
    backgroundColor: 'rgba(6, 4, 11, 0.84)',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  filterChipActive: {
    borderColor: '#FF8427',
    backgroundColor: 'rgba(255, 132, 39, 0.12)',
    shadowColor: '#FF8427',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  filterChipText: {
    color: '#8F8792',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterChipTextActive: {
    color: '#FF8427',
  },
  requestList: {
    gap: 18,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: 'rgba(169, 61, 255, 0.52)',
    borderRadius: 18,
    backgroundColor: '#06040B',
    padding: 20,
    gap: 16,
    overflow: 'hidden',
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  requestCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  requestCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  requestPlanetGlow: {
    position: 'absolute',
    right: -64,
    bottom: -76,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: 'rgba(255, 132, 39, 0.18)',
    backgroundColor: 'rgba(143, 44, 255, 0.08)',
  },
  requestCornerGlow: {
    position: 'absolute',
    right: -38,
    top: -38,
    width: 86,
    height: 86,
    borderRadius: 43,
    opacity: 0.08,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  subjectPill: {
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: 'rgba(61, 137, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#4D95FF',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  subjectPillText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 132, 39, 0.08)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    shadowColor: '#FF8427',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  statusPillText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  requestTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 31,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  requestPreview: {
    color: '#B0A8B0',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 17,
    lineHeight: 24,
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestMeta: {
    flex: 1,
    color: '#A9A1A9',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: 'rgba(169, 61, 255, 0.42)',
    borderRadius: 16,
    backgroundColor: 'rgba(8, 5, 14, 0.9)',
    padding: 20,
    gap: 12,
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
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 132, 39, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
