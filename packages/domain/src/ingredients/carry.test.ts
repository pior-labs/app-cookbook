import { describe, expect, it } from 'vitest';
import type { GroceryItem, IngredientSource } from '../planning.js';
import {
  carryForward,
  dismissalFor,
  mergeDecisionFor,
  type DraftSuggestion,
  type PriorList,
} from './carry.js';
import type { GeneratedItem } from './grocery.js';

// Meal item 1 is soup, meal item 2 is a stir fry. A key is `meal:ingredient`,
// the same shape generation writes.
function source(key: string, name: string, amount: number | null, unitCode: string | null = null): IngredientSource {
  const [meal, ingredient] = key.split(':').map(Number);
  return {
    key,
    recipeId: meal,
    recipeName: meal === 1 ? 'Soup' : 'Stir fry',
    recipeVersion: 1,
    mealItemId: meal,
    name,
    preparation: null,
    quantity: amount == null ? null : { numerator: amount, denominator: 1 },
    unitCode,
    unitText: null,
  };
}

function generated(name: string, sources: IngredientSource[], unitCode: string | null = null): GeneratedItem {
  const total = sources.reduce((sum, s) => sum + (s.quantity?.numerator ?? 0), 0);
  return {
    name,
    quantity: sources.every((s) => s.quantity) ? { numerator: total, denominator: 1 } : null,
    unitCode,
    unitText: null,
    checked: false,
    edited: false,
    sources,
  };
}

let nextId = 1;
function saved(item: GeneratedItem, patch: Partial<GroceryItem> = {}): GroceryItem {
  return { id: nextId++, ...item, ...patch };
}

const empty: PriorList = { items: [], mergeDecisions: [], dismissed: [] };
const onions = (amount: number) => generated('onion', [source('1:1', 'onion', amount)]);

function rebuild(next: GeneratedItem[], prior: PriorList, suggestions: DraftSuggestion[] = []) {
  return carryForward(next, suggestions, prior);
}

