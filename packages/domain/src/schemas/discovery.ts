import { z } from 'zod';
import { idParamSchema } from './primitives.js';

export const RECIPE_SORTS = [
  'recentlyAdded',
  'recentlyUpdated',
  'name',
  'rating',
] as const;

export const DEFAULT_RECIPE_LIMIT = 24;
export const MAX_RECIPE_LIMIT = 100;

// Normalizes a repeatable query parameter (`tagId=1&tagId=2`) into an array,
// whether the framework hands it over as a single value or an array.
const repeatableIds = z
  .union([idParamSchema, z.array(idParamSchema)])
  .optional()
  .transform((value) => {
    if (value == null) return [] as number[];
    return Array.isArray(value) ? value : [value];
  });

// Query parameters for `GET /api/recipes`. Every filter is optional and
// composes with the others; every sort has an implicit `id` tie-breaker for
// stable cursor pagination (enforced by the repository, not here).
export const listRecipesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    categoryId: idParamSchema.optional(),
    tagId: repeatableIds,
    favorite: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    minRating: z.coerce.number().int().min(1).max(5).optional(),
    maxTotalMinutes: z.coerce.number().int().min(0).max(10_080).optional(),
    sort: z.enum(RECIPE_SORTS).default('recentlyAdded'),
    cursor: z.string().max(256).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_RECIPE_LIMIT).default(DEFAULT_RECIPE_LIMIT),
  })
  .strict();

export type RecipeSort = (typeof RECIPE_SORTS)[number];
export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;
