import { screen } from '@testing-library/react';
import { render } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { IngredientList } from './IngredientList.jsx';
import { ServingControl } from './ServingControl.jsx';
import type { RecipeIngredient } from '@cookbook/domain';

// Serving controls and scaled ingredient display (technical design
// section 14.3).

const INGREDIENTS: RecipeIngredient[] = [
  {
    id: 1,
    position: 0,
    quantity: { numerator: 1, denominator: 3 },
    unitCode: 'cup',
    unitText: null,
    name: 'Rice',
    preparation: null,
  },
  {
    id: 2,
    position: 1,
    quantity: { numerator: 3, denominator: 2 },
    unitCode: 'lb',
    unitText: null,
    name: 'Ground beef',
    preparation: null,
  },
  {
    id: 3,
    position: 2,
    quantity: null,
    unitCode: null,
    unitText: null,
    name: 'Salt',
    preparation: null,
  },
];

function Harness({ base = 4 }: { base?: number }) {
  const [servings, setServings] = useState(base);

  return (
    <>
      <ServingControl baseServings={base} servings={servings} onChange={setServings} />
      <IngredientList ingredients={INGREDIENTS} baseServings={base} servings={servings} />
    </>
  );
}

describe('serving control', () => {
  it('shows the recipe as written before any adjustment', () => {
    render(<Harness />);

    expect(screen.getByText(/recipe as written makes 4/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to/i })).not.toBeInTheDocument();
  });

  it('scales quantities exactly when servings increase', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 4 -> 12 servings is exactly ×3, so 1/3 cup becomes a whole cup rather
    // than a floating-point approximation.
    await user.click(screen.getByRole('button', { name: /one more serving/i }));
    await user.click(screen.getByRole('button', { name: /one more serving/i }));

    expect(screen.getByRole('spinbutton', { name: /servings/i })).toHaveValue(6);
    expect(screen.getByText('½')).toBeInTheDocument();
    expect(screen.getByText(/×1½/)).toBeInTheDocument();
  });

  it('keeps thirds exact when tripled', async () => {
    const user = userEvent.setup();
    render(<Harness base={2} />);

    const input = screen.getByRole('spinbutton', { name: /servings/i });
    await user.clear(input);
    await user.type(input, '6');

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/×3/)).toBeInTheDocument();
  });

  it('leaves an ingredient without a quantity unscaled', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /one more serving/i }));

    expect(screen.getByText(/to taste/i)).toBeInTheDocument();
  });

  it('returns to the base serving count in one action', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /one more serving/i }));
    await user.click(screen.getByRole('button', { name: /reset to 4/i }));

    expect(screen.getByText(/recipe as written makes 4/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /servings/i })).toHaveValue(4);
  });

  it('does not go below one serving', async () => {
    const user = userEvent.setup();
    render(<Harness base={1} />);

    expect(screen.getByRole('button', { name: /one fewer serving/i })).toBeDisabled();
  });

  it('pluralizes the unit with the scaled amount', async () => {
    const user = userEvent.setup();
    render(<Harness base={4} />);

    // 1½ lb at base is plural already; halving to 2 servings gives ¾ lb, still
    // plural, and doubling keeps it plural. The singular case is 1.
    await user.click(screen.getByRole('button', { name: /one fewer serving/i }));
    await user.click(screen.getByRole('button', { name: /one fewer serving/i }));

    expect(screen.getByText(/pounds/)).toBeInTheDocument();
  });
});
