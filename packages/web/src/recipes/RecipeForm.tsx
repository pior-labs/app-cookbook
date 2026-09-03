import { UNIT_DEFINITIONS, type CategorySummary, type TagSummary } from '@cookbook/domain';
import { useState } from 'react';
import type { ErrorFields } from '../api/client.js';
import { cn } from '@/lib/utils';
import {
  Button,
  chipLabelClass,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  SectionHeading,
  Select,
  tagChipLabelClass,
  tagChipStyle,
  Textarea,
} from '@/components/ui';
import { Field, describedBy, fieldError } from './fields.jsx';
import { RowControls, RowList } from './OrderedRows.jsx';
import {
  CUSTOM_UNIT,
  emptyIngredient,
  emptyInstruction,
  moveItem,
  type IngredientDraft,
  type InstructionDraft,
  type RecipeDraft,
  type SourceKind,
} from './form-state.js';

// The shared create/edit form. It holds entered values as its own state and
// never clears them on a failed submit, so a recoverable API or upload error
// leaves the cook's work intact (technical design section 11.2).

// Writing a recipe is long work, so the form is broken into opaque sheets a
// cook can hold one at a time rather than one unbroken column.
function FormSection({
  title,
  sub,
  children,
}: {
  title?: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-frost/80 bg-[rgba(var(--surface-rgb),0.94)] p-5 shadow-[0_10px_34px_-16px_color-mix(in_srgb,var(--ink)_28%,transparent)] sm:rounded-4xl sm:p-7">
      {title ? (
        <SectionHeading className="mb-5" sub={sub}>
          {title}
        </SectionHeading>
      ) : null}
      {children}
    </section>
  );
}

interface RecipeFormProps {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  categories: CategorySummary[];
  tags: TagSummary[];
  fields: ErrorFields;
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  onCreateTag: (name: string) => Promise<TagSummary | null>;
  photoSlot?: React.ReactNode;
}

