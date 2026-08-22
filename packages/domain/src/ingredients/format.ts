import { type Fraction, reduceFraction } from './fractions.js';

// Reverse of the parser's glyph table: reduced remainder/denominator pairs that
// have a familiar single-glyph representation.
const GLYPH_BY_KEY: Record<string, string> = {
  '1/2': '½',
  '1/3': '⅓',
  '2/3': '⅔',
  '1/4': '¼',
  '3/4': '¾',
  '1/5': '⅕',
  '2/5': '⅖',
  '3/5': '⅗',
  '4/5': '⅘',
  '1/6': '⅙',
  '5/6': '⅚',
  '1/8': '⅛',
  '3/8': '⅜',
  '5/8': '⅝',
  '7/8': '⅞',
};

// Denominators up to this value display as an exact `a/b` fraction. Anything
// larger is considered unwieldy and falls back to a trimmed decimal, while the
// exact fraction remains the source of truth internally.
const READABLE_MAX_DENOMINATOR = 16;
const DECIMAL_FALLBACK_PRECISION = 3;

export interface FormatQuantityOptions {
  // When false, always use ASCII fractions instead of Unicode glyphs.
  unicode?: boolean;
}

// Render an exact fraction for display, preferring, in order: a whole number,
// a mixed number with a familiar Unicode glyph, an exact `a/b` fraction, and
// finally a trimmed decimal for unwieldy denominators.
export function formatQuantity(
  quantity: Fraction,
  options: FormatQuantityOptions = {},
): string {
  const useUnicode = options.unicode ?? true;
  const { numerator, denominator } = reduceFraction(quantity);

  const whole = Math.floor(numerator / denominator);
  const remainder = numerator - whole * denominator;

  if (remainder === 0) {
    return String(whole);
  }

  const key = `${remainder}/${denominator}`;
  const glyph = useUnicode ? GLYPH_BY_KEY[key] : undefined;
  if (glyph) {
    return whole > 0 ? `${whole}${glyph}` : glyph;
  }

  if (denominator <= READABLE_MAX_DENOMINATOR) {
    const fraction = `${remainder}/${denominator}`;
    return whole > 0 ? `${whole} ${fraction}` : fraction;
  }

  return trimDecimal(numerator / denominator);
}

function trimDecimal(value: number): string {
  return Number.parseFloat(value.toFixed(DECIMAL_FALLBACK_PRECISION)).toString();
}
