// Shared text normalization rules used across the domain. Applied identically
// wherever case-insensitive uniqueness or search normalization is required, so
// the application, the database seed, and future consumers agree on one rule.

// Collapse surrounding and internal whitespace to single spaces, preserving
// case. Used for custom unit labels, which keep their original casing.
export function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

// The canonical normalized-name rule: trim, collapse internal whitespace, and
// lowercase. Used for the `normalized_name` companion of categories, tags, and
// ingredients, and for normalizing search input. Lowercasing is locale
// independent so the same input always yields the same normalized value.
export function normalizeName(input: string): string {
  return normalizeWhitespace(input).toLowerCase();
}
