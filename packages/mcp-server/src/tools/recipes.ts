import { getRecipe, listTags, searchRecipes } from '@cookbook/api/services';
import { normalizeName, RECIPE_SORTS, type ListRecipesQuery } from '@cookbook/domain';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Logger } from '../logger.js';
import { findCategoryId } from './lookups.js';
import {
  formatCount,
  formatRecipeDetail,
  formatSummaryList,
  recipeSummarySchema,
  runTool,
  scaledIngredientSchema,
  toolError,
  toolResult,
  toScaledIngredient,
  type ActingUser,
} from './helpers.js';

// How many recipes a tool returns when the caller does not say. A conversation
// wants a handful it can read out, not a page of twenty-four - the browse
// screen's default is for a screen with room to scroll.
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)
  .describe(`Maximum recipes to return (1-${MAX_LIMIT}). Defaults to ${DEFAULT_LIMIT}.`);

// The services take the query shape the HTTP layer parses. Building it here
// keeps every unset filter explicitly absent rather than accidentally set:
// `favorite: false` means "no favorite filter", which is the repository's own
// convention.
export function baseQuery(overrides: Partial<ListRecipesQuery> = {}): ListRecipesQuery {
  return {
    tagId: [],
    favorite: false,
    sort: 'recentlyAdded',
    limit: DEFAULT_LIMIT,
    ...overrides,
  } as ListRecipesQuery;
}

