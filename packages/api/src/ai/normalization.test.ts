import { describe, expect, it } from 'vitest';
import { normalizeIngredients } from './normalization.js';
import type { ModelProvider } from './provider.js';
const provider =
  (value: unknown): ModelProvider =>
  async () => ({ value, model: 'fixture', inputTokens: 5, outputTokens: 5, latencyMs: 1 });
const group = (ids: number[], canonicalName = 'green onion', confidence = 0.99) => ({
  ids,
  canonicalName,
  confidence,
  reason: 'Equivalent grocery items',
});
describe('semantic normalization boundary', () => {
  it('requires a real model proposal before automatically merging reviewed equivalences', async () => {
    const result = await normalizeIngredients(
      ['scallion', 'green onions'],
      provider({ groups: [group([0, 1])] }),
    );
    expect(result.mode).toBe('llm');
    expect(result.identities.get('scallion')).toBe('green onion');
    expect(result.suggestions).toEqual([]);
  });
  it('does not trust high confidence for unfamiliar or wrong merges', async () => {
    const result = await normalizeIngredients(
      ['red onion', 'yellow onion'],
      provider({ groups: [group([0, 1], 'onion', 1)] }),
    );
    expect(result.identities.size).toBe(0);
    expect(result.suggestions).toHaveLength(1);
  });
  it('keeps low-confidence known equivalences for review', async () => {
    const result = await normalizeIngredients(
      ['scallion', 'green onion'],
      provider({ groups: [group([0, 1], 'green onion', 0.6)] }),
    );
    expect(result.identities.size).toBe(0);
    expect(result.suggestions).toHaveLength(1);
  });
  it.each([
    { groups: [group([0, 0])] },
    { groups: [group([0])] },
    { groups: [group([0, 2])] },
    { groups: [group([0, 1], 'green onion', 1.1)] },
    { groups: [group([0, 1])], quantity: 999 },
    'nonsense',
  ])('rejects malformed, duplicate, omitted and invented IDs: %j', async (value) => {
    const result = await normalizeIngredients(['scallion', 'green onion'], provider(value));
    expect(result.mode).toBe('fallback');
    expect(result.identities.size).toBe(0);
  });
  it('keeps an exact-name-only fallback when the provider fails', async () => {
    const result = await normalizeIngredients(['scallion', 'green onion'], async () => {
      throw new Error('timeout');
    });
    expect(result).toMatchObject({ mode: 'fallback', suggestions: [] });
    expect(result.identities.size).toBe(0);
  });
});
