import { z } from 'zod';

export const IMPORT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const importRequestSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('url'), url: z.string().trim().url().max(2048) }).strict(),
  z.object({ method: z.literal('text'), text: z.string().trim().min(1).max(40_000) }).strict(),
]);

// Unlike a saved recipe, a preview is allowed to be incomplete. Null is an
// honest absence, especially for amounts: a plausible guess would later become
// a confidently wrong grocery calculation. This is also the strict model schema
// (no transforms, defaults or optional properties).
export const recipeImportContentSchema = z
  .object({
    name: z.string().max(160),
    description: z.string().max(1000),
    baseServings: z.number().int().min(1).max(100).nullable(),
    prepMinutes: z.number().int().min(0).max(10_080).nullable(),
    cookMinutes: z.number().int().min(0).max(10_080).nullable(),
    notes: z.string().max(10_000).nullable(),
    ingredients: z
      .array(
        z
          .object({
            name: z.string().max(160),
            quantity: z.string().max(60).nullable(),
            unitCode: z.string().max(40).nullable(),
            unitText: z.string().max(40).nullable(),
            preparation: z.string().max(500).nullable(),
            originalText: z.string().max(1000),
          })
          .strict(),
      )
      .max(200),
    instructions: z.array(z.object({ body: z.string().max(5000) }).strict()).max(100),
    warnings: z
      .array(
        z
          .object({
            field: z.string().max(100),
            message: z.string().max(500),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export const recipeImportDraftSchema = recipeImportContentSchema.extend({
  // Deterministic validation may add a warning for every ingredient field,
  // beyond the model's smaller warning allowance. MCP validates this too.
  warnings: z.array(recipeImportContentSchema.shape.warnings.element).max(1200),
  importMethod: z.enum(['url', 'image', 'text']),
  sourceUrl: z.string().nullable(),
  photoDataUrl: z.string().nullable(),
  duplicates: z.array(
    z.object({ id: z.number().int(), name: z.string(), reason: z.enum(['url', 'title']) }),
  ),
});
export type RecipeImportDraft = z.infer<typeof recipeImportDraftSchema>;
export type RecipeImportContent = z.infer<typeof recipeImportContentSchema>;
export type ImportRequest = z.infer<typeof importRequestSchema>;
