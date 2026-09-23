import type { GroceryItem, IngredientSource } from '../planning.js';
import { normalizeName } from '../text/normalize.js';
import { addQuantities, measureKey, type GeneratedItem } from './grocery.js';

// A plan has one grocery list, and saving a reopened plan rebuilds it. The
// rebuild is only worth having if it keeps what the person already did to the
// list - otherwise reopening a plan to add one dinner would throw away the
// shop that is half done. This is that carrying forward, as pure logic, so
// every rule is tested without a database. See ADR 0010.
//
// Two identities are in play, and the difference is the point:
//
// - A generated item is recognised by its *sources* - which meal, which
//   ingredient - never by its name. A person can rename an item; they cannot
//   change where it came from, so the sources survive every edit.
// - A merge decision is recognised by the *names that met*. "Green onion" and
//   "scallion" meeting again is the same question whichever meals brought
//   them, so it should be answered once.

// What a person did that the items alone cannot show afterwards: a rejected
// merge leaves no trace, and a removed item is gone.
export interface MergeDecision {
  names: string[];
  measure: string;
  canonicalName: string;
  merge: boolean;
}
export interface DismissedItem {
  keys: string[];
  need: string;
}

// A merge suggestion before its items have database ids: positions in the
// generated array.
export interface DraftSuggestion {
  canonicalName: string;
  indices: number[];
  reason: string;
}

