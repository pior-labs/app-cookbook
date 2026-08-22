// Exact rational quantities. A quantity is stored as a reduced numerator and
// denominator pair rather than a float or a formatted string, so that scaling
// and display never accumulate floating-point drift. See ADR 0002.

export interface Fraction {
  readonly numerator: number;
  readonly denominator: number;
}

export class QuantityParseError extends Error {
  constructor(public readonly input: string) {
    super(`Unable to parse quantity: "${input}"`);
    this.name = 'QuantityParseError';
  }
}

// Supported single-glyph Unicode fractions, mapped to [numerator, denominator].
const UNICODE_FRACTIONS: Record<string, [number, number]> = {
  '½': [1, 2],
  '⅓': [1, 3],
  '⅔': [2, 3],
  '¼': [1, 4],
  '¾': [3, 4],
  '⅕': [1, 5],
  '⅖': [2, 5],
  '⅗': [3, 5],
  '⅘': [4, 5],
  '⅙': [1, 6],
  '⅚': [5, 6],
  '⅐': [1, 7],
  '⅛': [1, 8],
  '⅜': [3, 8],
  '⅝': [5, 8],
  '⅞': [7, 8],
  '⅑': [1, 9],
  '⅒': [1, 10],
};

const GLYPH_CLASS = Object.keys(UNICODE_FRACTIONS).join('');
const ONLY_GLYPH = new RegExp(`^([${GLYPH_CLASS}])$`);
const WHOLE_GLYPH = new RegExp(`^(\\d+)\\s*([${GLYPH_CLASS}])$`);
const MIXED_ASCII = /^(\d+)\s+(\d+)\/(\d+)$/;
const SIMPLE_FRACTION = /^(\d+)\/(\d+)$/;
const DECIMAL = /^(\d+)?\.(\d+)$/;
const INTEGER = /^(\d+)$/;

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a === 0 ? 1 : a;
}

// Reduce a fraction to lowest terms with a positive denominator.
export function reduceFraction(fraction: Fraction): Fraction {
  const { numerator, denominator } = fraction;
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new RangeError('Fraction components must be integers');
  }
  if (denominator === 0) {
    throw new RangeError('Fraction denominator must not be zero');
  }
  let num = numerator;
  let den = denominator;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const divisor = gcd(num, den);
  return { numerator: num / divisor, denominator: den / divisor };
}

// Build a reduced fraction from raw components.
export function makeFraction(numerator: number, denominator: number): Fraction {
  return reduceFraction({ numerator, denominator });
}

export function fractionToNumber(fraction: Fraction): number {
  return fraction.numerator / fraction.denominator;
}

export function fractionsEqual(a: Fraction, b: Fraction): boolean {
  const ra = reduceFraction(a);
  const rb = reduceFraction(b);
  return ra.numerator === rb.numerator && ra.denominator === rb.denominator;
}

// Parse a human-entered measure into an exact, reduced, positive fraction.
// Accepts integers, decimals, `a/b` fractions, mixed fractions, and supported
// Unicode fraction glyphs. Throws QuantityParseError on anything else,
// including zero and negative values, which are not valid quantities.
export function parseQuantity(input: string): Fraction {
  const raw = input.trim().replace(/\s+/g, ' ');
  if (raw === '') {
    throw new QuantityParseError(input);
  }

  const finalize = (numerator: number, denominator: number): Fraction => {
    if (denominator === 0) {
      throw new QuantityParseError(input);
    }
    const result = makeFraction(numerator, denominator);
    if (result.numerator <= 0) {
      throw new QuantityParseError(input);
    }
    return result;
  };

  let match: RegExpMatchArray | null;

  if ((match = raw.match(ONLY_GLYPH))) {
    const [num, den] = UNICODE_FRACTIONS[match[1]];
    return finalize(num, den);
  }
  if ((match = raw.match(WHOLE_GLYPH))) {
    const whole = Number.parseInt(match[1], 10);
    const [num, den] = UNICODE_FRACTIONS[match[2]];
    return finalize(whole * den + num, den);
  }
  if ((match = raw.match(MIXED_ASCII))) {
    const whole = Number.parseInt(match[1], 10);
    const num = Number.parseInt(match[2], 10);
    const den = Number.parseInt(match[3], 10);
    return finalize(whole * den + num, den);
  }
  if ((match = raw.match(SIMPLE_FRACTION))) {
    return finalize(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10));
  }
  if ((match = raw.match(DECIMAL))) {
    const intPart = match[1] ?? '0';
    const fracPart = match[2];
    const denominator = 10 ** fracPart.length;
    const numerator = Number.parseInt(intPart + fracPart, 10);
    return finalize(numerator, denominator);
  }
  if ((match = raw.match(INTEGER))) {
    return finalize(Number.parseInt(match[1], 10), 1);
  }

  throw new QuantityParseError(input);
}

// Non-throwing variant: returns null when the input cannot be parsed.
export function tryParseQuantity(input: string): Fraction | null {
  try {
    return parseQuantity(input);
  } catch (error) {
    if (error instanceof QuantityParseError) {
      return null;
    }
    throw error;
  }
}
