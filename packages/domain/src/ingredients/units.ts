// Known application units. Units are text-backed values (not a PostgreSQL enum)
// so the registry can grow without a schema migration. Phase 1 does not convert
// between units: a recipe saved in grams stays in grams while scaling. The
// singular/plural labels are for display only and never change the stored
// measure. See technical design section 5.2 and ADR 0002.

export type UnitSystem = 'mass' | 'volume';

export interface UnitDefinition {
  readonly code: string;
  readonly system: UnitSystem;
  readonly abbreviation: string;
  readonly singular: string;
  readonly plural: string;
}

export const UNIT_DEFINITIONS: readonly UnitDefinition[] = [
  { code: 'g', system: 'mass', abbreviation: 'g', singular: 'gram', plural: 'grams' },
  { code: 'kg', system: 'mass', abbreviation: 'kg', singular: 'kilogram', plural: 'kilograms' },
  { code: 'oz', system: 'mass', abbreviation: 'oz', singular: 'ounce', plural: 'ounces' },
  { code: 'lb', system: 'mass', abbreviation: 'lb', singular: 'pound', plural: 'pounds' },
  { code: 'ml', system: 'volume', abbreviation: 'ml', singular: 'millilitre', plural: 'millilitres' },
  { code: 'l', system: 'volume', abbreviation: 'l', singular: 'litre', plural: 'litres' },
  { code: 'tsp', system: 'volume', abbreviation: 'tsp', singular: 'teaspoon', plural: 'teaspoons' },
  { code: 'tbsp', system: 'volume', abbreviation: 'tbsp', singular: 'tablespoon', plural: 'tablespoons' },
  { code: 'cup', system: 'volume', abbreviation: 'cup', singular: 'cup', plural: 'cups' },
];

const UNIT_BY_CODE = new Map<string, UnitDefinition>(
  UNIT_DEFINITIONS.map((unit) => [unit.code, unit]),
);

export const UNIT_CODES: readonly string[] = UNIT_DEFINITIONS.map((unit) => unit.code);

export function getUnit(code: string): UnitDefinition | undefined {
  return UNIT_BY_CODE.get(code);
}

export function isKnownUnitCode(code: string): boolean {
  return UNIT_BY_CODE.has(code);
}

// Choose the singular or plural label for a count. A count of exactly 1 is
// singular; everything else (including fractional amounts such as 0.5) is
// plural, matching ordinary English usage ("0.5 cups", "2 cups", "1 cup").
export function unitLabel(code: string, count: number): string {
  const unit = UNIT_BY_CODE.get(code);
  if (!unit) {
    return code;
  }
  return count === 1 ? unit.singular : unit.plural;
}
