import { describe, expect, it } from 'vitest';
import { normalizeName, normalizeWhitespace } from './normalize.js';

describe('normalizeWhitespace', () => {
  it('trims and collapses internal whitespace, preserving case', () => {
    expect(normalizeWhitespace('  Red   Onion ')).toBe('Red Onion');
    expect(normalizeWhitespace('a\t\nb')).toBe('a b');
  });
});

describe('normalizeName', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeName('  Weeknight   Dinner ')).toBe('weeknight dinner');
  });

  it('maps case-insensitive duplicates to the same value', () => {
    expect(normalizeName('DESSERT')).toBe(normalizeName('dessert'));
  });
});
