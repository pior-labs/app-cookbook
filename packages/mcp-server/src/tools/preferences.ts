import { searchRecipes } from '@cookbook/api/services';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Logger } from '../logger.js';
import { findCategoryId } from './lookups.js';
import { baseQuery } from './recipes.js';
import {
  formatCount,
  formatSummaryList,
  recipeSummarySchema,
  runTool,
  toolError,
  toolResult,
  type ActingUser,
} from './helpers.js';

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(50)
  .default(10)
  .describe('Maximum recipes to return (1-50). Defaults to 10.');

// The two tools that answer for a person rather than for the household.
//
// Both are scoped to the acting user resolved from configuration at startup.
// Neither takes a user argument, so "my favorites" has exactly one possible
// meaning and cannot be pointed at the other household member (ADR 0006).
export function registerPreferenceTools(
  server: McpServer,
  user: ActingUser,
  logger: Logger,
): string[] {
  server.registerTool(
    'get_favorites',
    {
      title: 'Get my favorite recipes',
      description: `List the recipes ${user.name} has favorited. Favorites are personal: this answers for the household member this server is configured for and for nobody else. Optionally narrow the favorites by free text or by time available.`,
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe('Optional free text to narrow the favorites, matched like search_recipes.'),
        maxTotalMinutes: z
          .number()
          .int()
          .min(0)
          .max(10_080)
          .optional()
          .describe('Only favorites whose prep and cook time together fit within this many minutes.'),
        limit: limitSchema,
      },
      outputSchema: {
        recipes: z.array(recipeSummarySchema),
        totalReturned: z.number().int(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, maxTotalMinutes, limit }) =>
      runTool(logger, 'get_favorites', async () => {
        const page = await searchRecipes(
          baseQuery({ q: query, maxTotalMinutes, favorite: true, limit }),
          user.id,
        );

        return toolResult(
          formatSummaryList(
            `${formatCount(page.items.length, 'favorite recipe')}:`,
            page.items,
            query
              ? `None of your favorites match "${query}".`
              : 'You have not favorited any recipes yet.',
          ),
          { recipes: page.items, totalReturned: page.items.length },
        );
      }),
  );

  server.registerTool(
    'get_top_rated_recipes',
    {
      title: 'Get top rated recipes',
      description:
        'List the highest rated recipes in the household cookbook, best first. Ratings are a household average across everyone who has rated a recipe - this is not one person\'s ratings. Unrated recipes are excluded when a minimum rating is given.',
      inputSchema: {
        minRating: z
          .number()
          .int()
          .min(1)
          .max(5)
          .default(4)
          .describe('Only recipes whose household average is at least this (1-5). Defaults to 4.'),
        category: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Restrict to one category by name, e.g. "Dinner".'),
        limit: limitSchema,
      },
      outputSchema: {
        recipes: z.array(recipeSummarySchema),
        totalReturned: z.number().int(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ minRating, category, limit }) =>
      runTool(logger, 'get_top_rated_recipes', async () => {
        let categoryId: number | undefined;
        if (category) {
          categoryId = await findCategoryId(category);
          if (categoryId == null) {
            return toolError(`There is no category named "${category}" in this cookbook.`);
          }
        }

        const page = await searchRecipes(
          baseQuery({ minRating, categoryId, sort: 'rating', limit }),
          user.id,
        );

        const scope = category ? ` in ${category}` : '';
        return toolResult(
          formatSummaryList(
            `Top rated${scope}, ${minRating}/5 and above:`,
            page.items,
            `No recipes${scope} are rated ${minRating}/5 or higher yet.`,
          ),
          { recipes: page.items, totalReturned: page.items.length },
        );
      }),
  );

  return ['get_favorites', 'get_top_rated_recipes'];
}
