import type { CategorySummary, TagSummary } from '@cookbook/domain';
import { screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ErrorFields } from '../api/client.js';
import { RecipeForm } from './RecipeForm.jsx';
import { convertTimeUnit, emptyDraft, emptyIngredient, emptyInstruction, expandSections, validateCreate, validateUpdate, type RecipeDraft } from './form-state.js';

// Recipe form validation, ordered-row editing, and accessible labelling.

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
  it('adds independent headings, renames and moves them, crosses boundaries and removes only the heading', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const draft = emptyDraft();
    draft.name = 'Bread'; draft.categoryId = '1';
    draft.ingredients[0].name = 'Flour'; draft.instructions[0].body = 'Mix.';
    render(<Harness initial={draft} onSubmit={onSubmit} />);
    const ingredients = within(screen.getByRole('group', { name: /Ingredients/ }));
    const steps = within(screen.getByRole('group', { name: /Instructions/ }));
    await user.click(ingredients.getByRole('button', { name: 'Add section' }));
    await user.type(ingredients.getByRole('textbox', { name: 'Ingredient section 1' }), 'Sauce');
    await user.click(ingredients.getByRole('button', { name: 'Add ingredient' }));
    await user.type(ingredients.getAllByRole('textbox', { name: 'Ingredient' })[1], 'Oil');
    await user.click(steps.getByRole('button', { name: 'Add section' }));
    await user.type(steps.getByRole('textbox', { name: 'Step section 1' }), 'Bake');
    await user.click(steps.getByRole('button', { name: 'Add step' }));
    await user.type(steps.getByRole('textbox', { name: 'Step 2' }), 'Bake.');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(validateCreate(onSubmit.mock.lastCall![0])).toMatchObject({ ok: true, input: {
      ingredients: [{ name: 'Flour', section: null }, { name: 'Oil', section: 'Sauce' }],
      instructions: [{ body: 'Mix.', section: null }, { body: 'Bake.', section: 'Bake' }],
    } });
    await user.clear(ingredients.getByRole('textbox', { name: 'Ingredient section 1' }));
    await user.type(ingredients.getByRole('textbox', { name: 'Ingredient section 1' }), 'Dressing');
    await user.click(ingredients.getByRole('button', { name: 'Move ingredient section 1 up' }));
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(validateCreate(onSubmit.mock.lastCall![0])).toMatchObject({ ok: true, input: {
      ingredients: [{ name: 'Flour', section: 'Dressing' }, { name: 'Oil', section: 'Dressing' }],
    } });
    // Moving an item past a boundary changes its section, not just its order
    // within the old section. Heading removal never removes its ingredient.
    await user.click(ingredients.getByRole('button', { name: 'Move ingredient 1 up' }));
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(validateCreate(onSubmit.mock.lastCall![0])).toMatchObject({ ok: true, input: {
      ingredients: [{ name: 'Flour', section: null }, { name: 'Oil', section: 'Dressing' }],
    } });
    await user.click(ingredients.getByRole('button', { name: 'Remove ingredient section 1' }));
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(validateCreate(onSubmit.mock.lastCall![0])).toMatchObject({ ok: true, input: {
      ingredients: [{ name: 'Flour', section: null }, { name: 'Oil', section: null }],
      instructions: [{ body: 'Mix.', section: null }, { body: 'Bake.', section: 'Bake' }],
    } });
  });
  it('labels every required field for assistive technology', () => {
    render(<Harness />);

    // Role queries assert the accessible name a screen reader announces, which
    // excludes the aria-hidden required marker in the visible label.
    expect(screen.getByRole('textbox', { name: 'Recipe name' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Base servings' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Base servings' })).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('What the quantities below make.')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ingredient' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Step 1' })).toBeInTheDocument();
  });

  it('enters decimal hours and switches units without changing the duration', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const draft = emptyDraft();
    draft.prepMinutes = '180';
    draft.cookMinutes = '61';
    render(<Harness initial={draft} onSubmit={onSubmit} />);

    const prep = screen.getByRole('spinbutton', { name: 'Prep time' });
    const prepUnit = screen.getByRole('combobox', { name: 'Prep time unit' });
    await user.selectOptions(prepUnit, 'hours');
    expect(prep).toHaveValue(3);
    await user.clear(prep);
    await user.type(prep, '2.5');
    await user.selectOptions(prepUnit, 'minutes');
    expect(prep).toHaveValue(150);

    const cookUnit = screen.getByRole('combobox', { name: 'Cook time unit' });
    await user.selectOptions(cookUnit, 'hours');
    await user.selectOptions(cookUnit, 'minutes');
    expect(screen.getByRole('spinbutton', { name: 'Cook time' })).toHaveValue(61);

    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ prepMinutes: '150', cookMinutes: '61' });
  });

  it('keeps a blank time blank when switching units and announces time errors', async () => {
    const user = userEvent.setup();
    render(<Harness fields={{ prepMinutes: ['Use a whole number of minutes.'] }} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Prep time unit' }), 'hours');
    const prep = screen.getByRole('spinbutton', { name: 'Prep time' });
    expect(prep).toHaveValue(null);
    expect(prep).toHaveAttribute('aria-invalid', 'true');
    expect(prep).toHaveAccessibleDescription('Use a whole number of minutes.');
  });

  it('shows server field errors against the right row and announces them', () => {
    render(
      <Harness
        fields={{
          name: ['Recipe name is required.'],
          baseServings: ['Use at least one serving.'],
          'ingredients.0.name': ['This ingredient needs a name.'],
        }}
      />,
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toContain('This ingredient needs a name.');
    expect(screen.getByRole('spinbutton', { name: 'Base servings' })).toHaveAccessibleDescription('Use at least one serving.');
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

  it('shows and announces unit-code errors beside the unit selector', () => {
    render(<Harness fields={{ 'ingredients.0.unitCode': ['Unknown unit.'] }} />);

    const unit = screen.getByRole('combobox', { name: 'Unit' });
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown unit.');
    expect(unit).toHaveAttribute('aria-invalid', 'true');
    expect(unit).toHaveAccessibleDescription('Unknown unit.');
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
  function validDraft() {
    const draft = emptyDraft();
    draft.name = 'Bread';
    draft.categoryId = '1';
    draft.ingredients[0].name = 'Flour';
    draft.instructions[0].body = 'Proof and bake.';
    return draft;
  }
  it.each(['ingredients', 'instructions'] as const)('rejects empty, blank, long and duplicate %s headings with visible field addresses', list => {
    const empty = list === 'ingredients' ? emptyIngredient : emptyInstruction;
    for (const label of ['', 'x'.repeat(81), 'Sauce']) {
      const draft = validDraft();
      const heading = { ...empty(), isSection: true, section: label };
      if (list === 'ingredients') draft.ingredients.push(heading as ReturnType<typeof emptyIngredient>);
      else draft.instructions.push(heading as ReturnType<typeof emptyInstruction>);
      for (const result of [validateCreate(draft), validateUpdate(draft, 1)]) {
        expect(result).toMatchObject({ ok: false, fields: { [`${list}.1.section`]: expect.any(Array) } });
      }
    }
    const draft = validDraft();
    if (list === 'ingredients') draft.ingredients = expandSections([
      { ...draft.ingredients[0], section: 'Sauce' },
      { ...draft.ingredients[0], key: 'other', section: ' sauce ' },
    ], emptyIngredient);
    else draft.instructions = expandSections([
      { ...draft.instructions[0], section: 'Sauce' },
      { ...draft.instructions[0], key: 'other', section: ' sauce ' },
    ], emptyInstruction);
    expect(validateCreate(draft)).toMatchObject({ ok: false, fields: { [`${list}.2.section`]: expect.any(Array) } });
  });
  it('addresses item errors after headings to editor rows', () => {
    const draft = validDraft();
    draft.ingredients = [{ ...emptyIngredient(), isSection: true, section: 'Dry' }, { ...draft.ingredients[0], quantity: 'guess' }];
    expect(validateCreate(draft)).toMatchObject({ ok: false, fields: { 'ingredients.1.quantity': expect.any(Array) } });
  });
  it('removing a heading joins its items to the named section above without changing step numbers', () => {
    const draft = validDraft();
    draft.ingredients = expandSections([
      { ...draft.ingredients[0], section: 'Main' },
      { ...draft.ingredients[0], key: 'oil', name: 'Oil', section: 'Sauce' },
    ], emptyIngredient);
    draft.instructions = expandSections([
      { ...draft.instructions[0], section: 'Mix' },
      { ...draft.instructions[0], key: 'bake', body: 'Bake.', section: 'Bake' },
    ], emptyInstruction);
    draft.ingredients.splice(2, 1);
    draft.instructions.splice(2, 1);
    expect(validateCreate(draft)).toMatchObject({ ok: true, input: {
      ingredients: [{ name: 'Flour', section: 'Main' }, { name: 'Oil', section: 'Main' }],
      instructions: [{ section: 'Mix' }, { body: 'Bake.', section: 'Mix' }],
    } });
  });
  it('requires explicit repair of an unheaded imported tail rather than silently regrouping it', () => {
    const draft = validDraft();
    draft.instructions = expandSections([
      { ...draft.instructions[0], section: 'Mix' },
      { ...draft.instructions[0], key: 'tail', body: 'Bake.', section: null },
    ], emptyInstruction);
    expect(validateCreate(draft)).toMatchObject({ ok: false, fields: { 'instructions.2.section': expect.any(Array) } });
  });

  it('converts decimal hours to whole minutes for both creation and updates', () => {
    const draft = validDraft();
    draft.prepMinutes = '2.5';
    draft.prepTimeUnit = 'hours';
    draft.cookMinutes = '0.1';
    draft.cookTimeUnit = 'hours';
    for (const result of [validateCreate(draft), validateUpdate(draft, 3)]) {
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.input).toMatchObject({ prepMinutes: 150, cookMinutes: 6 });
    }
  });

  it.each(['-1', '168.5', '0.001'])('rejects invalid or out-of-range hours: %s', (amount) => {
    const draft = validDraft();
    draft.prepTimeUnit = 'hours';
    draft.prepMinutes = amount;
    const result = validateCreate(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.prepMinutes).toBeDefined();
  });

  it('preserves whole minutes through an hours round trip', () => {
    const draft = validDraft();
    draft.prepTimeUnit = 'hours';
    draft.prepMinutes = convertTimeUnit('61', 'minutes', 'hours');
    const result = validateCreate(draft);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.prepMinutes).toBe(61);
  });

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
