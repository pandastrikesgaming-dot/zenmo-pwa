import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../hooks';
import { isValidSection } from '../lib/normalizeSectionId';
import { fetchNoteById, fetchNoteRequestById } from '../services';
import { colors, typography } from '../theme';
import type { NoteRequest, RecentNote, RequestsStackParamList, RootStackParamList } from '../types';

type RequestDetailScreenProps = CompositeScreenProps<
  NativeStackScreenProps<RequestsStackParamList, 'RequestDetail'>,
  NativeStackScreenProps<RootStackParamList>
>;

function getStatusAccent(status: NoteRequest['status']) {
  if (status === 'fulfilled') {
    return colors.accentBlue;
  }

  if (status === 'closed') {
    return colors.muted;
  }

  return colors.primary;
}

export function RequestDetailScreen({ navigation, route }: RequestDetailScreenProps) {
  const { requestId } = route.params;
  const { profile } = useAuth();
  const [request, setRequest] = useState<NoteRequest | null>(null);
  const [fulfilledNote, setFulfilledNote] = useState<RecentNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequest() {
      if (!profile?.schoolId || !profile?.classId || !isValidSection(profile?.sectionId ?? '')) {
        if (isMounted) {
          setRequest(null);
          setErrorMessage('Update your profile scope to view this request.');
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        setFulfilledNote(null);
        const data = await fetchNoteRequestById({
          requestId,
          schoolId: profile.schoolId,
          classId: profile.classId,
          sectionId: profile.sectionId,
        });

        if (isMounted) {
          if (data) {
            setRequest(data);

            if (data.fulfilledByNoteId) {
              try {
                const linkedNote = await fetchNoteById({
                  noteId: data.fulfilledByNoteId,
                  schoolId: profile.schoolId,
                  classId: profile.classId,
                  sectionId: profile.sectionId,
                });

                if (isMounted) {
                  setFulfilledNote(linkedNote);
                }
              } catch {
                if (isMounted) {
                  setFulfilledNote(null);
                }
              }
            } else {
              setFulfilledNote(null);
            }
          } else {
            setErrorMessage('This request is no longer available in your section scope.');
          }
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : 'Unable to load this request right now.';
          setErrorMessage(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRequest();

    return () => {
      isMounted = false;
    };
  }, [profile?.classId, profile?.schoolId, profile?.sectionId, requestId]);

  const statusAccent = request ? getStatusAccent(request.status) : colors.primary;
  const canUploadForRequest = request?.status === 'open';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.cosmicGlowPurple} />
      <View pointerEvents="none" style={styles.cosmicGlowOrange} />
      <View pointerEvents="none" style={styles.cosmicGlowBlue} />
      <View pointerEvents="none" style={styles.orbitLine} />
      <View pointerEvents="none" style={styles.starOne} />
      <View pointerEvents="none" style={styles.starTwo} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressedCard]}
          >
            <Ionicons name="chevron-back" size={19} color="#D8B6FF" />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.feedbackText}>Loading request details...</Text>
          </View>
        ) : request ? (
          <>
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['rgba(16, 8, 40, 0.96)', 'rgba(4, 3, 12, 0.99)', 'rgba(36, 10, 7, 0.9)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              >
                <View pointerEvents="none" style={styles.heroGlow} />
                <View pointerEvents="none" style={styles.heroOrbit} />
                <View pointerEvents="none" style={styles.heroSpark} />

                <Text style={styles.eyebrow}>Request Detail</Text>
                <Text style={styles.title}>{request.title}</Text>

                <View style={styles.infoRow}>
                  <View style={[styles.infoPill, styles.subjectPill, { borderColor: request.accentColor }]}>
                    <Text style={[styles.infoPillText, { color: request.accentColor }]}>
                      {request.subject}
                    </Text>
                  </View>
                  <View style={[styles.infoPill, styles.statusPill, { borderColor: statusAccent }]}>
                    <Text style={[styles.infoPillText, { color: statusAccent }]}>
                      {request.status}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.detailCard}>
              <LinearGradient
                colors={['rgba(23, 13, 29, 0.94)', 'rgba(8, 6, 16, 0.98)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.detailGradient}
              >
                <Text style={styles.sectionLabel}>Description</Text>
                <Text style={styles.descriptionText}>
                  {request.description || 'No extra description was included for this request.'}
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.detailCard}>
              <LinearGradient
                colors={['rgba(14, 8, 28, 0.96)', 'rgba(5, 4, 13, 0.98)', 'rgba(17, 8, 10, 0.92)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.detailGradient}
              >
                <View style={styles.metaItem}>
                  <View style={styles.metaIcon}>
                    <Ionicons name="person-outline" size={19} color="#FFB54A" />
                  </View>
                  <View style={styles.metaCopy}>
                    <Text style={styles.sectionLabel}>Requester</Text>
                    <Text style={styles.metaValue}>{request.userName}</Text>
                  </View>
                </View>

                <View style={styles.metaDivider} />

                <View style={styles.metaItem}>
                  <View style={styles.metaIcon}>
                    <Ionicons name="time-outline" size={19} color="#FFB54A" />
                  </View>
                  <View style={styles.metaCopy}>
                    <Text style={styles.sectionLabel}>Created</Text>
                    <Text style={styles.metaValue}>{request.createdLabel}</Text>
                  </View>
                </View>

                <View style={styles.metaDivider} />

                <View style={styles.metaItem}>
                  <View style={styles.metaIcon}>
                    <Ionicons name="school-outline" size={19} color="#FFB54A" />
                  </View>
                  <View style={styles.metaCopy}>
                    <Text style={styles.sectionLabel}>Scope</Text>
                    <Text style={styles.metaValue}>
                      {request.classId.replace(/-/g, ' ')} / Section {request.sectionId}
                    </Text>
                  </View>
                </View>

                {request.status === 'fulfilled' ? (
                  <>
                    <View style={styles.metaDivider} />

                    <View style={styles.metaItem}>
                      <View style={styles.metaIcon}>
                        <Ionicons name="checkmark-circle-outline" size={19} color={colors.accentBlue} />
                      </View>
                      <View style={styles.metaCopy}>
                        <Text style={styles.sectionLabel}>Fulfilled</Text>
                        <Text style={styles.metaValue}>{request.fulfilledLabel ?? 'Recently fulfilled'}</Text>
                      </View>
                    </View>

                    <View style={styles.metaDivider} />

                    <View style={styles.metaItem}>
                      <View style={styles.metaIcon}>
                        <Ionicons name="person-circle-outline" size={19} color={colors.accentBlue} />
                      </View>
                      <View style={styles.metaCopy}>
                        <Text style={styles.sectionLabel}>Fulfilled By</Text>
                        <Text style={styles.metaValue}>
                          {fulfilledNote?.userName ||
                            (request.fulfilledByUserId === request.userId ? request.userName : 'Unknown')}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </LinearGradient>
            </View>

            {canUploadForRequest ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('MainTabs', {
                    screen: 'Upload',
                    params: {
                      requestId: request.id,
                      requestTitle: request.title,
                      requestSubject: request.subject,
                    },
                  })
                }
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedCard]}
              >
                <LinearGradient
                  colors={['#FF7A1A', '#FFB54A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Ionicons name="cloud-upload-outline" size={21} color="#120A05" />
                  <Text style={styles.primaryButtonText}>Upload Note for This Request</Text>
                </LinearGradient>
              </Pressable>
            ) : request.status === 'fulfilled' && request.fulfilledByNoteId ? (
              <Pressable
                disabled={!fulfilledNote}
                onPress={() => {
                  if (fulfilledNote) {
                    navigation.navigate('NoteDetail', { note: fulfilledNote });
                  }
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !fulfilledNote && styles.primaryButtonDisabled,
                  pressed && fulfilledNote && styles.pressedCard,
                ]}
              >
                <LinearGradient
                  colors={fulfilledNote ? ['#FF7A1A', '#FFB54A'] : ['#554239', '#6B574D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Ionicons name="document-text-outline" size={21} color="#120A05" />
                  <Text style={styles.primaryButtonText}>View Uploaded Note</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.closedCard}>
                <LinearGradient
                  colors={['rgba(18, 12, 20, 0.96)', 'rgba(8, 6, 14, 0.98)']}
                  style={styles.closedGradient}
                >
                  <Ionicons
                    name={request.status === 'closed' ? 'lock-closed-outline' : 'checkmark-done-outline'}
                    size={21}
                    color="rgba(247, 240, 232, 0.66)"
                  />
                  <Text style={styles.closedCardText}>
                    {request.status === 'closed'
                      ? 'This request is closed.'
                      : 'This request has already been fulfilled.'}
                  </Text>
                </LinearGradient>
              </View>
            )}
          </>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Request unavailable</Text>
            <Text style={styles.feedbackText}>{errorMessage ?? 'This request could not be found.'}</Text>
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
    top: 78,
    left: -118,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(151, 71, 255, 0.19)',
  },
  cosmicGlowOrange: {
    position: 'absolute',
    top: 180,
    right: -135,
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: 'rgba(255, 138, 26, 0.15)',
  },
  cosmicGlowBlue: {
    position: 'absolute',
    top: 430,
    left: -142,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(47, 139, 255, 0.1)',
  },
  orbitLine: {
    position: 'absolute',
    top: 120,
    right: -58,
    width: 290,
    height: 98,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.34)',
    borderRadius: 150,
    transform: [{ rotate: '-18deg' }],
  },
  starOne: {
    position: 'absolute',
    top: 104,
    right: 72,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#B65CFF',
    shadowColor: '#B65CFF',
    shadowOpacity: 0.8,
    shadowRadius: 9,
  },
  starTwo: {
    position: 'absolute',
    top: 326,
    left: 32,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF8A1A',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.62)',
    backgroundColor: 'rgba(8, 6, 20, 0.88)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#A855F7',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  backLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.66)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 7,
  },
  heroGradient: {
    minHeight: 178,
    padding: 22,
    gap: 13,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -70,
    bottom: -68,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255, 138, 26, 0.18)',
  },
  heroOrbit: {
    position: 'absolute',
    right: -28,
    top: 65,
    width: 176,
    height: 62,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.36)',
    borderRadius: 90,
    transform: [{ rotate: '-18deg' }],
  },
  heroSpark: {
    position: 'absolute',
    right: 38,
    top: 32,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C65BFF',
    shadowColor: '#C65BFF',
    shadowOpacity: 0.85,
    shadowRadius: 10,
  },
  eyebrow: {
    color: '#6E8CFF',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 38,
    lineHeight: 43,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.16)',
    textShadowRadius: 9,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoPill: {
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: 'rgba(6, 4, 16, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  subjectPill: {
    shadowColor: '#2F8BFF',
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  statusPill: {
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  infoPillText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.42)',
    backgroundColor: 'rgba(10, 7, 18, 0.9)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.13,
    shadowRadius: 14,
  },
  detailGradient: {
    padding: 18,
    gap: 12,
  },
  sectionLabel: {
    color: '#FFB54A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  descriptionText: {
    color: 'rgba(247, 240, 232, 0.76)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    lineHeight: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  metaIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.48)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCopy: {
    flex: 1,
    gap: 3,
  },
  metaDivider: {
    height: 1,
    backgroundColor: 'rgba(247, 240, 232, 0.08)',
  },
  metaValue: {
    color: 'rgba(247, 240, 232, 0.86)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryGradient: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#120A05',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  closedCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.12)',
  },
  closedGradient: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  closedCardText: {
    color: 'rgba(247, 240, 232, 0.68)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
    textAlign: 'center',
  },
  feedbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.44)',
    backgroundColor: 'rgba(10, 7, 18, 0.92)',
    padding: 18,
    gap: 10,
    alignItems: 'flex-start',
  },
  feedbackTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textTransform: 'uppercase',
  },
  feedbackText: {
    color: 'rgba(247, 240, 232, 0.68)',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
  },
  pressedCard: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
});
