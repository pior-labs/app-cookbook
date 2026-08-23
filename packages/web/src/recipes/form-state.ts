import {
  createRecipeSchema,
  updateRecipeSchema,
  type CreateRecipeRequest,
  type RecipeDetail,
  type UpdateRecipeRequest,
} from '@cookbook/domain';
import { formatQuantity } from '@cookbook/domain';
import type { ErrorFields } from '../api/client.js';

// The editable shape of a recipe while a cook is typing. Everything is a string
// because that is what inputs hold; conversion and validation happen once, on
// submit, through the same domain schemas the API enforces (technical design
// section 12). The web app never becomes the only implementation of a rule.

export const CUSTOM_UNIT = '__custom__';

export interface IngredientDraft {
  key: string;
  quantity: string;
  unit: string;
  unitText: string;
  name: string;
  preparation: string;
}

export interface InstructionDraft {
  key: string;
  body: string;
}

export type SourceKind = 'none' | 'url' | 'text';

export interface RecipeDraft {
  name: string;
  description: string;
  baseServings: string;
  prepMinutes: string;
  cookMinutes: string;
  notes: string;
  categoryId: string;
  sourceKind: SourceKind;
  sourceUrl: string;
  sourceText: string;
  ingredients: IngredientDraft[];
  instructions: InstructionDraft[];
  tagIds: number[];
}

// Stable keys keep React row identity correct across reordering and removal,
// where array index would reuse a key and move the wrong DOM node.
let keyCounter = 0;
export function nextKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

export function emptyIngredient(): IngredientDraft {
  return { key: nextKey('ing'), quantity: '', unit: '', unitText: '', name: '', preparation: '' };
}

export function emptyInstruction(): InstructionDraft {
  return { key: nextKey('step'), body: '' };
}

export function emptyDraft(): RecipeDraft {
  return {
    name: '',
    description: '',
    baseServings: '4',
    prepMinutes: '',
    cookMinutes: '',
    notes: '',
    categoryId: '',
    sourceKind: 'none',
    sourceUrl: '',
    sourceText: '',
    ingredients: [emptyIngredient()],
    instructions: [emptyInstruction()],
    tagIds: [],
  };
}

export function draftFromRecipe(recipe: RecipeDetail): RecipeDraft {
  return {
    name: recipe.name,
    description: recipe.description,
    baseServings: String(recipe.baseServings),
    prepMinutes: recipe.prepMinutes == null ? '' : String(recipe.prepMinutes),
    cookMinutes: recipe.cookMinutes == null ? '' : String(recipe.cookMinutes),
    notes: recipe.notes ?? '',
    categoryId: String(recipe.categoryId),
    sourceKind: recipe.sourceUrl ? 'url' : recipe.sourceText ? 'text' : 'none',
    sourceUrl: recipe.sourceUrl ?? '',
    sourceText: recipe.sourceText ?? '',
    ingredients: recipe.ingredients.map((ingredient) => ({
      key: nextKey('ing'),
      // Round-trips through the same display format the detail view uses, so an
      // edit does not silently rewrite `1 1/2` into a decimal.
      quantity: ingredient.quantity ? formatQuantity(ingredient.quantity, { unicode: false }) : '',
      unit: ingredient.unitCode ?? (ingredient.unitText ? CUSTOM_UNIT : ''),
      unitText: ingredient.unitText ?? '',
      name: ingredient.name,
      preparation: ingredient.preparation ?? '',
    })),
    instructions: recipe.instructions.map((instruction) => ({
      key: nextKey('step'),
      body: instruction.body,
    })),
    tagIds: recipe.tags.map((tag) => tag.id),
  };
}

function optionalNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const parsed = Number(trimmed);
  // A non-numeric string is passed through as NaN so the schema reports it on
  // the right field instead of it being silently dropped.
  return Number.isNaN(parsed) ? (Number.NaN as number) : parsed;
}

// The request body, not the parsed result. The schemas transform on the way in
// - a typed quantity becomes an exact fraction - so what a cook typed is what
// the API must receive; sending the parsed value back would post an object
// where a string belongs (section 12).
function toRequest(draft: RecipeDraft): CreateRecipeRequest {
  return {
    name: draft.name,
    description: draft.description,
    baseServings: Number(draft.baseServings.trim() === '' ? Number.NaN : draft.baseServings),
    prepMinutes: optionalNumber(draft.prepMinutes),
    cookMinutes: optionalNumber(draft.cookMinutes),
    notes: draft.notes.trim() === '' ? null : draft.notes,
    categoryId: draft.categoryId === '' ? Number.NaN : Number(draft.categoryId),
    sourceUrl: draft.sourceKind === 'url' && draft.sourceUrl.trim() !== '' ? draft.sourceUrl : null,
    sourceText:
      draft.sourceKind === 'text' && draft.sourceText.trim() !== '' ? draft.sourceText : null,
    ingredients: draft.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unitCode: ingredient.unit === '' || ingredient.unit === CUSTOM_UNIT ? null : ingredient.unit,
      unitText: ingredient.unit === CUSTOM_UNIT && ingredient.unitText.trim() !== ''
        ? ingredient.unitText
        : null,
      preparation: ingredient.preparation.trim() === '' ? null : ingredient.preparation,
    })),
    instructions: draft.instructions.map((instruction) => ({ body: instruction.body })),
    tagIds: draft.tagIds,
  };
}

// Zod paths and the API error envelope use the same dotted keys, so one error
// map drives client-side and server-side feedback identically (section 7.1).
export function fieldsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }): ErrorFields {
  const fields: ErrorFields = {};

  for (const issue of error.issues) {
    const path = issue.path.map((segment) => String(segment)).join('.') || '_';
    (fields[path] ??= []).push(issue.message);
  }

  return fields;
}

export type ValidationResult<T> =
  | { ok: true; input: T }
  | { ok: false; fields: ErrorFields };

// Validation and the payload are deliberately separate: the schema decides
// whether the draft is sendable, and what gets sent is the draft it approved.
export function validateCreate(draft: RecipeDraft): ValidationResult<CreateRecipeRequest> {
  const request = toRequest(draft);
  const parsed = createRecipeSchema.safeParse(request);

  return parsed.success ? { ok: true, input: request } : { ok: false, fields: fieldsFromZod(parsed.error) };
}

export function validateUpdate(
  draft: RecipeDraft,
  version: number,
): ValidationResult<UpdateRecipeRequest> {
  const request = { ...toRequest(draft), version };
  const parsed = updateRecipeSchema.safeParse(request);

  return parsed.success ? { ok: true, input: request } : { ok: false, fields: fieldsFromZod(parsed.error) };
}

// Reordering is an array move rather than a swap, so a row dragged or keyed
// several positions keeps the rows in between in their original order.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
