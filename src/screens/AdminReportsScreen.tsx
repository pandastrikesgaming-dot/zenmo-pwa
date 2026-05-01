import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks';
import {
  fetchAdminNoteReports,
  setAdminUserBan,
  updateAdminReportStatus,
} from '../services';
import { colors, typography } from '../theme';
import type { AdminNoteReport, NoteReportStatus, RootStackParamList } from '../types';

type AdminReportsScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminReports'>;

const STATUS_OPTIONS: NoteReportStatus[] = ['pending', 'reviewed', 'dismissed', 'action_taken'];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getStatusLabel(status: NoteReportStatus) {
  return status.replace('_', ' ').toUpperCase();
}

export function AdminReportsScreen({ navigation }: AdminReportsScreenProps) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<AdminNoteReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminNoteReport | null>(null);
  const [banReason, setBanReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const pendingCount = useMemo(
    () => reports.filter((report) => report.status === 'pending').length,
    [reports]
  );

  async function loadReports() {
    if (!profile?.isAdmin) {
      setReports([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchAdminNoteReports();
      setReports(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load reports right now.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [profile?.isAdmin]);

  async function handleStatusChange(report: AdminNoteReport, status: NoteReportStatus) {
    setIsSaving(true);

    try {
      await updateAdminReportStatus(report.id, status);
      await loadReports();
    } catch (error) {
      Alert.alert('Unable to update report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnban(report: AdminNoteReport) {
    setIsSaving(true);

    try {
      await setAdminUserBan(report.reportedUserId, false);
      await loadReports();
      Alert.alert('User unbanned', `${report.reportedUserName} can use Zenmo again.`);
    } catch (error) {
      Alert.alert('Unable to unban user', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmBan() {
    if (!banTarget) {
      return;
    }

    if (!banReason.trim()) {
      Alert.alert('Reason required', 'Add a short ban reason before continuing.');
      return;
    }

    setIsSaving(true);

    try {
      await setAdminUserBan(banTarget.reportedUserId, true, banReason);
      await updateAdminReportStatus(banTarget.id, 'action_taken');
      setBanTarget(null);
      setBanReason('');
      await loadReports();
      Alert.alert('User banned', `${banTarget.reportedUserName} has been restricted.`);
    } catch (error) {
      Alert.alert('Unable to ban user', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!profile?.isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.accessCard}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.primarySoft} />
          <Text style={styles.accessTitle}>Admin access required</Text>
          <Text style={styles.accessText}>Reports are only visible to Zenmo moderators.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.backCta}>
            <Text style={styles.backCtaText}>GO BACK</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <LinearGradient colors={['#050206', '#100508', '#050206']} style={styles.background} />
      <View pointerEvents="none" style={styles.purpleGlow} />
      <View pointerEvents="none" style={styles.orangeGlow} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.primarySoft} />
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
          <Pressable onPress={() => void loadReports()} style={styles.refreshButton}>
            <Ionicons name="refresh" size={19} color={colors.background} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.kicker}>ADMIN MODERATION</Text>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>{pendingCount} pending reports need review.</Text>
        </View>

        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading reports...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Unable to load reports</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No reports yet</Text>
            <Text style={styles.stateText}>Submitted note reports will appear here for review.</Text>
          </View>
        ) : (
          reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportTopRow}>
                <View style={styles.subjectPill}>
                  <Text style={styles.subjectText}>{report.note.subject}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{getStatusLabel(report.status)}</Text>
                </View>
              </View>

              <Text style={styles.noteTitle}>{report.note.title}</Text>
              <Text style={styles.metaText}>Uploader: {report.reportedUserName}</Text>
              <Text style={styles.metaText}>Reporter: {report.reporterName}</Text>
              <Text style={styles.metaText}>Reason: {report.reason}</Text>
              {report.details ? <Text style={styles.detailsText}>{report.details}</Text> : null}
              <Text style={styles.createdText}>{formatDate(report.createdAt)}</Text>

              <View style={styles.actionGrid}>
                {STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    disabled={isSaving}
                    onPress={() => void handleStatusChange(report, status)}
                    style={[
                      styles.statusButton,
                      report.status === status && styles.statusButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        report.status === status && styles.statusButtonTextActive,
                      ]}
                    >
                      {getStatusLabel(status)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.bottomActions}>
                <Pressable
                  onPress={() => navigation.navigate('NoteDetail', { note: report.note })}
                  style={styles.openNoteButton}
                >
                  <Ionicons name="open-outline" size={16} color={colors.background} />
                  <Text style={styles.openNoteText}>OPEN NOTE</Text>
                </Pressable>
                {report.reportedUserIsBanned ? (
                  <Pressable
                    disabled={isSaving}
                    onPress={() => void handleUnban(report)}
                    style={styles.unbanButton}
                  >
                    <Text style={styles.unbanText}>UNBAN USER</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    disabled={isSaving}
                    onPress={() => setBanTarget(report)}
                    style={styles.banButton}
                  >
                    <Text style={styles.banText}>BAN USER</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={banTarget !== null} transparent animationType="fade" onRequestClose={() => setBanTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.banModal}>
            <Text style={styles.modalTitle}>Ban uploader?</Text>
            <Text style={styles.modalText}>
              {banTarget?.reportedUserName} will be blocked from normal Zenmo actions.
            </Text>
            <TextInput
              value={banReason}
              onChangeText={setBanReason}
              placeholder="Ban reason"
              placeholderTextColor="#776A80"
              style={styles.banInput}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setBanTarget(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable disabled={isSaving} onPress={() => void handleConfirmBan()} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>BAN USER</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030303',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  purpleGlow: {
    position: 'absolute',
    left: -120,
    top: 120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(142, 44, 255, 0.24)',
  },
  orangeGlow: {
    position: 'absolute',
    right: -130,
    top: 260,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 138, 31, 0.2)',
  },
  content: {
    padding: 18,
    gap: 18,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    height: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(168, 91, 255, 0.55)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8, 5, 12, 0.92)',
  },
  backText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  refreshButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 31, 0.6)',
    backgroundColor: 'rgba(8, 5, 12, 0.92)',
    padding: 22,
  },
  kicker: {
    color: '#6AA9FF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 40,
    lineHeight: 44,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 8,
    color: '#B7ACBC',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  reportCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(168, 91, 255, 0.5)',
    backgroundColor: 'rgba(7, 5, 13, 0.94)',
    padding: 18,
    gap: 10,
  },
  reportTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  subjectPill: {
    borderWidth: 1,
    borderColor: '#64A6FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(28, 89, 170, 0.14)',
  },
  subjectText: {
    color: '#7FB8FF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  statusPill: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 138, 31, 0.12)',
  },
  statusText: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  noteTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    lineHeight: 32,
  },
  metaText: {
    color: '#C2B8C6',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  detailsText: {
    color: '#F4DBC1',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 138, 31, 0.08)',
  },
  createdText: {
    color: '#8F8496',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 91, 255, 0.42)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statusButtonActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 138, 31, 0.15)',
  },
  statusButtonText: {
    color: '#AFA2B9',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
  },
  statusButtonTextActive: {
    color: colors.primarySoft,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  openNoteButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  openNoteText: {
    color: colors.background,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  banButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FF4D3D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 77, 61, 0.1)',
  },
  banText: {
    color: '#FF7A66',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  unbanButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  unbanText: {
    color: '#7EF2C0',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  stateCard: {
    minHeight: 160,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(168, 91, 255, 0.38)',
    backgroundColor: 'rgba(8, 5, 12, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
  },
  stateText: {
    color: '#B7ACBC',
    textAlign: 'center',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  accessCard: {
    margin: 24,
    marginTop: 100,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 91, 255, 0.48)',
    backgroundColor: 'rgba(8, 5, 12, 0.94)',
    padding: 22,
    gap: 12,
  },
  accessTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
  },
  accessText: {
    color: '#B7ACBC',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
  },
  backCta: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  backCtaText: {
    color: colors.background,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: 24,
  },
  banModal: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 61, 0.62)',
    backgroundColor: '#060408',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 26,
  },
  modalText: {
    color: '#B7ACBC',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  banInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 31, 0.48)',
    color: colors.text,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 91, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#CDB8DD',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  modalConfirm: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FF4D3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#210400',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
  },
});
