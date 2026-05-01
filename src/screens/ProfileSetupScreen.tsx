import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SchoolSelector } from '../components';
import { fixedSubjects } from '../constants/subjects';
import { useAuth } from '../hooks';
import { isValidSection, normalizeSectionId } from '../lib/normalizeSectionId';
import { colors, typography } from '../theme';

const classOptions = [
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

const subjectOptions = [...fixedSubjects];

const BACKDROP_DOTS = Array.from({ length: 92 }, (_, index) => ({
  id: index,
  left: `${(index * 19) % 100}%` as DimensionValue,
  top: `${(index * 31) % 100}%` as DimensionValue,
  opacity: 0.09 + ((index * 5) % 4) * 0.035,
}));

export function ProfileSetupScreen() {
  const { completeProfile, loading, user } = useAuth();
  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
  );
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('Class 10');
  const [section, setSection] = useState('');
  const [sectionTouched, setSectionTouched] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'section' | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Maths', 'Physics']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = loading || isSubmitting;
  const sectionIsValid = isValidSection(section);
  const showSectionError = sectionTouched && !sectionIsValid;
  const canSubmit = useMemo(
    () =>
      Boolean(
        fullName.trim() &&
          selectedSchoolId &&
          selectedClass &&
          sectionIsValid &&
          !isBusy
      ),
    [fullName, isBusy, sectionIsValid, selectedClass, selectedSchoolId]
  );

  function toggleSubject(subject: string) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  async function handleCompleteSetup() {
    setSectionTouched(true);

    if (!canSubmit) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await completeProfile({
        fullName,
        schoolId: selectedSchoolId ?? '',
        classLabel: selectedClass,
        sectionId: normalizeSectionId(section),
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[ProfileSetupScreen] completeProfile failed', error);
      }

      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to complete profile setup right now.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#030207', '#10051F', '#160506', '#030207']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
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
                  opacity: dot.opacity,
                  top: dot.top,
                },
              ]}
            />
          ))}
        </View>

        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerKickerRow}>
              <View style={styles.kickerDot} />
              <Text style={styles.kicker}>Zenmo onboarding</Text>
            </View>

            <Text style={styles.title}>Build Your Profile</Text>
            <Text style={styles.subtitle}>
              Set your school, class, and section to unlock your class notes.
            </Text>
          </View>

          <View style={styles.setupCard}>
            <LinearGradient
              colors={[
                'rgba(166, 92, 255, 0.18)',
                'rgba(6, 4, 13, 0.96)',
                'rgba(255, 138, 26, 0.1)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            />
            <View pointerEvents="none" style={styles.cardGlow} />

            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="person-add-outline" size={22} color={colors.primarySoft} />
              </View>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardTitle}>Profile setup</Text>
                <Text style={styles.cardHint}>Your class vault opens after this.</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField('name')}
                placeholder="e.g. Alex Rivera"
                placeholderTextColor="#756B7E"
                style={[styles.input, focusedField === 'name' && styles.inputFocused]}
                selectionColor={colors.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <SchoolSelector
                label="School"
                selectedSchoolSlug={selectedSchoolId}
                onSelect={(school) => setSelectedSchoolId(school?.slug ?? null)}
                placeholder="Search your school..."
                userId={user?.id}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Class</Text>
              <View style={styles.classGrid}>
                {classOptions.map((item) => {
                  const isSelected = selectedClass === item;

                  return (
                    <Pressable
                      key={item}
                      onPress={() => setSelectedClass(item)}
                      style={({ pressed }) => [
                        styles.classChip,
                        isSelected && styles.classChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      {isSelected ? (
                        <LinearGradient
                          colors={['#FF8A1A', '#FFB54A']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.classChipGradient}
                        />
                      ) : null}
                      <Text style={[styles.classText, isSelected && styles.classTextActive]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Section</Text>
              <TextInput
                value={section}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField('section')}
                onChangeText={(value) => {
                  setSectionTouched(true);
                  setSection(normalizeSectionId(value));
                }}
                placeholder="e.g. A"
                placeholderTextColor="#756B7E"
                style={[styles.input, focusedField === 'section' && styles.inputFocused]}
                selectionColor={colors.primary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {showSectionError ? (
                <Text style={styles.errorText}>Section must be a single letter (A-Z)</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.subjectCard}>
            <Text style={styles.sectionTitle}>Interested Subjects</Text>
            <View style={styles.subjectGrid}>
              {subjectOptions.map((subject) => {
                const isSelected = selectedSubjects.includes(subject);

                return (
                  <Pressable
                    key={subject}
                    onPress={() => toggleSubject(subject)}
                    style={({ pressed }) => [
                      styles.subjectChip,
                      isSelected && styles.subjectChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.subjectText, isSelected && styles.subjectTextActive]}>
                      {subject}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="information-circle-outline" size={23} color={colors.primarySoft} />
            </View>
            <Text style={styles.infoText}>
              Your notes feed is based on your school, class, and section.
            </Text>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            disabled={!canSubmit}
            onPress={() => void handleCompleteSetup()}
            style={({ pressed }) => [
              styles.ctaButton,
              !canSubmit && styles.ctaButtonDisabled,
              pressed && canSubmit && styles.ctaButtonPressed,
            ]}
          >
            <LinearGradient
              colors={canSubmit ? ['#FF7A1A', '#FFB54A'] : ['#3A3333', '#4B3D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {isBusy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#1A100A" />
                  <Text style={styles.ctaButtonText}>Saving...</Text>
                </View>
              ) : (
                <Text style={styles.ctaButtonText}>Enter Zenmo</Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030207',
  },
  background: {
    flex: 1,
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  purpleOrb: {
    position: 'absolute',
    left: -120,
    top: 120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(166, 92, 255, 0.16)',
  },
  orangeOrb: {
    position: 'absolute',
    right: -130,
    bottom: 80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 138, 26, 0.13)',
  },
  backdropDot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#A66BFF',
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 18,
  },
  header: {
    gap: 10,
    paddingTop: 6,
  },
  headerKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  kicker: {
    color: '#A66BFF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 38,
    lineHeight: 42,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(166, 92, 255, 0.32)',
    textShadowRadius: 14,
  },
  subtitle: {
    color: '#BDB2C5',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  setupCard: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.58)',
    borderRadius: 22,
    backgroundColor: 'rgba(5, 4, 13, 0.92)',
    padding: 16,
    gap: 16,
    overflow: 'hidden',
    shadowColor: '#A66BFF',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGlow: {
    position: 'absolute',
    right: -60,
    top: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255, 138, 26, 0.13)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.64)',
    backgroundColor: 'rgba(255, 138, 26, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    textTransform: 'uppercase',
  },
  cardHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  input: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.46)',
    backgroundColor: 'rgba(3, 3, 12, 0.8)',
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputFocused: {
    borderColor: 'rgba(255, 138, 26, 0.86)',
    shadowColor: colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  classChip: {
    minHeight: 42,
    minWidth: 93,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.35)',
    backgroundColor: 'rgba(4, 3, 11, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  classChipActive: {
    borderColor: 'rgba(255, 181, 74, 0.9)',
    shadowColor: colors.primary,
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 5,
  },
  classChipGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  classText: {
    color: '#D4C8D9',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  classTextActive: {
    color: '#170A04',
  },
  subjectCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.26)',
    borderRadius: 18,
    backgroundColor: 'rgba(6, 4, 11, 0.78)',
    padding: 15,
    gap: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    textTransform: 'uppercase',
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: 'rgba(166, 92, 255, 0.32)',
    backgroundColor: 'rgba(4, 3, 11, 0.72)',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  subjectChipActive: {
    borderColor: 'rgba(255, 181, 74, 0.82)',
    backgroundColor: 'rgba(255, 138, 26, 0.16)',
  },
  subjectText: {
    color: '#D4C8D9',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  subjectTextActive: {
    color: colors.primarySoft,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: 'rgba(166, 92, 255, 0.4)',
    borderRadius: 16,
    backgroundColor: 'rgba(14, 8, 26, 0.78)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.5)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    color: '#D4C8D9',
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
  ctaButton: {
    minHeight: 58,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 15,
    elevation: 7,
  },
  ctaButtonDisabled: {
    opacity: 0.58,
    shadowOpacity: 0,
  },
  ctaButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  ctaGradient: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  ctaButtonText: {
    color: '#160A04',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
