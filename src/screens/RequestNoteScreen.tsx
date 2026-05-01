import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { fixedSubjects, getSubjectAccentColor } from '../constants/subjects';
import { useAuth } from '../hooks';
import { isValidSection } from '../lib/normalizeSectionId';
import { createNoteRequest, triggerRequestCreatedNotification } from '../services';
import { colors, typography } from '../theme';
import type { RequestsStackParamList, UploadSubject } from '../types';

type RequestNoteScreenProps = NativeStackScreenProps<RequestsStackParamList, 'RequestNote'>;

const subjects: UploadSubject[] = fixedSubjects.map((subject) => ({
  id: subject.toLowerCase(),
  label: subject,
  accentColor: getSubjectAccentColor(subject),
}));

function formatClassLabel(value: string) {
  return value.replace(/-/g, ' ');
}

export function RequestNoteScreen({ navigation }: RequestNoteScreenProps) {
  const { profile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id ?? '');
  const [titleTouched, setTitleTouched] = useState(false);
  const [focusedField, setFocusedField] = useState<'title' | 'description' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId]
  );
  const showTitleError = titleTouched && !title.trim();
  const canSubmit = Boolean(
    title.trim() &&
      selectedSubject &&
      profile?.schoolId &&
      profile?.classId &&
      isValidSection(profile?.sectionId ?? '') &&
      user?.id &&
      !isSaving
  );

  async function handleSubmit() {
    setTitleTouched(true);

    if (!canSubmit || !selectedSubject || !profile || !user?.id) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const createdRequest = await createNoteRequest({
        userId: user.id,
        userName: profile.fullName || 'Unknown',
        schoolId: profile.schoolId,
        classId: profile.classId,
        sectionId: profile.sectionId,
        subject: selectedSubject.label,
        title,
        description,
      });

      void triggerRequestCreatedNotification({ requestId: createdRequest.id }).catch((error) => {
        if (__DEV__) {
          console.error('[RequestNoteScreen] request created notification failed', error);
        }
      });

      navigation.replace('RequestDetail', { requestId: createdRequest.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create this note request right now.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Ionicons name="chevron-back" size={19} color="#D8B6FF" />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(17, 9, 36, 0.96)', 'rgba(8, 5, 15, 0.97)', 'rgba(31, 11, 8, 0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View pointerEvents="none" style={styles.heroGlow} />
            <View style={styles.heroIcon}>
              <Ionicons name="document-text-outline" size={28} color="#B76BFF" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Class Request Board</Text>
              <Text style={styles.title}>Request Notes</Text>
              <Text style={styles.subtitle}>
                Ask classmates in your scoped section for a specific note set.
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.scopeCard}>
          <View style={styles.scopeIcon}>
            <Ionicons name="school-outline" size={23} color={colors.primarySoft} />
          </View>
          <View style={styles.scopeCopy}>
            <Text style={styles.scopeLabel}>Shared With</Text>
            <Text style={styles.scopeValue}>
              {profile?.schoolId ? 'Your school' : 'School pending'} / {profile?.classId ? formatClassLabel(profile.classId) : 'Class pending'} / Section {profile?.sectionId || 'Pending'}
            </Text>
            <Text style={styles.scopeHint}>
              Zenmo applies your school, class, and section automatically.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Subject</Text>
            <View style={styles.chipRow}>
              {subjects.map((subject) => {
                const active = subject.id === selectedSubjectId;

                return (
                  <Pressable
                    key={subject.id}
                    onPress={() => setSelectedSubjectId(subject.id)}
                    style={({ pressed }) => [
                      styles.subjectChip,
                      active && styles.subjectChipActive,
                      pressed && styles.subjectChipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.subjectChipText,
                        active && styles.subjectChipTextActive,
                      ]}
                    >
                      {subject.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              value={title}
              onChangeText={(value) => {
                setTitleTouched(true);
                setTitle(value);
              }}
              placeholder="e.g. Trigonometry formulas worksheet"
              placeholderTextColor="rgba(199, 186, 205, 0.55)"
              style={[styles.input, focusedField === 'title' && styles.inputFocused]}
              selectionColor={colors.primary}
              onFocus={() => setFocusedField('title')}
              onBlur={() => setFocusedField(null)}
            />
            {showTitleError ? <Text style={styles.errorText}>Title is required</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional context: chapter, exam, teacher, or the exact pages you need."
              placeholderTextColor="rgba(199, 186, 205, 0.55)"
              style={[
                styles.input,
                styles.textArea,
                focusedField === 'description' && styles.inputFocused,
              ]}
              selectionColor={colors.primary}
              multiline
              textAlignVertical="top"
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {!profile?.schoolId || !profile?.classId || !isValidSection(profile?.sectionId ?? '') ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Profile scope required</Text>
              <Text style={styles.warningText}>
                Update your school, class, and section before posting a request.
              </Text>
            </View>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.saveButton,
              !canSubmit && styles.saveButtonDisabled,
              pressed && canSubmit && styles.saveButtonPressed,
            ]}
          >
            <LinearGradient
              colors={canSubmit ? ['#FF7A1A', '#FFB54A'] : ['rgba(42, 30, 25, 0.95)', 'rgba(42, 30, 25, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButtonGradient}
            >
              {isSaving ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#160A04" />
                  <Text style={styles.saveButtonText}>Creating...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color={canSubmit ? '#160A04' : colors.textMuted} />
                  <Text style={[styles.saveButtonText, !canSubmit && styles.saveButtonTextDisabled]}>
                    Create Request
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
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
    top: 74,
    left: -125,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(151, 71, 255, 0.2)',
  },
  cosmicGlowOrange: {
    position: 'absolute',
    right: -145,
    top: 250,
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: 'rgba(255, 122, 45, 0.15)',
  },
  orbitLine: {
    position: 'absolute',
    right: -66,
    top: 120,
    width: 290,
    height: 108,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.28)',
    borderRadius: 150,
    transform: [{ rotate: '-17deg' }],
  },
  starOne: {
    position: 'absolute',
    top: 92,
    right: 60,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C65BFF',
  },
  starTwo: {
    position: 'absolute',
    top: 435,
    left: 38,
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
    justifyContent: 'space-between',
  },
  backButton: {
    alignSelf: 'flex-start',
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
  backLabel: {
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
    minHeight: 192,
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
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.42)',
    backgroundColor: 'rgba(8, 6, 18, 0.92)',
    padding: 17,
    gap: 13,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  scopeIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.58)',
    backgroundColor: 'rgba(255, 138, 26, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  scopeLabel: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  scopeValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  scopeHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    backgroundColor: 'rgba(8, 6, 18, 0.92)',
    padding: 17,
    gap: 18,
    shadowColor: '#A855F7',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 5,
  },
  inputGroup: {
    gap: 11,
  },
  inputLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.46)',
    backgroundColor: 'rgba(3, 3, 12, 0.82)',
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    paddingHorizontal: 15,
    paddingVertical: 15,
    shadowColor: '#A855F7',
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  inputFocused: {
    borderColor: 'rgba(255, 138, 26, 0.86)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.28,
    shadowRadius: 13,
  },
  textArea: {
    minHeight: 120,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subjectChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.38)',
    backgroundColor: 'rgba(3, 3, 12, 0.72)',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  subjectChipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  subjectChipActive: {
    borderColor: 'rgba(255, 138, 26, 0.9)',
    backgroundColor: 'rgba(255, 138, 26, 0.16)',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  subjectChipText: {
    color: '#C7BACD',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  subjectChipTextActive: {
    color: colors.primarySoft,
  },
  warningCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.58)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    padding: 14,
    gap: 4,
  },
  warningTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  warningText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  errorText: {
    color: '#FFB287',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.36,
    shadowRadius: 16,
    elevation: 6,
  },
  saveButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  saveButtonGradient: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  saveButtonText: {
    color: '#160A04',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  saveButtonTextDisabled: {
    color: colors.textMuted,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
