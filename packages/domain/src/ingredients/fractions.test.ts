import { describe, expect, it } from 'vitest';
import {
  QuantityParseError,
  fractionToNumber,
  fractionsEqual,
  gcd,
  makeFraction,
  parseQuantity,
  reduceFraction,
  tryParseQuantity,
} from './fractions.js';

describe('gcd', () => {
  it('computes the greatest common divisor', () => {
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(7, 3)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
  });

  it('never returns zero', () => {
    expect(gcd(0, 0)).toBe(1);
  });
});

describe('reduceFraction', () => {
  it('reduces to lowest terms', () => {
    expect(reduceFraction({ numerator: 4, denominator: 8 })).toEqual({
      numerator: 1,
      denominator: 2,
    });
  });

  it('normalizes a negative denominator', () => {
    expect(reduceFraction({ numerator: 1, denominator: -2 })).toEqual({
      numerator: -1,
      denominator: 2,
    });
  });

  it('rejects a zero denominator', () => {
    expect(() => reduceFraction({ numerator: 1, denominator: 0 })).toThrow(RangeError);
  });

  it('rejects non-integer components', () => {
    expect(() => reduceFraction({ numerator: 1.5, denominator: 2 })).toThrow(RangeError);
  });
});

describe('parseQuantity', () => {
  it('parses integers', () => {
    expect(parseQuantity('2')).toEqual({ numerator: 2, denominator: 1 });
  });

  it('parses decimals and reduces them', () => {
    expect(parseQuantity('0.5')).toEqual({ numerator: 1, denominator: 2 });
    expect(parseQuantity('1.25')).toEqual({ numerator: 5, denominator: 4 });
    expect(parseQuantity('.5')).toEqual({ numerator: 1, denominator: 2 });
  });

  it('parses simple fractions', () => {
    expect(parseQuantity('3/2')).toEqual({ numerator: 3, denominator: 2 });
    expect(parseQuantity('2/4')).toEqual({ numerator: 1, denominator: 2 });
  });

  it('parses mixed ascii fractions', () => {
    expect(parseQuantity('1 1/2')).toEqual({ numerator: 3, denominator: 2 });
    expect(parseQuantity('2 3/4')).toEqual({ numerator: 11, denominator: 4 });
  });

  it('parses unicode fraction glyphs', () => {
    expect(parseQuantity('½')).toEqual({ numerator: 1, denominator: 2 });
    expect(parseQuantity('⅓')).toEqual({ numerator: 1, denominator: 3 });
  });

  it('parses whole numbers with a unicode glyph, spaced or not', () => {
    expect(parseQuantity('1 ½')).toEqual({ numerator: 3, denominator: 2 });
    expect(parseQuantity('1½')).toEqual({ numerator: 3, denominator: 2 });
  });

  it('collapses surrounding and internal whitespace', () => {
    expect(parseQuantity('  1   1/2 ')).toEqual({ numerator: 3, denominator: 2 });
  });

  it('rejects zero, negatives, and malformed input', () => {
    expect(() => parseQuantity('0')).toThrow(QuantityParseError);
    expect(() => parseQuantity('0/5')).toThrow(QuantityParseError);
    expect(() => parseQuantity('1/0')).toThrow(QuantityParseError);
    expect(() => parseQuantity('-1')).toThrow(QuantityParseError);
    expect(() => parseQuantity('')).toThrow(QuantityParseError);
    expect(() => parseQuantity('abc')).toThrow(QuantityParseError);
    expect(() => parseQuantity('1/2/3')).toThrow(QuantityParseError);
  });
});

describe('tryParseQuantity', () => {
  it('returns a fraction for valid input and null for invalid input', () => {
    expect(tryParseQuantity('1/2')).toEqual({ numerator: 1, denominator: 2 });
    expect(tryParseQuantity('nope')).toBeNull();
    expect(tryParseQuantity('')).toBeNull();
  });
});

describe('fraction helpers', () => {
  it('converts to a number', () => {
    expect(fractionToNumber(makeFraction(1, 4))).toBe(0.25);
  });

  it('compares by reduced value', () => {
    expect(fractionsEqual(makeFraction(2, 4), makeFraction(1, 2))).toBe(true);
    expect(fractionsEqual(makeFraction(1, 3), makeFraction(1, 2))).toBe(false);
  });
});