export function registerRecipeTools(
  server: McpServer,
  user: ActingUser,
  logger: Logger,
): string[] {
  server.registerTool(
    'search_recipes',
    {
      title: 'Search recipes',
      description:
        "Search the household cookbook by free text and narrow by category, time, or rating. The text matches a recipe's name, description, ingredients, category, and tags, so searching \"chicken\" finds recipes using chicken even when the title does not say so. Returns recipe summaries; call get_recipe for ingredients and instructions.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe('Free text matched against name, description, ingredients, category, and tags.'),
        category: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Restrict to one category by name, e.g. "Dinner".'),
        maxTotalMinutes: z
          .number()
          .int()
          .min(0)
          .max(10_080)
          .optional()
          .describe('Only recipes whose prep and cook time together fit within this many minutes.'),
        minRating: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe('Only recipes whose household average rating is at least this (1-5).'),
        favoritesOnly: z
          .boolean()
          .optional()
          .describe("Only recipes the acting user has favorited. Defaults to false."),
        sort: z
          .enum(RECIPE_SORTS)
          .default('recentlyAdded')
          .describe('Result ordering. "rating" sorts by the household average, highest first.'),
        limit: limitSchema,
      },
      outputSchema: {
        recipes: z.array(recipeSummarySchema),
        totalReturned: z.number().int(),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      runTool(logger, 'search_recipes', async () => {
        const categoryId = input.category ? await findCategoryId(input.category) : undefined;
        if (input.category && categoryId == null) {
          return toolError(`There is no category named "${input.category}" in this cookbook.`);
        }

        const page = await searchRecipes(
          baseQuery({
            q: input.query,
            categoryId,
            maxTotalMinutes: input.maxTotalMinutes,
            minRating: input.minRating,
            favorite: input.favoritesOnly ?? false,
            sort: input.sort,
            limit: input.limit,
          }),
          user.id,
        );

        const described = input.query ? ` matching "${input.query}"` : '';
        return toolResult(
          formatSummaryList(
            `Found ${formatCount(page.items.length, 'recipe')}${described}:`,
            page.items,
            `No recipes${described} matched those filters.`,
          ),
          { recipes: page.items, totalReturned: page.items.length },
        );
      }),
  );

  server.registerTool(
    'get_recipe',
    {
      title: 'Get a recipe',
      description:
        'Retrieve one full recipe by id, including ingredients, instructions, notes, and source. Optionally scale it to a different number of servings - the saved recipe is never changed. Recipe ids come from search_recipes and the other listing tools.',
      inputSchema: {
        recipeId: z.number().int().positive().describe('The recipe id.'),
        servings: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            "How many servings to scale ingredient quantities to. Defaults to the recipe's own base serving count.",
          ),
      },
      // Declared field by field, and built the same way below. Spreading the
      // service's record here instead would leak `version` and the image
      // metadata into the contract - and because the client validates
      // structured output with `additionalProperties: false`, an undeclared
      // field is a failed tool call rather than a harmless extra.
      outputSchema: {
        recipe: recipeSummarySchema.extend({
          baseServings: z.number().int(),
          servings: z.number().int(),
          notes: z.string().nullable(),
          sourceUrl: z.string().nullable(),
          sourceText: z.string().nullable(),
          createdByUserId: z.number().int(),
          tags: z.array(z.object({ id: z.number().int(), name: z.string() })),
          ingredients: z.array(scaledIngredientSchema),
          instructions: z.array(
            z.object({ position: z.number().int(), body: z.string() }),
          ),
        }),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ recipeId, servings }) =>
      runTool(logger, 'get_recipe', async () => {
        const recipe = await getRecipe(recipeId, user.id);
        const requested = servings ?? recipe.baseServings;

        return toolResult(formatRecipeDetail(recipe, requested), {
          recipe: {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            categoryId: recipe.categoryId,
            categoryName: recipe.categoryName,
            prepMinutes: recipe.prepMinutes,
            cookMinutes: recipe.cookMinutes,
            totalMinutes: recipe.totalMinutes,
            rating: recipe.rating,
            hasImage: recipe.hasImage,
            createdAt: recipe.createdAt,
            updatedAt: recipe.updatedAt,
            userState: recipe.userState,
            baseServings: recipe.baseServings,
            servings: requested,
            notes: recipe.notes,
            sourceUrl: recipe.sourceUrl,
            sourceText: recipe.sourceText,
            createdByUserId: recipe.createdByUserId,
            tags: recipe.tags.map((tag) => ({ id: tag.id, name: tag.name })),
            ingredients: recipe.ingredients.map((ingredient) =>
              toScaledIngredient(ingredient, recipe.baseServings, requested),
            ),
            instructions: recipe.instructions.map((step) => ({
              position: step.position,
              body: step.body,
            })),
          },
        });
      }),
  );

  server.registerTool(
    'get_recipes_by_tag',
    {
      title: 'Get recipes by tag',
      description:
        'List recipes carrying every one of the given tags, by tag name. Tags are the household\'s own labels, such as "Quick Meal" or "Comfort Food". Naming more than one tag narrows to recipes carrying all of them.',
      inputSchema: {
        tags: z
          .array(z.string().trim().min(1))
          .min(1)
          .max(20)
          .describe('Tag names. A recipe must carry all of them to be returned.'),
        limit: limitSchema,
      },
      outputSchema: {
        recipes: z.array(recipeSummarySchema),
        matchedTags: z.array(z.object({ id: z.number().int(), name: z.string() })),
        totalReturned: z.number().int(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ tags: requestedTags, limit }) =>
      runTool(logger, 'get_recipes_by_tag', async () => {
        const known = await listTags();

        // Tags are matched on the same normalized form the application uses for
        // case-insensitive uniqueness, so "quick meal" finds "Quick Meal".
        const byNormalized = new Map(known.map((tag) => [normalizeName(tag.name), tag]));
        const matched: { id: number; name: string }[] = [];
        const missing: string[] = [];

        for (const name of requestedTags) {
          const tag = byNormalized.get(normalizeName(name));
          if (tag) matched.push({ id: tag.id, name: tag.name });
          else missing.push(name);
        }

        // A tag that does not exist would otherwise silently widen the result:
        // dropping it turns "spicy and vegetarian" into "vegetarian" and the
        // answer looks right while being wrong.
        if (missing.length > 0) {
          const available = known.length === 0
            ? 'This cookbook has no tags yet.'
            : `Available tags: ${known.map((tag) => tag.name).join(', ')}.`;
          return toolError(
            `No tag named ${missing.map((name) => `"${name}"`).join(' or ')}. ${available}`,
          );
        }

        const page = await searchRecipes(
          baseQuery({ tagId: matched.map((tag) => tag.id), limit }),
          user.id,
        );

        const label = matched.map((tag) => tag.name).join(' + ');
        return toolResult(
          formatSummaryList(
            `${formatCount(page.items.length, 'recipe')} tagged ${label}:`,
            page.items,
            `No recipes are tagged ${label}.`,
          ),
          { recipes: page.items, matchedTags: matched, totalReturned: page.items.length },
        );
      }),
  );

  return ['search_recipes', 'get_recipe', 'get_recipes_by_tag'];
}
