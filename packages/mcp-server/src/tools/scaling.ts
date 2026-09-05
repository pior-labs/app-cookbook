import { getRecipe } from '@cookbook/api/services';
import { formatQuantity, scaleFactor } from '@cookbook/domain';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Logger } from '../logger.js';
import {
  formatIngredient,
  runTool,
  scaledIngredientSchema,
  toolResult,
  toScaledIngredient,
  type ActingUser,
} from './helpers.js';

// Scaling a recipe to a different number of servings.
//
// The arithmetic is `@cookbook/domain`'s, the same exact-fraction code the
// recipe screen runs (technical design section 5.3 and ADR 0002). That is the
// point of calling into the domain package rather than multiplying decimals
// here: a recipe scaled in conversation and the same recipe scaled in the
// browser produce the same "⅔ cup", not 0.6666666666666666.
export function registerScalingTools(
  server: McpServer,
  user: ActingUser,
  logger: Logger,
): string[] {
  server.registerTool(
    'scale_recipe',
    {
      title: 'Scale a recipe',
      description:
        'Recalculate a recipe\'s ingredient quantities for a different number of servings. Quantities are exact fractions rendered the way a cook reads them ("1½ cups"). This never changes the saved recipe - it is a calculation, not an edit. Use get_recipe when the instructions are also needed.',
      inputSchema: {
        recipeId: z.number().int().positive().describe('The recipe id to scale.'),
        servings: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .describe('How many servings to scale to.'),
      },
      outputSchema: {
        recipeId: z.number().int(),
        name: z.string(),
        baseServings: z.number().int(),
        servings: z.number().int(),
        scaleFactor: z.string(),
        ingredients: z.array(scaledIngredientSchema),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ recipeId, servings }) =>
      runTool(logger, 'scale_recipe', async () => {
        const recipe = await getRecipe(recipeId, user.id);
        const factor = scaleFactor(recipe.baseServings, servings);

        const lines = recipe.ingredients.map(
          (ingredient) => `- ${formatIngredient(ingredient, recipe.baseServings, servings)}`,
        );

        const text = [
          `${recipe.name}, scaled from ${recipe.baseServings} to ${servings} ${
            servings === 1 ? 'serving' : 'servings'
          } (×${formatQuantity(factor)}):`,
          ...lines,
          '',
          // Said plainly because the model is about to relay this to someone
          // who may be about to cook from it.
          'The saved recipe is unchanged; these are the amounts for the requested serving count.',
        ].join('\n');

        return toolResult(text, {
          recipeId: recipe.id,
          name: recipe.name,
          baseServings: recipe.baseServings,
          servings,
          scaleFactor: formatQuantity(factor),
          ingredients: recipe.ingredients.map((ingredient) =>
            toScaledIngredient(ingredient, recipe.baseServings, servings),
          ),
        });
      }),
  );

  return ['scale_recipe'];
}