export function RecipeForm({
  draft,
  onChange,
  categories,
  tags,
  fields,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
  onCreateTag,
  photoSlot,
}: RecipeFormProps) {
  const [newTag, setNewTag] = useState('');
  const [tagBusy, setTagBusy] = useState(false);

  function set<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function setIngredient(index: number, patch: Partial<IngredientDraft>) {
    const ingredients = draft.ingredients.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    onChange({ ...draft, ingredients });
  }

  function setInstruction(index: number, patch: Partial<InstructionDraft>) {
    const instructions = draft.instructions.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    onChange({ ...draft, instructions });
  }

  function toggleTag(id: number) {
    const tagIds = draft.tagIds.includes(id)
      ? draft.tagIds.filter((tagId) => tagId !== id)
      : [...draft.tagIds, id];
    onChange({ ...draft, tagIds });
  }

  async function handleCreateTag() {
    const name = newTag.trim();
    if (name === '' || tagBusy) return;

    setTagBusy(true);
    const created = await onCreateTag(name);
    setTagBusy(false);

    if (created) {
      setNewTag('');
      onChange({ ...draft, tagIds: [...draft.tagIds, created.id] });
    }
  }

  return (
    <form
      className="flex min-w-0 flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormSection title="The basics" sub="What it is, and how much it makes">
        <div className="flex flex-col gap-5">
          <Field id="recipe-name" label="Recipe name" required error={fieldError(fields, 'name')}>
            <Input
              id="recipe-name"
              value={draft.name}
              aria-required="true"
              maxLength={160}
              onChange={(event) => set('name', event.target.value)}
              aria-describedby={describedBy('recipe-name', undefined, fieldError(fields, 'name'))}
              aria-invalid={fieldError(fields, 'name') ? true : undefined}
            />
          </Field>

          <Field
            id="recipe-description"
            label="Description"
            hint="A sentence or two about why this one is worth cooking."
            error={fieldError(fields, 'description')}
          >
            <Textarea
              id="recipe-description"
              rows={3}
              maxLength={1000}
              value={draft.description}
              onChange={(event) => set('description', event.target.value)}
              aria-describedby={describedBy(
                'recipe-description',
                'hint',
                fieldError(fields, 'description'),
              )}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="recipe-category"
              label="Category"
              required
              error={fieldError(fields, 'categoryId')}
            >
              <Select
                id="recipe-category"
                value={draft.categoryId}
                aria-required="true"
                onChange={(event) => set('categoryId', event.target.value)}
                aria-invalid={fieldError(fields, 'categoryId') ? true : undefined}
              >
                <option value="">Choose a category…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              id="recipe-servings"
              label="Base servings"
              required
              hint="What the quantities below make."
              error={fieldError(fields, 'baseServings')}
            >
              <Input
                id="recipe-servings"
                type="number"
                aria-required="true"
                min={1}
                max={100}
                inputMode="numeric"
                value={draft.baseServings}
                onChange={(event) => set('baseServings', event.target.value)}
                aria-describedby={describedBy(
                  'recipe-servings',
                  'hint',
                  fieldError(fields, 'baseServings'),
                )}
              />
            </Field>

            <Field id="recipe-prep" label="Prep minutes" error={fieldError(fields, 'prepMinutes')}>
              <Input
                id="recipe-prep"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.prepMinutes}
                onChange={(event) => set('prepMinutes', event.target.value)}
              />
            </Field>

            <Field id="recipe-cook" label="Cook minutes" error={fieldError(fields, 'cookMinutes')}>
              <Input
                id="recipe-cook"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.cookMinutes}
                onChange={(event) => set('cookMinutes', event.target.value)}
              />
            </Field>
          </div>
        </div>
      </FormSection>

      {photoSlot ? (
        <FormSection title="Photo" sub="What it looks like when it works">
          {photoSlot}
        </FormSection>
      ) : null}

      <FormSection>
        <RowList
          legend="Ingredients"
          hint="Leave the amount blank for things like salt to taste."
          error={fieldError(fields, 'ingredients')}
          addLabel="Add ingredient"
          onAdd={() => set('ingredients', [...draft.ingredients, emptyIngredient()])}
        >
          {draft.ingredients.map((ingredient, index) => {
            const nameError = fieldError(fields, `ingredients.${index}.name`);
            const quantityError = fieldError(fields, `ingredients.${index}.quantity`);
            const unitError = fieldError(fields, `ingredients.${index}.unitText`);

            return (
              <li
                className="flex flex-col gap-3 rounded-[22px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.55)] p-3.5 sm:flex-row"
                key={ingredient.key}
              >
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    id={`ingredient-${ingredient.key}-quantity`}
                    label="Amount"
                    error={quantityError}
                  >
                    <Input
                      id={`ingredient-${ingredient.key}-quantity`}
                      value={ingredient.quantity}
                      placeholder="1 1/2"
                      onChange={(event) => setIngredient(index, { quantity: event.target.value })}
                      aria-invalid={quantityError ? true : undefined}
                    />
                  </Field>

                  <Field id={`ingredient-${ingredient.key}-unit`} label="Unit" error={unitError}>
                    <Select
                      id={`ingredient-${ingredient.key}-unit`}
                      value={ingredient.unit}
                      onChange={(event) => setIngredient(index, { unit: event.target.value })}
                    >
                      <option value="">No unit</option>
                      {UNIT_DEFINITIONS.map((unit) => (
                        <option key={unit.code} value={unit.code}>
                          {unit.plural}
                        </option>
                      ))}
                      <option value={CUSTOM_UNIT}>Custom…</option>
                    </Select>
                  </Field>

                  {ingredient.unit === CUSTOM_UNIT ? (
                    <Field
                      id={`ingredient-${ingredient.key}-unit-text`}
                      label="Custom unit"
                      error={unitError}
                    >
                      <Input
                        id={`ingredient-${ingredient.key}-unit-text`}
                        value={ingredient.unitText}
                        placeholder="clove"
                        maxLength={40}
                        onChange={(event) => setIngredient(index, { unitText: event.target.value })}
                      />
                    </Field>
                  ) : null}

                  <Field
                    id={`ingredient-${ingredient.key}-name`}
                    label="Ingredient"
                    required
                    error={nameError}
                  >
                    <Input
                      id={`ingredient-${ingredient.key}-name`}
                      value={ingredient.name}
                      aria-required="true"
                      maxLength={160}
                      onChange={(event) => setIngredient(index, { name: event.target.value })}
                      aria-invalid={nameError ? true : undefined}
                    />
                  </Field>

                  <Field id={`ingredient-${ingredient.key}-prep`} label="Preparation">
                    <Input
                      id={`ingredient-${ingredient.key}-prep`}
                      value={ingredient.preparation}
                      placeholder="diced"
                      maxLength={160}
                      onChange={(event) => setIngredient(index, { preparation: event.target.value })}
                    />
                  </Field>
                </div>

                <RowControls
                  index={index}
                  total={draft.ingredients.length}
                  label="ingredient"
                  canRemove={draft.ingredients.length > 1}
                  onMove={(from, to) => set('ingredients', moveItem(draft.ingredients, from, to))}
                  onRemove={(removeIndex) =>
                    set(
                      'ingredients',
                      draft.ingredients.filter((_, rowIndex) => rowIndex !== removeIndex),
                    )
                  }
                />
              </li>
            );
          })}
        </RowList>
      </FormSection>

      <FormSection>
        <RowList
          legend="Instructions"
          hint="One action per step, in the order they happen."
          error={fieldError(fields, 'instructions')}
          addLabel="Add step"
          onAdd={() => set('instructions', [...draft.instructions, emptyInstruction()])}
        >
          {draft.instructions.map((instruction, index) => {
            const bodyError = fieldError(fields, `instructions.${index}.body`);

            return (
              <li
                className="flex flex-col gap-3 rounded-[22px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.55)] p-3.5 sm:flex-row"
                key={instruction.key}
              >
                <div className="min-w-0 flex-1">
                  <Field
                    id={`instruction-${instruction.key}`}
                    label={`Step ${index + 1}`}
                    required
                    error={bodyError}
                  >
                    <Textarea
                      id={`instruction-${instruction.key}`}
                      rows={2}
                      aria-required="true"
                      maxLength={5000}
                      value={instruction.body}
                      onChange={(event) => setInstruction(index, { body: event.target.value })}
                      aria-invalid={bodyError ? true : undefined}
                    />
                  </Field>
                </div>

                <RowControls
                  index={index}
                  total={draft.instructions.length}
                  label="step"
                  canRemove={draft.instructions.length > 1}
                  onMove={(from, to) => set('instructions', moveItem(draft.instructions, from, to))}
                  onRemove={(removeIndex) =>
                    set(
                      'instructions',
                      draft.instructions.filter((_, rowIndex) => rowIndex !== removeIndex),
                    )
                  }
                />
              </li>
            );
          })}
        </RowList>
      </FormSection>

      <FormSection title="Notes, tags, and source" sub="Everything you want to remember">
        <div className="flex flex-col gap-7">
          <Field
            id="recipe-notes"
            label="Notes"
            hint="Anything you want to remember next time."
            error={fieldError(fields, 'notes')}
          >
            <Textarea
              id="recipe-notes"
              rows={3}
              value={draft.notes}
              onChange={(event) => set('notes', event.target.value)}
            />
          </Field>

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-2 p-0 text-[13px] font-medium text-ink-2">Tags</legend>
            {fieldError(fields, 'tagIds') ? (
              <FieldError>{fieldError(fields, 'tagIds')}</FieldError>
            ) : null}

            {tags.length === 0 ? (
              <FieldHint>No tags yet. Add the first one below.</FieldHint>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {tags.map((tag) => {
                  const on = draft.tagIds.includes(tag.id);

                  return (
                    <li key={tag.id}>
                      <label className={tagChipLabelClass(tag.color, on)} style={tagChipStyle(tag.color)}>
                        <input
                          className="sr-only"
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleTag(tag.id)}
                        />
                        <span>{tag.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 flex flex-col gap-1.5">
              <FieldLabel htmlFor="recipe-new-tag">New tag</FieldLabel>
              <div className="flex flex-wrap items-center gap-2.5">
                <Input
                  className="sm:max-w-64"
                  id="recipe-new-tag"
                  value={newTag}
                  maxLength={60}
                  onChange={(event) => setNewTag(event.target.value)}
                  // Enter inside the tag field must not submit the whole recipe.
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleCreateTag();
                    }
                  }}
                />
                <Button
                  onClick={() => void handleCreateTag()}
                  disabled={newTag.trim() === '' || tagBusy}
                >
                  {tagBusy ? 'Adding…' : 'Add tag'}
                </Button>
              </div>
            </div>
          </fieldset>

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-2 p-0 text-[13px] font-medium text-ink-2">Where it came from</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['none', 'Nowhere in particular'],
                  ['url', 'A link'],
                  ['text', 'A book or person'],
                ] as [SourceKind, string][]
              ).map(([kind, label]) => (
                <label className={chipLabelClass(draft.sourceKind === kind)} key={kind}>
                  <input
                    className="sr-only"
                    type="radio"
                    name="recipe-source"
                    value={kind}
                    checked={draft.sourceKind === kind}
                    onChange={() => set('sourceKind', kind)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {draft.sourceKind === 'url' ? (
              <div className={cn('mt-4 sm:max-w-lg')}>
                <Field
                  id="recipe-source-url"
                  label="Source link"
                  error={fieldError(fields, 'sourceUrl')}
                >
                  <Input
                    id="recipe-source-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={draft.sourceUrl}
                    onChange={(event) => set('sourceUrl', event.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {draft.sourceKind === 'text' ? (
              <div className="mt-4 sm:max-w-lg">
                <Field id="recipe-source-text" label="Source" error={fieldError(fields, 'sourceText')}>
                  <Input
                    id="recipe-source-text"
                    maxLength={500}
                    placeholder="Grandma's blue binder"
                    value={draft.sourceText}
                    onChange={(event) => set('sourceText', event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </fieldset>
        </div>
      </FormSection>

      {/* The save action follows the cook down a long form rather than waiting
          at the bottom of it. */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2.5 rounded-full border border-frost/80 bg-[rgba(var(--surface-rgb),0.88)] p-2 shadow-[var(--cb-menu-shadow)] backdrop-blur-xl backdrop-saturate-150">
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
