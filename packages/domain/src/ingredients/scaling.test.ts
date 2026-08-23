import { describe, expect, it } from 'vitest';
import { makeFraction } from './fractions.js';
import { scaleFactor, scaleQuantity } from './scaling.js';

describe('scaleQuantity', () => {
  it('scales up exactly', () => {
    // 1/2 cup at base 4, requested 6 -> 3/4 cup
    expect(scaleQuantity(makeFraction(1, 2), 4, 6)).toEqual({ numerator: 3, denominator: 4 });
  });

  it('scales down exactly', () => {
    // 2 units at base 4, requested 1 -> 1/2 unit
    expect(scaleQuantity(makeFraction(2, 1), 4, 1)).toEqual({ numerator: 1, denominator: 2 });
  });

  it('is identity when servings are unchanged', () => {
    expect(scaleQuantity(makeFraction(3, 1), 4, 4)).toEqual({ numerator: 3, denominator: 1 });
  });

  it('never introduces floating-point drift', () => {
    // 1/3 tripled is exactly 1, not 0.9999999999999999.
    expect(scaleQuantity(makeFraction(1, 3), 1, 3)).toEqual({ numerator: 1, denominator: 1 });
    // 0.1 + 0.2 style hazard: 1/10 scaled by 3 is exactly 3/10.
    expect(scaleQuantity(makeFraction(1, 10), 1, 3)).toEqual({ numerator: 3, denominator: 10 });
  });

  it('rejects invalid serving counts', () => {
    expect(() => scaleQuantity(makeFraction(1, 2), 0, 4)).toThrow(RangeError);
    expect(() => scaleQuantity(makeFraction(1, 2), 4, 0)).toThrow(RangeError);
    expect(() => scaleQuantity(makeFraction(1, 2), 4, 1.5)).toThrow(RangeError);
  });
});

describe('scaleFactor', () => {
  it('returns the reduced multiplier', () => {
    expect(scaleFactor(4, 6)).toEqual({ numerator: 3, denominator: 2 });
    expect(scaleFactor(2, 2)).toEqual({ numerator: 1, denominator: 1 });
  });
});
