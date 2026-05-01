export function normalizeSectionId(value: string) {
  const matches = value.trim().toUpperCase().match(/[A-Z]/);
  return matches?.[0] ?? '';
}

export function isValidSection(value: string) {
  return /^[A-Z]$/.test(value.trim().toUpperCase());
}
