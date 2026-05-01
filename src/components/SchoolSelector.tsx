import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { SchoolOption } from '../constants/schools';
import { buildSchoolSlug } from '../constants/schools';
import { fetchApprovedSchools, requestSchoolApproval } from '../services';
import { colors, typography } from '../theme';
import { highlightMatch, searchSchools } from '../utils/schoolSearch';

type SchoolSelectorProps = {
  label: string;
  selectedSchoolSlug: string | null;
  onSelect: (school: SchoolOption | null) => void;
  placeholder: string;
  userId?: string;
  fallbackText?: string;
  disabled?: boolean;
};

export function SchoolSelector({
  disabled = false,
  label,
  selectedSchoolSlug,
  onSelect,
  placeholder,
  userId,
  fallbackText,
}: SchoolSelectorProps) {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const committedSchoolNameRef = useRef<string | null>(null);
  const fallbackTextRef = useRef<string | undefined>(fallbackText);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.slug === selectedSchoolSlug) ?? null,
    [schools, selectedSchoolSlug]
  );

  const filteredSchools = useMemo(
    () => searchSchools(debouncedQuery, schools, 8),
    [debouncedQuery, schools]
  );

  const showResults = !disabled && (isFocused || (!selectedSchoolSlug && query.trim().length > 0));
  const canRequestSchool = Boolean(query.trim() && userId && !isRequesting && !disabled);

  useEffect(() => {
    let isMounted = true;

    async function loadSchools() {
      try {
        setIsLoading(true);
        const approvedSchools = await fetchApprovedSchools();

        if (!isMounted) {
          return;
        }

        setSchools(approvedSchools);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load schools right now.';
        setFeedbackMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSchools();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    committedSchoolNameRef.current = selectedSchool?.name ?? null;
    fallbackTextRef.current = fallbackText;
    setQuery(selectedSchool?.name ?? fallbackText ?? '');
  }, [fallbackText, selectedSchool?.name]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query);
    }, 240);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query]);

  function handleChange(text: string) {
    if (disabled) {
      return;
    }

    setQuery(text);
    setFeedbackMessage(null);

    if (selectedSchool && text !== selectedSchool.name) {
      onSelect(null);
    }
  }

  function handleSelectSchool(school: SchoolOption) {
    if (disabled) {
      return;
    }

    committedSchoolNameRef.current = school.name;
    fallbackTextRef.current = undefined;
    onSelect(school);
    setQuery(school.name);
    setFeedbackMessage(null);
    setIsFocused(false);
  }

  async function handleRequestSchool() {
    if (disabled || !userId || !query.trim()) {
      return;
    }

    try {
      setIsRequesting(true);
      setFeedbackMessage(null);

      const result = await requestSchoolApproval({
        name: query,
        userId,
        approvedSchools: schools,
      });

      if (result.type === 'existing-approved') {
        handleSelectSchool(result.school);
        setFeedbackMessage('That school is already approved and has been selected for you.');
        return;
      }

      if (result.type === 'existing-pending' || result.type === 'duplicate') {
        setFeedbackMessage('This school is already in our system and may already be awaiting approval.');
        return;
      }

      setFeedbackMessage(`School request submitted for ${result.name}. It will appear after approval.`);
      setIsFocused(false);
    } catch (error) {
      console.error('[SchoolSelector] request school failed', error);
      const message =
        error instanceof Error ? error.message : 'Unable to submit a school request right now.';
      setFeedbackMessage(message);
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={query}
        onChangeText={handleChange}
        onFocus={() => {
          if (!disabled) {
            setIsFocused(true);
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            setIsFocused(false);
            setQuery((current) => committedSchoolNameRef.current ?? fallbackTextRef.current ?? current);
          }, 140);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, disabled && styles.inputDisabled]}
        selectionColor={colors.primary}
        autoCapitalize="words"
        editable={!disabled}
      />

      {selectedSchool ? (
        <View style={styles.selectedChip}>
          <Text style={styles.selectedChipText}>Selected: {selectedSchool.name}</Text>
        </View>
      ) : fallbackText ? (
        <Text style={styles.helperText}>
          Current saved school: {fallbackText}. Select an approved school to update it.
        </Text>
      ) : null}

      {showResults ? (
        <View style={styles.dropdown}>
          {isLoading ? (
            <View style={styles.dropdownState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="always"
              style={styles.dropdownList}
            >
              {filteredSchools.length > 0 ? (
                filteredSchools.map((school) => (
                  <Pressable
                    key={school.id}
                    disabled={disabled}
                    onPress={() => handleSelectSchool(school)}
                    style={styles.option}
                  >
                    {highlightMatch(
                      school.name,
                      debouncedQuery,
                      styles.optionText,
                      styles.optionTextHighlight
                    )}
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No schools found.</Text>

                  <Pressable
                    disabled={!canRequestSchool}
                    onPress={() => void handleRequestSchool()}
                    style={[styles.requestButton, !canRequestSchool && styles.requestButtonDisabled]}
                  >
                    {isRequesting ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color={colors.background} />
                        <Text style={styles.requestButtonText}>Requesting...</Text>
                      </View>
                    ) : (
                      <Text style={styles.requestButtonText}>Can't find your school? Request it</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      ) : null}

      {feedbackMessage ? <Text style={styles.feedbackText}>{feedbackMessage}</Text> : null}

      {!selectedSchoolSlug && query.trim() && !showResults && buildSchoolSlug(query) ? (
        <Text style={styles.helperText}>Select one approved school to continue.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.42)',
    backgroundColor: 'rgba(7, 6, 14, 0.82)',
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputDisabled: {
    opacity: 0.72,
  },
  selectedChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 74, 0.72)',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  selectedChipText: {
    color: '#160A04',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    lineHeight: 14,
  },
  helperText: {
    color: '#C4B4A7',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  feedbackText: {
    color: '#FFB287',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  dropdown: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#6B574D',
    backgroundColor: '#120F0D',
  },
  dropdownList: {
    maxHeight: 218,
  },
  dropdownState: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    borderBottomWidth: 1,
    borderBottomColor: '#2C211D',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  optionTextHighlight: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  emptyStateText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  requestButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonDisabled: {
    borderColor: '#6B574D',
    backgroundColor: '#1F1714',
  },
  requestButtonText: {
    color: colors.background,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
