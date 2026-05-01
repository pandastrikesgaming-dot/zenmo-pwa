import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import type { SchoolOption } from '../constants/schools';

const DEFAULT_RESULT_LIMIT = 8;

type RankedSchoolResult = SchoolOption & {
  score: number;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function stripNonAlphaNumeric(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function buildWordStarts(name: string) {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function buildAcronym(name: string) {
  return buildWordStarts(name)
    .map((word) => word[0] ?? '')
    .join('');
}

function getFuzzyScore(query: string, name: string) {
  const compactQuery = stripNonAlphaNumeric(query);
  const compactName = stripNonAlphaNumeric(name);

  if (!compactQuery || compactQuery.length < 2 || compactQuery.length > compactName.length) {
    return null;
  }

  let queryIndex = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;

  for (let index = 0; index < compactName.length; index += 1) {
    if (compactName[index] === compactQuery[queryIndex]) {
      if (firstMatchIndex === -1) {
        firstMatchIndex = index;
      }

      lastMatchIndex = index;
      queryIndex += 1;

      if (queryIndex === compactQuery.length) {
        const spread = lastMatchIndex - firstMatchIndex;
        return 1000 - spread - firstMatchIndex;
      }
    }
  }

  return null;
}

function rankSchool(query: string, school: SchoolOption) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedName = school.name.toLowerCase();
  const normalizedWords = buildWordStarts(school.name);
  const normalizedAcronym = buildAcronym(school.name);

  if (normalizedName === normalizedQuery) {
    return 5000;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 4000 - normalizedName.length;
  }

  if (normalizedWords.some((word) => word.startsWith(normalizedQuery))) {
    const wordIndex = normalizedWords.findIndex((word) => word.startsWith(normalizedQuery));
    return 3000 - wordIndex * 10 - normalizedName.length;
  }

  if (normalizedAcronym.startsWith(stripNonAlphaNumeric(normalizedQuery))) {
    return 2900 - normalizedName.length;
  }

  const substringIndex = normalizedName.indexOf(normalizedQuery);

  if (substringIndex >= 0) {
    return 2000 - substringIndex - normalizedName.length;
  }

  const fuzzyScore = getFuzzyScore(normalizedQuery, school.name);

  if (fuzzyScore !== null) {
    return fuzzyScore;
  }

  return null;
}

export function searchSchools(
  query: string,
  schoolsList: SchoolOption[],
  limit = DEFAULT_RESULT_LIMIT
) {
  const normalizedQuery = normalizeQuery(query);
  const alphabeticSchools = [...schoolsList].sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  if (!normalizedQuery) {
    return alphabeticSchools.slice(0, limit);
  }

  const rankedResults: RankedSchoolResult[] = [];

  for (const school of alphabeticSchools) {
    const score = rankSchool(normalizedQuery, school);

    if (score !== null) {
      rankedResults.push({
        ...school,
        score,
      });
    }
  }

  return rankedResults
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, limit)
    .map(({ score: _score, ...school }) => school);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightMatch(
  text: string,
  query: string,
  textStyle?: StyleProp<TextStyle>,
  highlightStyle?: StyleProp<TextStyle>
) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return <Text style={textStyle}>{text}</Text>;
  }

  const matcher = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'gi');
  const parts = text.split(matcher);

  if (parts.length === 1) {
    return <Text style={textStyle}>{text}</Text>;
  }

  return (
    <Text style={textStyle}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === trimmedQuery.toLowerCase();

        return (
          <Text key={`${part}-${index}`} style={isMatch ? highlightStyle : undefined}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
