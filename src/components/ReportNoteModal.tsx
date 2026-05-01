import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NoteReportReason, RecentNote } from '../types';

const REPORT_REASONS: NoteReportReason[] = [
  'Inappropriate content',
  'Spam',
  'Misleading / wrong note',
  'Harassment',
  'Other',
];

type ReportNoteModalProps = {
  visible: boolean;
  note: RecentNote | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: NoteReportReason, details?: string) => Promise<void> | void;
};

export function ReportNoteModal({
  visible,
  note,
  isSubmitting,
  onClose,
  onSubmit,
}: ReportNoteModalProps) {
  const [reason, setReason] = useState<NoteReportReason | null>(null);
  const [details, setDetails] = useState('');

  const requiresDetails = reason === 'Other';
  const canSubmit = Boolean(reason) && (!requiresDetails || details.trim().length > 0);

  async function handleSubmit() {
    if (!reason || !canSubmit) {
      return;
    }

    await onSubmit(reason, details);
    setReason(null);
    setDetails('');
  }

  function handleClose() {
    setReason(null);
    setDetails('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.kicker}>REPORT NOTE</Text>
                <Text style={styles.title}>{note?.title ?? 'Selected note'}</Text>
                <Text style={styles.subtitle}>Tell us what needs review. We only show names, never emails.</Text>
              </View>
              <Pressable accessibilityRole="button" style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={20} color="#FFF3E6" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.reasonList} keyboardShouldPersistTaps="handled">
              {REPORT_REASONS.map((item) => {
                const selected = item === reason;

                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    style={[styles.reasonButton, selected && styles.reasonButtonSelected]}
                    onPress={() => setReason(item)}
                  >
                    <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{item}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color="#FF9F2E" /> : null}
                  </Pressable>
                );
              })}

              {requiresDetails ? (
                <TextInput
                  multiline
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Add a few details for the moderation team"
                  placeholderTextColor="#786C82"
                  style={styles.detailsInput}
                  textAlignVertical="top"
                />
              ) : null}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit || isSubmitting}
              style={[styles.submitButton, (!canSubmit || isSubmitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
            >
              <Text style={styles.submitText}>{isSubmitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  safeArea: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(168, 91, 255, 0.62)',
    backgroundColor: '#050207',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    shadowColor: '#A855F7',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 58,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 138, 31, 0.55)',
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  kicker: {
    color: '#9E6CFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 4,
    color: '#FFF7EF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 6,
    maxWidth: 290,
    color: '#B7AABF',
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 31, 0.48)',
    backgroundColor: 'rgba(24, 10, 18, 0.9)',
  },
  reasonList: {
    gap: 10,
    paddingVertical: 18,
  },
  reasonButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(142, 98, 168, 0.45)',
    backgroundColor: 'rgba(18, 10, 23, 0.92)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reasonButtonSelected: {
    borderColor: '#FF8A1F',
    backgroundColor: 'rgba(85, 39, 3, 0.5)',
  },
  reasonText: {
    color: '#C7BBCD',
    fontSize: 14,
    fontWeight: '800',
  },
  reasonTextSelected: {
    color: '#FFF1D8',
  },
  detailsInput: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 31, 0.5)',
    backgroundColor: 'rgba(9, 7, 11, 0.96)',
    color: '#FFF7EF',
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8A1F',
    shadowColor: '#FF8A1F',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 9,
  },
  submitButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
  },
  submitText: {
    color: '#160A00',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
