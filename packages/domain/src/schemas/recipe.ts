import { z } from 'zod';
import {
  customUnitSchema,
  descriptionSchema,
  idSchema,
  ingredientNameSchema,
  instructionBodySchema,
  notesSchema,
  preparationSchema,
  quantitySchema,
  recipeNameSchema,
  servingsSchema,
  sourceTextSchema,
  sourceUrlSchema,
  timeMinutesSchema,
  unitCodeSchema,
} from './primitives.js';

// One structured ingredient row. Position is derived from array order at the
// API boundary and is never trusted from the client, so it is not part of the
// input shape.
export const ingredientInputSchema = z
  .object({
    name: ingredientNameSchema,
    quantity: quantitySchema,
    unitCode: unitCodeSchema.nullable().optional().transform((value) => value ?? null),
    unitText: customUnitSchema.nullable().optional().transform((value) => value ?? null),
    preparation: preparationSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.unitCode != null && value.unitText != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['unitText'],
        message: 'Use either a known unit or a custom unit, not both.',
      });
    }
  });

export const instructionInputSchema = z
  .object({
    body: instructionBodySchema,
  })
  .strict();

// The editable fields of the recipe aggregate, shared by create and update.
const recipeAggregateBase = z.object({
  name: recipeNameSchema,
  description: descriptionSchema,
  baseServings: servingsSchema,
  prepMinutes: timeMinutesSchema,
  cookMinutes: timeMinutesSchema,
  notes: notesSchema,
  categoryId: idSchema,
  sourceUrl: sourceUrlSchema.nullable().optional().transform((value) => value ?? null),
  sourceText: sourceTextSchema.nullable().optional().transform((value) => value ?? null),
  ingredients: z.array(ingredientInputSchema).min(1).max(200),
  instructions: z.array(instructionInputSchema).min(1).max(100),
  tagIds: z.array(idSchema).max(20).optional().transform((value) => value ?? []),
});

function refineRecipeAggregate<T extends typeof recipeAggregateBase>(schema: T) {
  return schema.superRefine((value, ctx) => {
    if (value.sourceUrl != null && value.sourceText != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceText'],
        message: 'Provide either a source link or source text, not both.',
      });
    }
    if (new Set(value.tagIds).size !== value.tagIds.length) {
      ctx.addIssue({ code: 'custom', path: ['tagIds'], message: 'Tags must be distinct.' });
    }
  });
}

export const createRecipeSchema = refineRecipeAggregate(recipeAggregateBase.strict());

// Updates carry the last observed version for optimistic concurrency. A
// mismatch is a conflict rather than a silent overwrite. See section 4.3.
export const updateRecipeSchema = refineRecipeAggregate(
  recipeAggregateBase.extend({ version: z.number().int().min(1) }).strict(),
);

export type IngredientInput = z.infer<typeof ingredientInputSchema>;
export type InstructionInput = z.infer<typeof instructionInputSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
