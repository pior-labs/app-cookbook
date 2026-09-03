import type { CategorySummary, TagSummary } from '@cookbook/domain';
import { screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ErrorFields } from '../api/client.js';
import { RecipeForm } from './RecipeForm.jsx';
import { emptyDraft, validateCreate, type RecipeDraft } from './form-state.js';

// Recipe form validation, ordered-row editing, and accessible labelling
// (technical design section 14.3).

const CATEGORIES: CategorySummary[] = [
  { id: 1, name: 'Dinner', activeRecipeCount: 0, createdAt: '', updatedAt: '' },
  { id: 2, name: 'Dessert', activeRecipeCount: 0, createdAt: '', updatedAt: '' },
];

const TAGS: TagSummary[] = [
  { id: 7, name: 'Weeknight', color: null, activeRecipeCount: 0, createdAt: '', updatedAt: '' },
];

function Harness({
  fields = {},
  onSubmit = () => {},
  initial,
}: {
  fields?: ErrorFields;
  onSubmit?: (draft: RecipeDraft) => void;
  initial?: RecipeDraft;
}) {
  const [draft, setDraft] = useState<RecipeDraft>(initial ?? emptyDraft());

  return (
    <RecipeForm
      draft={draft}
      onChange={setDraft}
      categories={CATEGORIES}
      tags={TAGS}
      fields={fields}
      submitting={false}
      submitLabel="Save recipe"
      onSubmit={() => onSubmit(draft)}
      onCancel={() => {}}
      onCreateTag={async () => null}
    />
  );
}

describe('recipe form', () => {
  it('labels every required field for assistive technology', () => {
    render(<Harness />);

    // Role queries assert the accessible name a screen reader announces, which
    // excludes the aria-hidden required marker in the visible label.
    expect(screen.getByRole('textbox', { name: 'Recipe name' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Base servings' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ingredient' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Step 1' })).toBeInTheDocument();
  });

  it('shows server field errors against the right row and announces them', () => {
    render(
      <Harness
        fields={{
          name: ['Recipe name is required.'],
          'ingredients.0.name': ['This ingredient needs a name.'],
        }}
      />,
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toContain('This ingredient needs a name.');
    expect(screen.getByRole('textbox', { name: 'Recipe name' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('adds and removes ingredient rows, keeping at least one', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole('button', { name: /remove ingredient 1/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    expect(screen.getByRole('button', { name: /remove ingredient 1/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /remove ingredient 2/i }));
    expect(screen.queryByRole('button', { name: /remove ingredient 2/i })).not.toBeInTheDocument();
  });

  it('reorders ingredients from the keyboard and carries the values along', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /add ingredient/i }));

    const names = screen.getAllByRole('textbox', { name: 'Ingredient' });
    await user.type(names[0], 'Onion');
    await user.type(names[1], 'Garlic');

    // The first row cannot move up, which is what tells a keyboard user they
    // are at the top of the list.
    expect(screen.getByRole('button', { name: /move ingredient 1 up/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /move ingredient 2 up/i }));

    const reordered = screen.getAllByRole('textbox', { name: 'Ingredient' });
    expect(reordered[0]).toHaveValue('Garlic');
    expect(reordered[1]).toHaveValue('Onion');
  });

  it('renumbers instruction steps after a reorder', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /add step/i }));
    await user.type(screen.getByRole('textbox', { name: 'Step 1' }), 'Chop');
    await user.type(screen.getByRole('textbox', { name: 'Step 2' }), 'Simmer');

    await user.click(screen.getByRole('button', { name: /move step 2 up/i }));

    expect(screen.getByRole('textbox', { name: 'Step 1' })).toHaveValue('Simmer');
    expect(screen.getByRole('textbox', { name: 'Step 2' })).toHaveValue('Chop');
  });

  it('reveals a custom unit field only when custom is chosen', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByLabelText(/custom unit/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), '__custom__');
    expect(screen.getByLabelText(/custom unit/i)).toBeInTheDocument();
  });

  it('swaps the source field with the chosen kind', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByLabelText(/source link/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /a link/i }));
    expect(screen.getByLabelText(/source link/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /a book or person/i }));
    expect(screen.queryByLabelText(/source link/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^source$/i)).toBeInTheDocument();
  });

  it('does not submit the recipe when Enter is pressed in the new tag field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/new tag/i), 'Quick{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps entered values after a failed submit', async () => {
    const user = userEvent.setup();
    render(<Harness fields={{ name: ['Recipe name is required.'] }} />);

    const description = screen.getByLabelText(/description/i);
    await user.type(description, 'Worth making twice');

    expect(description).toHaveValue('Worth making twice');
  });

  it('toggles a tag on and off', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const tag = screen.getByRole('checkbox', { name: /weeknight/i });
    await user.click(tag);
    expect(tag).toBeChecked();

    await user.click(tag);
    expect(tag).not.toBeChecked();
  });
});

describe('draft validation', () => {
  it('reports an empty form against the fields the cook can see', () => {
    const result = validateCreate(emptyDraft());

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(Object.keys(result.fields)).toEqual(
      expect.arrayContaining(['name', 'categoryId', 'ingredients.0.name', 'instructions.0.body']),
    );
  });

  it('rejects an unparseable quantity on the row that holds it', () => {
    const draft = emptyDraft();
    draft.name = 'Chili';
    draft.categoryId = '1';
    draft.ingredients[0] = { ...draft.ingredients[0], name: 'Beef', quantity: 'a bunch' };
    draft.instructions[0] = { ...draft.instructions[0], body: 'Cook it.' };

    const result = validateCreate(draft);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields['ingredients.0.quantity']).toBeDefined();
  });

  // The payload is what the API parses, not what the schema parsed. Sending the
  // parsed value back would post `{ numerator, denominator }` where a typed
  // quantity belongs, and every recipe with a quantity would fail to save.
  it('accepts a complete draft and sends what the API can parse', () => {
    const draft = emptyDraft();
    draft.name = 'Chili';
    draft.categoryId = '1';
    draft.baseServings = '4';
    draft.prepMinutes = '15';
    draft.ingredients[0] = {
      ...draft.ingredients[0],
      name: 'Beef',
      quantity: '1 1/2',
      unit: 'lb',
    };
    draft.instructions[0] = { ...draft.instructions[0], body: 'Brown the beef.' };

    const result = validateCreate(draft);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.input.ingredients[0].quantity).toBe('1 1/2');
    expect(result.input.ingredients[0].unitCode).toBe('lb');
    expect(result.input.prepMinutes).toBe(15);
    expect(result.input.cookMinutes).toBeNull();
  });

  it('sends only the source kind the cook selected', () => {
    const draft = emptyDraft();
    draft.name = 'Chili';
    draft.categoryId = '1';
    draft.ingredients[0] = { ...draft.ingredients[0], name: 'Beef' };
    draft.instructions[0] = { ...draft.instructions[0], body: 'Cook.' };
    draft.sourceKind = 'text';
    draft.sourceUrl = 'https://example.test/left-over';
    draft.sourceText = "Grandma's binder";

    const result = validateCreate(draft);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The abandoned URL must not travel with the request: the API rejects
    // having both, and the database check enforces it too.
    expect(result.input.sourceUrl).toBeNull();
    expect(result.input.sourceText).toBe("Grandma's binder");
  });
});
