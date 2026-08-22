import { describe, expect, it } from 'vitest';
import { UNIT_CODES, getUnit, isKnownUnitCode, unitLabel } from './units.js';

describe('unit registry', () => {
  it('includes the common culinary units', () => {
    for (const code of ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb']) {
      expect(isKnownUnitCode(code)).toBe(true);
    }
  });

  it('rejects unknown codes', () => {
    expect(isKnownUnitCode('clove')).toBe(false);
    expect(getUnit('clove')).toBeUndefined();
  });

  it('exposes unique codes', () => {
    expect(new Set(UNIT_CODES).size).toBe(UNIT_CODES.length);
  });

  it('labels singular for one and plural otherwise', () => {
    expect(unitLabel('cup', 1)).toBe('cup');
    expect(unitLabel('cup', 2)).toBe('cups');
    expect(unitLabel('cup', 0.5)).toBe('cups');
  });

  it('echoes an unknown code back as its own label', () => {
    expect(unitLabel('clove', 2)).toBe('clove');
  });
});