// What the meals asked for: every contributing ingredient and its amount.
// Two items with the same need were asked for by exactly the same meals in
// exactly the same amounts, which is the only case where a person's edit or
// tick still means what it meant when they made it.
export function itemNeed(item: Pick<GroceryItem, 'sources'>): string {
  return JSON.stringify(
    item.sources
      .map((s: IngredientSource) => [
        s.key,
        s.quantity ? [s.quantity.numerator, s.quantity.denominator] : null,
        s.unitCode,
        s.unitText ?? null,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

// Every source the item now needs was already part of what was ticked, in the
// same amount. True when the need only shrank.
function coveredBy(item: Pick<GroceryItem, 'sources'>, previous: Pick<GroceryItem, 'sources'>[]): boolean {
  const had = new Set(previous.flatMap((p) => JSON.parse(itemNeed(p)) as unknown[]).map((s) => JSON.stringify(s)));
  return (JSON.parse(itemNeed(item)) as unknown[]).every((s) => had.has(JSON.stringify(s)));
}

function mergeKey(names: string[], measure: string): string {
  return JSON.stringify([[...names].map(normalizeName).sort(), measure]);
}

// Recorded when someone resolves a suggestion, from the items it covered.
export function mergeDecisionFor(
  items: Pick<GroceryItem, 'name' | 'quantity' | 'unitCode' | 'unitText'>[],
  canonicalName: string,
  merge: boolean,
): MergeDecision {
  return {
    names: items.map((i) => normalizeName(i.name)).sort(),
    measure: measureKey(items[0]),
    canonicalName,
    merge,
  };
}

// Recorded when someone removes a generated item.
export function dismissalFor(item: Pick<GroceryItem, 'sources'>): DismissedItem {
  return { keys: item.sources.map((s) => s.key), need: itemNeed(item) };
}

export interface PriorList {
  items: GroceryItem[];
  mergeDecisions: MergeDecision[];
  dismissed: DismissedItem[];
}

export function carryForward(
  generated: GeneratedItem[],
  suggestions: DraftSuggestion[],
  prior: PriorList,
): { items: GeneratedItem[]; suggestions: DraftSuggestion[]; dismissed: DismissedItem[] } {
  // 1. Answer again the merge questions already answered. Merges run first so
  //    the items the next step matches are the items the person last saw.
  const working: (GeneratedItem | null)[] = generated.map((i) => ({
    ...i,
    sources: [...i.sources],
  }));
  const decisions = new Map(prior.mergeDecisions.map((d) => [mergeKey(d.names, d.measure), d]));
  const touched = new Set<number>();
  let open: DraftSuggestion[] = [];
  for (const suggestion of suggestions) {
    // An earlier merge already consumed one of these items, so this question
    // no longer describes the list.
    if (suggestion.indices.some((i) => touched.has(i))) continue;
    const members = suggestion.indices.map((i) => working[i]!);
    const decision = decisions.get(mergeKey(members.map((m) => m.name), measureKey(members[0])));
    if (!decision) {
      open.push(suggestion);
      continue;
    }
    if (decision.merge) {
      const [first, ...rest] = suggestion.indices;
      const target = working[first]!;
      for (const index of rest) {
        const other = working[index]!;
        if (target.quantity && other.quantity)
          target.quantity = addQuantities(target.quantity, other.quantity);
        target.sources.push(...other.sources);
        working[index] = null;
        touched.add(index);
      }
      target.name = decision.canonicalName;
      touched.add(first);
    }
    // A rejected merge is simply not asked again.
  }

  // 2. Carry each person's action across, by sources.
  const previous = prior.items.filter((i) => i.sources.length > 0);
  const owners = new Map<string, GroceryItem[]>();
  for (const item of previous)
    for (const source of item.sources)
      owners.set(source.key, [...(owners.get(source.key) ?? []), item]);
  const dismissedByNeed = new Map(prior.dismissed.map((d) => [d.need, d]));
  const dismissedKeys = new Set(prior.dismissed.flatMap((d) => d.keys));
  // Only a removal still holding an item off the list is worth keeping. One
  // whose item came back is now carried by that item's flag, and one whose
  // meal is gone will never match again - and left in place, either would
  // re-flag an item the person has since accepted back.
  const stillDismissed: DismissedItem[] = [];

  const position = new Map<number, number>();
  const items: GeneratedItem[] = [];
  working.forEach((candidate, index) => {
    if (!candidate) return;
    const need = itemNeed(candidate);

    // Removed, and still asked for in exactly the same way: stays removed.
    const dismissal = dismissedByNeed.get(need);
    if (dismissal) {
      stillDismissed.push(dismissal);
      return;
    }

    const item: GeneratedItem = { ...candidate, checked: false, edited: false };
    delete item.changedSince;
    const matches = [
      ...new Set(candidate.sources.flatMap((s) => owners.get(s.key) ?? [])),
    ];
    // Each source belongs to exactly one generated item, so an equal need can
    // only come from a single previous item.
    const same = matches.length === 1 && itemNeed(matches[0]) === need ? matches[0] : null;

    if (same) {
      if (same.edited) {
        item.name = same.name;
        item.quantity = same.quantity;
        item.unitCode = same.unitCode;
        item.unitText = same.unitText;
        item.edited = true;
      }
      item.checked = same.checked;
      // A reason nobody has acted on yet is still true.
      if (same.changedSince) item.changedSince = same.changedSince;
    } else if (candidate.sources.some((s) => dismissedKeys.has(s.key))) {
      item.changedSince = 'removed';
    } else if (matches.some((m) => m.edited)) {
      item.changedSince = 'edited';
    } else if (matches.length && matches.every((m) => m.checked) && coveredBy(candidate, matches)) {
      // Everything the meals now ask for was already ticked - a meal was
      // removed, say, and the shared onions need fewer. Bought is bought.
      item.checked = true;
    } else if (matches.some((m) => m.checked)) {
      // Ticked for an amount the meals no longer ask for. Unticked, because a
      // tick that carried forward would mean never buying the difference.
      item.changedSince = 'ticked';
    }

    position.set(index, items.length);
    items.push(item);
  });

  // A suggestion survives only if every item it names is still on the list.
  open = open.flatMap((s) =>
    s.indices.every((i) => position.has(i))
      ? [{ ...s, indices: s.indices.map((i) => position.get(i)!) }]
      : [],
  );

  // 3. Things the person added by hand have no sources and nothing to
  //    reconcile. They come back exactly as they were.
  for (const manual of prior.items.filter((i) => i.sources.length === 0)) {
    const { id: _id, ...data } = manual;
    items.push(data);
  }

  return { items, suggestions: open, dismissed: stillDismissed };
}
