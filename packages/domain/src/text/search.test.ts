import { describe, expect, it } from 'vitest';
import { MAX_SEARCH_TOKENS, MAX_SEARCH_TOKEN_LENGTH, searchTokens } from './search.js';

describe('searchTokens', () => {
  it('normalizes and splits a query into tokens', () => {
    expect(searchTokens('  Weeknight   CHILI ')).toEqual(['weeknight', 'chili']);
  });

  it('returns nothing for input that is only whitespace', () => {
    expect(searchTokens('   ')).toEqual([]);
    expect(searchTokens('')).toEqual([]);
  });

  it('drops tokens past the limit rather than rejecting the query', () => {
    const query = Array.from({ length: MAX_SEARCH_TOKENS + 5 }, (_, index) => `t${index}`).join(' ');

    expect(searchTokens(query)).toHaveLength(MAX_SEARCH_TOKENS);
    expect(searchTokens(query)[0]).toBe('t0');
  });

  it('truncates a single very long token', () => {
    expect(searchTokens('a'.repeat(500))[0]).toHaveLength(MAX_SEARCH_TOKEN_LENGTH);
  });

  it('keeps wildcard characters as literal text for the repository to escape', () => {
    expect(searchTokens('100% beef')).toEqual(['100%', 'beef']);
  });
});
