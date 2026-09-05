import {
  formatQuantity,
  scaleQuantity,
  unitLabel,
  type RecipeDetail,
  type RecipeIngredient,
  type RecipeSummary,
} from '@cookbook/domain';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { track } from '../inflight.js';
import type { Logger } from '../logger.js';

// The acting household member, resolved from configuration before any tool runs
// and passed to every per-user service call. It is never a tool argument
// (ADR 0006).
export interface ActingUser {
  id: number;
  name: string;
  email: string;
}

// Every tool returns both halves: `structuredContent` for a client that wants
// the record, and a text rendering for the model to read. The text is what a
// cook would actually be told - "½ cup onion, finely chopped" - because a model
// relaying `{numerator: 1, denominator: 2}` to a person reads it wrong.
export function toolResult(text: string, structured: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text }], structuredContent: structured };
}

export function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// A failing tool must answer, not throw. An unhandled rejection would take the
// stdio server down mid-session and leave the client with no reply at all, so
// every handler runs inside this.
//
// It is also what counts a call as in-flight, so a shutdown triggered by the
// client closing stdin waits for the call rather than cutting it off mid-query.
export async function runTool(
  logger: Logger,
  tool: string,
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  return track(async () => {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while running the tool.';
      logger.warn('Tool call failed', { tool, error: message });
      return toolError(message);
    }
  });
}

export function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

// One ingredient line, scaled to the requested servings and rendered the way
// the recipe screen renders it. `servings` equal to the recipe's base is not a
// special case - scaling by 1 is the identity, and routing both through the
// same call keeps one code path.
export function formatIngredient(
  ingredient: RecipeIngredient,
  baseServings: number,
  servings: number,
): string {
  const parts: string[] = [];

  if (ingredient.quantity) {
    const scaled = scaleQuantity(ingredient.quantity, baseServings, servings);
    parts.push(formatQuantity(scaled));

    // A custom unit is free text the household typed; a registered one has a
    // label that agrees with the scaled amount ("1 cup" against "2 cups").
    const unit = ingredient.unitCode
      ? unitLabel(ingredient.unitCode, scaled.numerator / scaled.denominator)
      : ingredient.unitText;
    if (unit) parts.push(unit);
  }

  parts.push(ingredient.name);

  const line = parts.join(' ');
  return ingredient.preparation ? `${line}, ${ingredient.preparation}` : line;
}

function ratingLine(recipe: RecipeSummary): string | null {
  const { average, count } = recipe.rating;
  if (average == null || count === 0) return null;
  return `rated ${average.toFixed(1)}/5 by ${formatCount(count, 'cook')}`;
}

// A one-line recipe rendering for list results. It carries what someone
// choosing a recipe asks about - what it is, how long it takes, how it was
// rated - and stops there, so a page of results stays readable.
export function formatSummaryLine(recipe: RecipeSummary): string {
  const facts: string[] = [recipe.categoryName];

  if (recipe.totalMinutes != null) facts.push(formatMinutes(recipe.totalMinutes));

  const rated = ratingLine(recipe);
  if (rated) facts.push(rated);

  if (recipe.userState.favorite) facts.push('favorited');
  if (recipe.userState.rating != null) facts.push(`you rated it ${recipe.userState.rating}/5`);

  const detail = recipe.description ? ` - ${recipe.description}` : '';
  return `- [${recipe.id}] ${recipe.name} (${facts.join(', ')})${detail}`;
}

export function formatSummaryList(heading: string, recipes: RecipeSummary[], empty: string): string {
  if (recipes.length === 0) return empty;
  return [heading, ...recipes.map(formatSummaryLine)].join('\n');
}

// The full recipe, scaled. Ingredients come first because that is the question
// asked most often of a recipe that has already been chosen.
export function formatRecipeDetail(recipe: RecipeDetail, servings: number): string {
  const lines: string[] = [`# ${recipe.name}`];

  if (recipe.description) lines.push('', recipe.description);

  const facts: string[] = [`Category: ${recipe.categoryName}`];
  if (recipe.tags.length > 0) facts.push(`Tags: ${recipe.tags.map((tag) => tag.name).join(', ')}`);
  if (recipe.prepMinutes != null) facts.push(`Prep: ${formatMinutes(recipe.prepMinutes)}`);
  if (recipe.cookMinutes != null) facts.push(`Cook: ${formatMinutes(recipe.cookMinutes)}`);

  const rated = ratingLine(recipe);
  if (rated) facts.push(`Household ${rated}`);
  if (recipe.userState.rating != null) facts.push(`You rated it ${recipe.userState.rating}/5`);
  if (recipe.userState.favorite) facts.push('One of your favorites');

  lines.push('', ...facts);

  // Being explicit about which serving count the amounts below belong to
  // matters: the whole point of scaling is that they are not the saved recipe's
  // amounts, and the base count has to stay visible.
  lines.push(
    '',
    servings === recipe.baseServings
      ? `## Ingredients (serves ${recipe.baseServings})`
      : `## Ingredients (scaled to ${servings} from a base of ${recipe.baseServings})`,
  );
  lines.push(
    ...recipe.ingredients.map(
      (ingredient) => `- ${formatIngredient(ingredient, recipe.baseServings, servings)}`,
    ),
  );

  lines.push('', '## Instructions');
  lines.push(...recipe.instructions.map((step, index) => `${index + 1}. ${step.body}`));

  if (recipe.notes) lines.push('', '## Notes', recipe.notes);

  const source = recipe.sourceUrl ?? recipe.sourceText;
  if (source) lines.push('', `Source: ${source}`);

  return lines.join('\n');
}

// Output schemas. These describe what `structuredContent` carries, so a client
// can rely on the shape without parsing the text rendering.
export const ratingSummarySchema = z.object({
  average: z.number().nullable(),
  count: z.number().int(),
});

export const userStateSchema = z.object({
  favorite: z.boolean(),
  rating: z.number().int().nullable(),
});

export const recipeSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  categoryId: z.number().int(),
  categoryName: z.string(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  totalMinutes: z.number().int().nullable(),
  rating: ratingSummarySchema,
  hasImage: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userState: userStateSchema,
});

// The scaled ingredient shape every recipe-returning tool uses. `quantity` is
// the rendered string rather than a fraction object, because that is the form a
// caller relays to a person; `quantityDecimal` is there for a caller doing
// arithmetic of its own.
export const scaledIngredientSchema = z.object({
  id: z.number().int(),
  position: z.number().int(),
  quantity: z.string().nullable(),
  quantityDecimal: z.number().nullable(),
  unit: z.string().nullable(),
  name: z.string(),
  preparation: z.string().nullable(),
  display: z.string(),
});

export type ScaledIngredient = z.infer<typeof scaledIngredientSchema>;

export function toScaledIngredient(
  ingredient: RecipeIngredient,
  baseServings: number,
  servings: number,
): ScaledIngredient {
  const scaled = ingredient.quantity
    ? scaleQuantity(ingredient.quantity, baseServings, servings)
    : null;

  return {
    id: ingredient.id,
    position: ingredient.position,
    quantity: scaled ? formatQuantity(scaled) : null,
    quantityDecimal: scaled ? scaled.numerator / scaled.denominator : null,
    unit: ingredient.unitCode
      ? unitLabel(ingredient.unitCode, scaled ? scaled.numerator / scaled.denominator : 1)
      : ingredient.unitText,
    name: ingredient.name,
    preparation: ingredient.preparation,
    display: formatIngredient(ingredient, baseServings, servings),
  };
}
