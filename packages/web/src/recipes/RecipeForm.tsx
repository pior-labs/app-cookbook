import { UNIT_DEFINITIONS, type CategorySummary, type TagSummary } from '@cookbook/domain';
import { useState } from 'react';
import type { ErrorFields } from '../api/client.js';
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
      className="rc-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <section className="rc-form__section">
        <h2 className="rc-form__heading">The basics</h2>

        <Field id="recipe-name" label="Recipe name" required error={fieldError(fields, 'name')}>
          <input
            className="rc-input"
            id="recipe-name"
            value={draft.name}
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
          <textarea
            className="rc-input rc-input--area"
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

        <div className="rc-form__grid">
          <Field
            id="recipe-category"
            label="Category"
            required
            error={fieldError(fields, 'categoryId')}
          >
            <select
              className="rc-input"
              id="recipe-category"
              value={draft.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
              aria-invalid={fieldError(fields, 'categoryId') ? true : undefined}
            >
              <option value="">Choose a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="recipe-servings"
            label="Base servings"
            required
            hint="What the quantities below make."
            error={fieldError(fields, 'baseServings')}
          >
            <input
              className="rc-input"
              id="recipe-servings"
              type="number"
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
            <input
              className="rc-input"
              id="recipe-prep"
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.prepMinutes}
              onChange={(event) => set('prepMinutes', event.target.value)}
            />
          </Field>

          <Field id="recipe-cook" label="Cook minutes" error={fieldError(fields, 'cookMinutes')}>
            <input
              className="rc-input"
              id="recipe-cook"
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.cookMinutes}
              onChange={(event) => set('cookMinutes', event.target.value)}
            />
          </Field>
        </div>
      </section>

      {photoSlot ? (
        <section className="rc-form__section">
          <h2 className="rc-form__heading">Photo</h2>
          {photoSlot}
        </section>
      ) : null}

      <section className="rc-form__section">
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
              <li className="rc-row" key={ingredient.key}>
                <div className="rc-row__fields rc-row__fields--ingredient">
                  <Field
                    id={`ingredient-${ingredient.key}-quantity`}
                    label="Amount"
                    error={quantityError}
                  >
                    <input
                      className="rc-input"
                      id={`ingredient-${ingredient.key}-quantity`}
                      value={ingredient.quantity}
                      placeholder="1 1/2"
                      onChange={(event) => setIngredient(index, { quantity: event.target.value })}
                      aria-invalid={quantityError ? true : undefined}
                    />
                  </Field>

                  <Field id={`ingredient-${ingredient.key}-unit`} label="Unit" error={unitError}>
                    <select
                      className="rc-input"
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
                    </select>
                  </Field>

                  {ingredient.unit === CUSTOM_UNIT ? (
                    <Field
                      id={`ingredient-${ingredient.key}-unit-text`}
                      label="Custom unit"
                      error={unitError}
                    >
                      <input
                        className="rc-input"
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
                    <input
                      className="rc-input"
                      id={`ingredient-${ingredient.key}-name`}
                      value={ingredient.name}
                      maxLength={160}
                      onChange={(event) => setIngredient(index, { name: event.target.value })}
                      aria-invalid={nameError ? true : undefined}
                    />
                  </Field>

                  <Field id={`ingredient-${ingredient.key}-prep`} label="Preparation">
                    <input
                      className="rc-input"
                      id={`ingredient-${ingredient.key}-prep`}
                      value={ingredient.preparation}
                      placeholder="diced"
                      maxLength={160}
                      onChange={(event) =>
                        setIngredient(index, { preparation: event.target.value })
                      }
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
      </section>

      <section className="rc-form__section">
        <RowList
          legend="Instructions"
          error={fieldError(fields, 'instructions')}
          addLabel="Add step"
          onAdd={() => set('instructions', [...draft.instructions, emptyInstruction()])}
        >
          {draft.instructions.map((instruction, index) => {
            const bodyError = fieldError(fields, `instructions.${index}.body`);

            return (
              <li className="rc-row" key={instruction.key}>
                <div className="rc-row__fields">
                  <Field
                    id={`instruction-${instruction.key}`}
                    label={`Step ${index + 1}`}
                    required
                    error={bodyError}
                  >
                    <textarea
                      className="rc-input rc-input--area"
                      id={`instruction-${instruction.key}`}
                      rows={2}
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
      </section>

      <section className="rc-form__section">
        <h2 className="rc-form__heading">Notes, tags, and source</h2>

        <Field
          id="recipe-notes"
          label="Notes"
          hint="Anything you want to remember next time."
          error={fieldError(fields, 'notes')}
        >
          <textarea
            className="rc-input rc-input--area"
            id="recipe-notes"
            rows={3}
            value={draft.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        </Field>

        <fieldset className="rc-rows">
          <legend className="rc-rows__legend">Tags</legend>
          {fieldError(fields, 'tagIds') ? (
            <p className="rc-field__error" role="alert">
              {fieldError(fields, 'tagIds')}
            </p>
          ) : null}

          {tags.length === 0 ? (
            <p className="rc-field__hint">No tags yet. Add the first one below.</p>
          ) : (
            <ul className="rc-tag-list">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <label className="rc-tag">
                    <input
                      type="checkbox"
                      checked={draft.tagIds.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                    <span>{tag.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="rc-tag-create">
            <label className="rc-field__label" htmlFor="recipe-new-tag">
              New tag
            </label>
            <div className="rc-tag-create__row">
              <input
                className="rc-input"
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
              <button
                className="rc-button rc-button--ghost"
                type="button"
                onClick={() => void handleCreateTag()}
                disabled={newTag.trim() === '' || tagBusy}
              >
                {tagBusy ? 'Adding…' : 'Add tag'}
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset className="rc-rows">
          <legend className="rc-rows__legend">Where it came from</legend>
          <div className="rc-choice-row">
            {(
              [
                ['none', 'Nowhere in particular'],
                ['url', 'A link'],
                ['text', 'A book or person'],
              ] as [SourceKind, string][]
            ).map(([kind, label]) => (
              <label className="rc-choice" key={kind}>
                <input
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
            <Field id="recipe-source-url" label="Source link" error={fieldError(fields, 'sourceUrl')}>
              <input
                className="rc-input"
                id="recipe-source-url"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={draft.sourceUrl}
                onChange={(event) => set('sourceUrl', event.target.value)}
              />
            </Field>
          ) : null}

          {draft.sourceKind === 'text' ? (
            <Field
              id="recipe-source-text"
              label="Source"
              error={fieldError(fields, 'sourceText')}
            >
              <input
                className="rc-input"
                id="recipe-source-text"
                maxLength={500}
                placeholder="Grandma's blue binder"
                value={draft.sourceText}
                onChange={(event) => set('sourceText', event.target.value)}
              />
            </Field>
          ) : null}
        </fieldset>
      </section>

      <div className="rc-form__actions">
        <button className="rc-button rc-button--primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button className="rc-button rc-button--ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
