import { z } from 'zod';
import { tryParseQuantity } from '../ingredients/fractions.js';
import { isKnownUnitCode } from '../ingredients/units.js';
import { normalizeWhitespace } from '../text/normalize.js';

// Surrogate keys and stored quantity components are PostgreSQL `serial` /
// `integer` columns, so anything beyond the signed 32-bit range cannot be
// stored or compared. Bounding it here turns what would otherwise surface as a
// database range error into an ordinary field-scoped validation message.
export const MAX_INT32 = 2_147_483_647;

// The largest denominator a stored quantity may have. Anything more precise is
// rejected rather than silently rounded. See technical design section 12.
export const MAX_QUANTITY_DENOMINATOR = 10_000;

// A positive integer surrogate key as it appears in JSON request bodies.
export const idSchema = z.number().int().positive().max(MAX_INT32);

// A positive integer id as it appears in a route parameter or query string.
// Plain decimal digits only: coercion alone would also accept `0x1`, `1e0`,
// `+1`, and `01`, giving every resource a set of equivalent URLs.
export const idParamSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, { message: 'Expected a numeric ID.' })
  .transform(Number)
  .pipe(idSchema);

export const recipeNameSchema = z.string().trim().min(1).max(160);
export const descriptionSchema = z.string().max(1000);
export const notesSchema = z
  .string()
  .max(10_000)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const servingsSchema = z.number().int().min(1).max(100);
export const timeMinutesSchema = z
  .number()
  .int()
  .min(0)
  .max(10_080)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const ingredientNameSchema = z.string().trim().min(1).max(160);
export const preparationSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

export const instructionBodySchema = z.string().trim().min(1).max(5000);
export const categoryTagNameSchema = z.string().trim().min(1).max(60);

// A tag's colour: a six-digit hex value, or null for no colour. `TAG_COLORS` is
// the palette the app puts in front of a cook, but the rule here is the hex
// itself, so the colour box beside those swatches can hold anything a household
// wants and a palette that changes later needs no migration.
//
// Deliberately not transformed to null when absent, unlike the optional recipe
// fields above: on an update, an omitted colour means "leave it alone" and an
// explicit null means "take it off", and a transform would collapse the two.
export const tagColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/i, { message: 'Enter a colour like #c96442.' })
  .transform((value) => value.toLowerCase())
  .nullable()
  .optional();

export const ratingSchema = z.number().int().min(1).max(5);

export const sourceUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Source URL must start with http:// or https://.',
  });
export const sourceTextSchema = z.string().trim().max(500);

// A known application unit code such as `g`, `ml`, or `tbsp`.
export const unitCodeSchema = z
  .string()
  .refine(isKnownUnitCode, { message: 'Unknown unit.' });

// A free-form custom unit label such as `clove` or `can`. Whitespace is
// normalized but casing is preserved. See technical design section 5.2.
export const customUnitSchema = z
  .string()
  .transform(normalizeWhitespace)
  .pipe(z.string().min(1).max(40));

// A human-entered quantity, parsed into an exact reduced fraction. An empty
// string, null, or an omitted value all mean "no quantity" (for example
// "salt to taste") and resolve to null.
export const quantitySchema = z
  .string()
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = tryParseQuantity(trimmed);
    if (!parsed) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid quantity such as 1, 0.5, 1/2, or 1 1/2.',
      });
      return z.NEVER;
    }
    if (parsed.denominator > MAX_QUANTITY_DENOMINATOR) {
      ctx.addIssue({ code: 'custom', message: 'Quantity is too precise to store.' });
      return z.NEVER;
    }
    // A mixed number such as `215000 1/10000` reduces to a numerator well past
    // the storable range even though each written part looks small.
    if (parsed.numerator > MAX_INT32) {
      ctx.addIssue({ code: 'custom', message: 'Quantity is too large.' });
      return z.NEVER;
    }
    return parsed;
  });
