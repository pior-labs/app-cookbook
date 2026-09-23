import * as service from '@cookbook/api/services';
import { idSchema, versionSchema, servingsSchema, groceryListText } from '@cookbook/domain';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Logger } from '../logger.js';
import { runTool, toolResult, type ActingUser } from './helpers.js';

// These are the only additional writes authorized by MCP v2. Exporting the
// allowlist keeps deployment smoke checks explicit without running mutations
// against the household database.
export const PLANNING_WRITE_TOOLS = [
  'create_meal_plan',
  'add_recipe_to_meal_plan',
  'remove_recipe_from_meal_plan',
  'update_meal_plan_item',
  'confirm_meal_plan',
  'reopen_meal_plan',
  'complete_meal_plan',
  'resume_meal_plan',
  'add_grocery_list_item',
  'update_grocery_list_item',
  'remove_grocery_list_item',
  'check_grocery_list_item',
  'resolve_grocery_merge',
] as const;
const planShape = { mealPlanId: idSchema };
const listShape = { groceryListId: idSchema };
const version = {
  version: versionSchema.describe(
    'Latest version from get or the previous mutation. On conflict, reload and review before retrying.',
  ),
};
const mealItem = { ...planShape, itemId: idSchema, ...version };
const listItem = { ...listShape, itemId: idSchema, ...version };
// Raw wire shape: the shared service parses quantity strings to fractions.
// Avoid applying that transform twice through the SDK and the service.
const groceryFields = {
  name: z.string().min(1).max(160),
  quantity: z.string().nullable().optional(),
  unitCode: z.string().nullable().optional(),
  unitText: z.string().nullable().optional(),
  checked: z.boolean().optional(),
};

