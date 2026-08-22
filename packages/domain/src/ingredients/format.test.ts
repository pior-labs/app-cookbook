import { describe, expect, it } from 'vitest';
import { formatQuantity } from './format.js';
import { makeFraction } from './fractions.js';

describe('formatQuantity', () => {
  it('renders whole numbers', () => {
    expect(formatQuantity(makeFraction(3, 1))).toBe('3');
    expect(formatQuantity(makeFraction(6, 2))).toBe('3');
  });

  it('renders familiar unicode fractions', () => {
    expect(formatQuantity(makeFraction(1, 2))).toBe('½');
    expect(formatQuantity(makeFraction(3, 4))).toBe('¾');
  });

  it('renders mixed numbers with a glyph', () => {
    expect(formatQuantity(makeFraction(3, 2))).toBe('1½');
    expect(formatQuantity(makeFraction(11, 4))).toBe('2¾');
  });

  it('renders an exact ascii fraction when no glyph exists but the denominator is readable', () => {
    expect(formatQuantity(makeFraction(1, 16))).toBe('1/16');
    expect(formatQuantity(makeFraction(19, 16))).toBe('1 3/16');
  });

  it('can be forced to ascii fractions', () => {
    expect(formatQuantity(makeFraction(1, 2), { unicode: false })).toBe('1/2');
    expect(formatQuantity(makeFraction(3, 2), { unicode: false })).toBe('1 1/2');
  });

  it('falls back to a trimmed decimal for unwieldy denominators', () => {
    // 1/1000 has no glyph and an unreadable denominator.
    expect(formatQuantity(makeFraction(1, 1000))).toBe('0.001');
  });
});