describe('carrying a grocery list across a rebuild', () => {
  it('passes a first build through untouched', () => {
    const { items } = rebuild([onions(4)], empty);
    expect(items).toEqual([onions(4)]);
  });

  describe('hand-added items', () => {
    it('keeps them exactly as they were, ticked or not', () => {
      const towels = saved({ ...generated('paper towels', []), edited: true, checked: true });
      const { items } = rebuild([onions(4)], { ...empty, items: [towels] });
      expect(items).toContainEqual({ ...generated('paper towels', []), edited: true, checked: true });
    });
  });

  describe('ticks', () => {
    it('keep a tick when the meals need exactly what they needed', () => {
      const { items } = rebuild([onions(4)], { ...empty, items: [saved(onions(4), { checked: true })] });
      expect(items[0].checked).toBe(true);
      expect(items[0].changedSince).toBeUndefined();
    });

    it('keep a tick when a renamed item is still the same ingredient', () => {
      // Identity is by source, so what the person calls it does not matter.
      const { items } = rebuild([onions(4)], {
        ...empty,
        items: [saved(onions(4), { checked: true, name: 'Brown onions', edited: true })],
      });
      expect(items[0]).toMatchObject({ checked: true, name: 'Brown onions' });
    });

    it('drop a tick and say so when the meals now need more', () => {
      // Bought 4, now need 6: carrying the tick would mean never buying 2.
      const { items } = rebuild([onions(6)], { ...empty, items: [saved(onions(4), { checked: true })] });
      expect(items[0]).toMatchObject({ checked: false, changedSince: 'ticked' });
    });

    it('drop a tick when another meal now wants the same ingredient', () => {
      const both = generated('onion', [source('1:1', 'onion', 4), source('2:7', 'onion', 2)]);
      const { items } = rebuild([both], { ...empty, items: [saved(onions(4), { checked: true })] });
      expect(items[0]).toMatchObject({ checked: false, changedSince: 'ticked' });
    });

    it('keep a tick when a meal was removed and the need only shrank', () => {
      const both = generated('onion', [source('1:1', 'onion', 4), source('2:7', 'onion', 2)]);
      const { items } = rebuild([onions(4)], { ...empty, items: [saved(both, { checked: true })] });
      expect(items[0]).toMatchObject({ checked: true });
      expect(items[0].changedSince).toBeUndefined();
    });
  });

  describe('edits', () => {
    it('keep an edit when the need is unchanged', () => {
      const { items } = rebuild([onions(4)], {
        ...empty,
        items: [saved(onions(4), { quantity: { numerator: 5, denominator: 1 }, edited: true })],
      });
      expect(items[0]).toMatchObject({ quantity: { numerator: 5, denominator: 1 }, edited: true });
    });

    it('take the new amount and say so when the need changed', () => {
      const { items } = rebuild([onions(8)], {
        ...empty,
        items: [saved(onions(4), { quantity: { numerator: 5, denominator: 1 }, edited: true })],
      });
      expect(items[0]).toMatchObject({
        quantity: { numerator: 8, denominator: 1 },
        edited: false,
        changedSince: 'edited',
      });
    });
  });

  describe('removals', () => {
    it('keep an item removed when the need is unchanged', () => {
      const removed = saved(onions(4));
      const { items, dismissed } = rebuild([onions(4)], { ...empty, dismissed: [dismissalFor(removed)] });
      expect(items).toEqual([]);
      // Still holding the item off, so it is still worth keeping.
      expect(dismissed).toEqual([dismissalFor(removed)]);
    });

    it('bring an item back and say so when the need changed', () => {
      const removed = saved(onions(4));
      const { items, dismissed } = rebuild([onions(6)], { ...empty, dismissed: [dismissalFor(removed)] });
      expect(items[0]).toMatchObject({ name: 'onion', changedSince: 'removed' });
      // The flag carries it now; the record would only re-flag it later.
      expect(dismissed).toEqual([]);
    });

    it('forget a removal whose meal is gone', () => {
      const removed = saved(onions(4));
      const garlic = generated('garlic', [source('2:3', 'garlic', 2)]);
      const { dismissed } = rebuild([garlic], { ...empty, dismissed: [dismissalFor(removed)] });
      expect(dismissed).toEqual([]);
    });
  });

  describe('unacknowledged reasons', () => {
    it('keep a reason nobody has acted on across a later rebuild', () => {
      const flagged = saved(onions(6), { changedSince: 'ticked' });
      const { items } = rebuild([onions(6)], { ...empty, items: [flagged] });
      expect(items[0].changedSince).toBe('ticked');
    });
  });

  describe('merges', () => {
    const scallion = generated('scallion', [source('1:2', 'scallion', 2)]);
    const greenOnion = generated('green onion', [source('2:4', 'green onion', 3)]);
    const suggestion: DraftSuggestion = { canonicalName: 'green onion', indices: [0, 1], reason: 'Same thing' };

    it('ask a question nobody has answered', () => {
      const { suggestions } = rebuild([scallion, greenOnion], empty, [suggestion]);
      expect(suggestions).toEqual([suggestion]);
    });

    it('apply an accepted merge again without asking', () => {
      const decision = mergeDecisionFor([scallion, greenOnion], 'green onion', true);
      const { items, suggestions } = rebuild([scallion, greenOnion], { ...empty, mergeDecisions: [decision] }, [suggestion]);
      expect(suggestions).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ name: 'green onion', quantity: { numerator: 5, denominator: 1 } });
      expect(items[0].sources).toHaveLength(2);
    });

    it('carry a tick onto an item that was merged again', () => {
      const decision = mergeDecisionFor([scallion, greenOnion], 'green onion', true);
      const merged = saved({
        ...greenOnion,
        name: 'green onion',
        quantity: { numerator: 5, denominator: 1 },
        sources: [...scallion.sources, ...greenOnion.sources],
        checked: true,
      });
      const { items } = rebuild([scallion, greenOnion], { items: [merged], mergeDecisions: [decision], dismissed: [] }, [suggestion]);
      expect(items[0]).toMatchObject({ name: 'green onion', checked: true });
    });

    it('not ask again about a merge that was rejected', () => {
      const decision = mergeDecisionFor([scallion, greenOnion], 'green onion', false);
      const { items, suggestions } = rebuild([scallion, greenOnion], { ...empty, mergeDecisions: [decision] }, [suggestion]);
      expect(suggestions).toEqual([]);
      expect(items).toHaveLength(2);
    });

    it('drop a question whose item the person had removed', () => {
      const removed = saved(scallion);
      const { suggestions } = rebuild([scallion, greenOnion], { ...empty, dismissed: [dismissalFor(removed)] }, [suggestion]);
      expect(suggestions).toEqual([]);
    });

    it('point a surviving question at the items where they now sit', () => {
      const removed = saved(onions(4));
      const { suggestions } = rebuild(
        [onions(4), scallion, greenOnion],
        { ...empty, dismissed: [dismissalFor(removed)] },
        [{ ...suggestion, indices: [1, 2] }],
      );
      expect(suggestions[0].indices).toEqual([0, 1]);
    });
  });
});