export function registerPlanningTools(
  server: McpServer,
  user: ActingUser,
  logger: Logger,
): string[] {
  const names: string[] = [];
  function register<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    readOnly: boolean,
    run: (input: z.infer<z.ZodObject<S>>) => Promise<unknown>,
  ) {
    names.push(name);
    const inputSchema: z.ZodRawShape = shape;
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: /^(remove|update|resolve)_/.test(name),
          openWorldHint: name === 'confirm_meal_plan',
        },
      },
      async (input): Promise<CallToolResult> =>
        runTool(logger, name, async () => {
          const result = await run(input as z.infer<z.ZodObject<S>>);
          const structured = Array.isArray(result) ? { plans: result } : { ...(result as object) };
          const text =
            name.includes('grocery') &&
            result &&
            typeof result === 'object' &&
            'normalization' in result
              ? groceryListText(
                  (result as Awaited<ReturnType<typeof service.getGroceryList>>).items,
                )
              : JSON.stringify(structured);
          return toolResult(text, structured);
        }),
    );
  }
  register(
    'list_meal_plans',
    'List the 100 most recently updated household meal plans, including status (draft, confirmed or done), recipe IDs, selected servings and grocery list ID.',
    {},
    true,
    () => service.listMealPlans(),
  );
  register(
    'create_meal_plan',
    'Create a persisted household meal plan after the user chooses to plan meals. Naming is optional.',
    { name: z.string().max(160).optional() },
    false,
    (input) => service.createMealPlan(input, user.id),
  );
  register(
    'get_meal_plan',
    'Retrieve a shared meal plan, its status, ordered meals, selected servings, current version and grocery list ID. Meals can only be changed while status is draft.',
    planShape,
    true,
    (input) => service.getMealPlan(input.mealPlanId),
  );
  register(
    'add_recipe_to_meal_plan',
    'Add an existing recipe to a draft meal plan with an explicit serving count. Repeated recipes are allowed.',
    { ...planShape, ...version, recipeId: idSchema, servings: servingsSchema },
    false,
    ({ mealPlanId, ...input }) => service.addRecipeToMealPlan(mealPlanId, input, user.id),
  );
  register(
    'update_meal_plan_item',
    'Change selected servings, recipe, or zero-based order position of one meal in a draft plan without changing the saved recipe.',
    {
      ...mealItem,
      servings: servingsSchema.optional(),
      position: z.number().int().min(0).max(49).optional(),
      recipeId: idSchema.optional(),
    },
    false,
    ({ mealPlanId, itemId, ...input }) =>
      service.updateMealPlanItem(mealPlanId, itemId, input, user.id),
  );
  register(
    'remove_recipe_from_meal_plan',
    'Remove a meal from a draft plan. The saved recipe and the grocery list are unaffected until the plan is saved again.',
    mealItem,
    false,
    (input) =>
      service.removeRecipeFromMealPlan(input.mealPlanId, input.itemId, input.version, user.id),
  );
  // A plan's lifecycle (ADR 0010). Saving is the one that reaches the model.
  register(
    'confirm_meal_plan',
    'Save a draft meal plan after the user is happy with it. This closes its meals and builds its one grocery list using AI ingredient interpretation and deterministic quantities. Saving a reopened plan rebuilds that same list and keeps what people already did to it: ticks, edits, removals, hand-added items and merge answers.',
    { ...planShape, ...version },
    false,
    (input) => service.confirmMealPlan(input.mealPlanId, input.version, user.id),
  );
  register(
    'reopen_meal_plan',
    'Reopen a saved meal plan so its meals can be changed. Its grocery list stays usable meanwhile and is rebuilt when the plan is saved again.',
    { ...planShape, ...version },
    false,
    (input) => service.reopenMealPlan(input.mealPlanId, input.version, user.id),
  );
  register(
    'complete_meal_plan',
    'Mark a saved meal plan as done once its meals are finished with. Its grocery list becomes read-only.',
    { ...planShape, ...version },
    false,
    (input) => service.completeMealPlan(input.mealPlanId, input.version, user.id),
  );
  register(
    'resume_meal_plan',
    'Move a done meal plan back to saved, so its grocery list can be used again.',
    { ...planShape, ...version },
    false,
    (input) => service.resumeMealPlan(input.mealPlanId, input.version, user.id),
  );
  register(
    'get_grocery_list',
    'Retrieve a meal plan\'s grocery list including quantities, checked state, provenance, merge suggestions and current version.',
    listShape,
    true,
    (input) => service.getGroceryList(input.groceryListId),
  );
  register(
    'add_grocery_list_item',
    'Add a manual grocery or household item. Quantity is a string such as 1 1/2, or null for unmeasured items.',
    { ...listShape, ...version, ...groceryFields },
    false,
    ({ groceryListId, ...input }) => service.addGroceryListItem(groceryListId, input, user.id),
  );
  register(
    'update_grocery_list_item',
    'Replace editable grocery item fields, retaining provenance. Supply current name, quantity, unit and checked state from get_grocery_list.',
    { ...listItem, ...groceryFields },
    false,
    ({ groceryListId, itemId, ...input }) =>
      service.updateGroceryListItem(groceryListId, itemId, input, user.id),
  );
  register(
    'remove_grocery_list_item',
    'Remove a grocery item from the list without changing its source recipes or meal plan. It stays removed when the plan is saved again, unless the meals then need a different amount.',
    listItem,
    false,
    (input) =>
      service.removeGroceryListItem(input.groceryListId, input.itemId, input.version, user.id),
  );
  register(
    'check_grocery_list_item',
    'Set or clear a grocery item shopping checkbox without changing its quantity, name or provenance.',
    { ...listItem, checked: z.boolean() },
    false,
    (input) =>
      service.checkGroceryListItem(
        input.groceryListId,
        input.itemId,
        input.version,
        input.checked,
        user.id,
      ),
  );
  register(
    'resolve_grocery_merge',
    'Accept or reject a possible ingredient merge after user review. Only compatible quantities can be merged.',
    { ...listShape, ...version, suggestionId: idSchema, merge: z.boolean() },
    false,
    (input) =>
      service.resolveGroceryMerge(
        input.groceryListId,
        input.suggestionId,
        input.version,
        input.merge,
        user.id,
      ),
  );
  return names;
}
