import { normalizeName } from './normalize.js';

// How search input becomes match tokens. This is a domain rule rather than a
// repository detail so the API, the web app's result summaries, and future
// consumers all agree on what a query means (technical design section 9).

// Every token must match somewhere for a recipe to be a result, so an
// unbounded query would mean an unbounded number of `ILIKE` predicates. Extra
// tokens past the limit are dropped rather than rejected: a very long query is
// still a query, and the first tokens are the ones a cook typed deliberately.
export const MAX_SEARCH_TOKENS = 8;
export const MAX_SEARCH_TOKEN_LENGTH = 60;

// Splits normalized input on whitespace. Normalization is the same rule the
// stored `normalized_name` columns use, so a query matches regardless of case
// or repeated spacing.
export function searchTokens(input: string): string[] {
  const normalized = normalizeName(input);
  if (normalized === '') {
    return [];
  }

  return normalized
    .split(' ')
    .filter((token) => token !== '')
    .slice(0, MAX_SEARCH_TOKENS)
    .map((token) => token.slice(0, MAX_SEARCH_TOKEN_LENGTH));
}
