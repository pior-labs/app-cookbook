import { type Fraction, makeFraction } from './fractions.js';

// Scale an ingredient quantity from a recipe's base servings to a requested
// serving count using exact integer fraction arithmetic:
//
//   scaled = quantity * requestedServings / baseServings
//
// Requested servings are temporary view state and are never persisted. The
// original recipe is never mutated by scaling. See technical design section 5.3.
export function scaleQuantity(
  quantity: Fraction,
  baseServings: number,
  requestedServings: number,
): Fraction {
  if (!Number.isInteger(baseServings) || baseServings <= 0) {
    throw new RangeError('baseServings must be a positive integer');
  }
  if (!Number.isInteger(requestedServings) || requestedServings <= 0) {
    throw new RangeError('requestedServings must be a positive integer');
  }
  return makeFraction(
    quantity.numerator * requestedServings,
    quantity.denominator * baseServings,
  );
}

// The multiplier applied to every quantity for a given serving change, as an
// exact fraction. Useful for display ("×1½") and for callers that scale their
// own values.
export function scaleFactor(baseServings: number, requestedServings: number): Fraction {
  if (!Number.isInteger(baseServings) || baseServings <= 0) {
    throw new RangeError('baseServings must be a positive integer');
  }
  if (!Number.isInteger(requestedServings) || requestedServings <= 0) {
    throw new RangeError('requestedServings must be a positive integer');
  }
  return makeFraction(requestedServings, baseServings);
}
