# Phase 2 thinking notes - meal planning and grocery lists

**Status:** Working notes. **Not an approved document.**

This is thinking material for a decision that has not been made. It does not sit
in the source-of-truth hierarchy and it does not override [`PRD.md`](./PRD.md) or
[`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md). Nothing in it is decided except
what section 4 marks as decided, and nothing here has been implemented.

It is tracked only so it can be read away from the machine it was written on.
Once Phase 2 is settled it should be folded into the technical design and an ADR,
and this file deleted rather than left to rot alongside them.

Written 2026-09-07.

Source material: PRD section 11 (the approved requirement), technical design
section 18 (what was deferred), and a look at the actual dev data.

---

## 1. What the PRD actually asks for

Two features, not one:

- **Weekly meal planning.** Associate recipes with days of a week and say how
  many servings will be prepared. Not every day needs a meal.
- **Grocery-list generation.** From selected planned recipes: read them, respect
  the serving counts, scale ingredients, combine identical or compatible ones,
  add the quantities. Then let the list be edited - add custom items, remove
  things, adjust quantities, check off while shopping.

One explicit constraint, worth keeping in view: *"This should primarily use
deterministic structured-data logic. An LLM should not be required for
arithmetic the application can calculate reliably."* AI is allowed eventually
for ambiguous ingredient normalization, and nothing else.

The PRD's own worked examples are the acceptance bar:

- two recipes each needing `1/2 potato` produce `1 potato`
- `500 g chicken` and `250 g chicken` produce `750 g chicken`

---

## 2. The evidence

Technical design section 18 deferred two things as the hard part: canonical
cross-recipe ingredient identity, and density conversion. The dev data says
neither is the blocker.

Every ingredient appearing in more than one recipe, from the ten seeded ones:

| Ingredient | Units seen across recipes | What it needs |
| --- | --- | --- |
| `all-purpose flour` | cup, cup | nothing - works today |
| `baking powder` | tsp, tsp | nothing - works today |
| `granulated sugar` | cup x3, tbsp | same-dimension conversion |
| `olive oil` | cup x2, tbsp | same-dimension conversion |
| `butter` | cup, tbsp x2 | same-dimension conversion |
| `kosher salt` | tbsp x2, tsp, none x2 | conversion, plus a rule for unmeasured |
| `eggs` | none x3, `large` | custom unit vs no unit |

And the one that does not even collide, because the names differ:

- `garlic clove` (Miso Butter Mushroom Toast) vs `garlic cloves` (Shakshuka).
  Two unrelated ingredients as far as the code is concerned.

### What this says

- **Both PRD examples already work.** Same name, same unit, exact fraction
  addition - that is `1/2 potato` + `1/2 potato` and `500 g` + `250 g`.
- **Density conversion never appears.** Not one ingredient is written in cups in
  one recipe and grams in another. People write recipes in one idiom. The thing
  section 18 called hard may simply never arrive.
- **The real gaps are small:** singular/plural, and conversion within a
  dimension (`cup` <-> `tbsp`, `oz` <-> `lb`).

Caveat to hold onto: this is ten seeded recipes written in one sitting by one
person. It is suggestive, not proof. A household entering recipes over a year
from different sources will be messier. The garlic case is encouraging precisely
because it appeared *without anyone trying* to create a collision.

---

## 3. The principle

**Prefer under-merging to over-merging.**

A missed merge is visible: two garlic lines on the list, noticed while shopping,
costs one edit. A wrong merge is invisible: one line with the wrong quantity,
discovered mid-recipe, costs a trip to the shop.

The PRD already makes lists editable after generation, which is the safety net.
So: combine only where confident, list separately otherwise, and never guess.

This is the argument against building canonical ingredient identity up front.

---

## 4. Decided (2026-09-07)

| Question | Choice |
| --- | --- |
| How a day holds recipes | Unordered set. No meal slots, no one-per-day limit. |
| Grocery list lifetime | Ad-hoc, generated per selection. Each list a new document. |
| Ingredient identity scope | Normalization only. No canonical ingredient entity, no learned alias table. |

### What ad-hoc lists buy

Generation becomes a pure one-way function: plan -> list. Afterwards the list is
just a document. No sync, no reconciliation, no "your plan changed, refresh?"
prompt, no merging fresh output into a list someone has already half checked off.
That is a whole category of state management not built and not tested.

### What it costs

Add a recipe to the plan after generating and you either regenerate (new list,
lose check-offs) or add the items by hand. Lists are cheap and a shop is a
one-hour window, so probably fine. **Watch this in real use.**

---

## 5. Shape (provisional)

### Do not touch `normalizeName`

It is shared by categories, tags, ingredients, and search, and it backs the
unique indexes on `categories.normalized_name` and `tags.normalized_name`. Teach
it singular/plural and `Snack` and `Snacks` become the same tag. That needs a
backfill of every `normalized_name` column and could hit unique-constraint
violations on data that is currently legal.

Instead: a separate ingredient-only aggregation key, computed at generation time,
never stored.

**Consequence: Phase 2 needs no change to the recipe schema at all.** No
migration on `recipe_ingredients`, no backfill, no risk to Phase 1 data. Only new
tables.

### Plan entries

Keyed by **date**, not week-plus-day. A date sorts naturally and sidesteps ISO
week numbering and year boundaries; "a particular week" is a date-range query.

Unordered set per day means no `position` column - order by `created_at, id` for
stable display. Servings defaults to the recipe's `base_servings`, validated
1-100 like everything else. Shared household data, like recipes.

### Grocery list items

Deliberately mirror `recipe_ingredients`: same nullable numerator/denominator
pair, same mutually exclusive `unit_code` / `unit_text`, same check constraints.
That reuses the existing domain validation and formatting, so a list line renders
through the same code that renders `1 1/2 cups`.

Plus: `checked`, and whether the item was generated or added by hand.

### Unit conversion

Add a factor to `UnitDefinition`, relative to a base per dimension. The registry
is text-backed, so this is additive and needs no migration. `UnitDefinition`
already carries `system: 'mass' | 'volume'`, so the dimension grouping exists.

Factors are exact rationals (`1 oz = 28.349523125 g`, `1 cup = 236.5882365 ml`),
so conversion stays exact in the existing fraction arithmetic and ADR 0002 holds.

### The refusal rules

Combine only when the aggregation key matches **and** the units share a
dimension. Everything else gets its own line:

- unitless vs measured (`salt to taste` + `2 tbsp salt`)
- custom unit vs known unit (`2 large eggs` + `3 eggs`)
- mass vs volume
- custom `unit_text` combines only on an exact match

### Worth adding

Record which recipes contributed to each line. A cheap join table, and it serves
the principle directly: "2 cups flour - from Banana Bread, Pancakes" makes a bad
merge visible at a glance rather than at the shop.

---

## 6. Still open - the thinking to do

Not asked yet, and each one changes something.

1. **Same recipe twice on one day?** Batch cooking says allow it. A unique
   constraint says prevent it. Which?
2. **A planned recipe gets moved to Trash.** Phase 1 deletion is recoverable, so
   the recipe still exists. Does the plan entry survive, grey out, or vanish? What
   does grocery generation do with it? This one has a real chance of being
   annoying either way.
3. **Check-off state: shared or per-user?** Recipes are shared, favorites are
   per-user. Two people in a shop with two phones is the case that decides it.
4. **Finding the right list.** Ad-hoc lists accumulate. Do they need names, or is
   "most recent" enough? At what point is a list stale enough to hide?
5. **Which planned recipes go into a list?** The PRD says "selected planned
   recipes". Is selection a date range, or ticking individual entries, or both?
6. **Display unit family.** `1 cup` + `200 ml` are both volume and convertible,
   but the output is either cups or millilitres. Same for `500 g` + `1 lb`. Rule
   needed - probably "whichever family the source ingredients mostly used", then
   the largest unit in that family that keeps the amount at or above 1. So
   `3 tsp` -> `1 tbsp`, not `15 ml`.
7. **Plan horizon.** Can you plan into the past? Arbitrarily far ahead? Do old
   entries ever get cleaned up, or is the plan a permanent record of what was
   cooked? (Note: PRD section 17 lists last-cooked tracking as a non-commitment,
   and a permanent plan history is quietly that feature.)
8. **Does the plan UI show scaled ingredients?** Planning 6 servings of a
   4-serving recipe scales the groceries. Does it also scale what you see on the
   plan screen?

---

## 7. Consequences to handle later

- **MCP tension.** PRD section 10 wants `get_meal_plan` and
  `generate_grocery_list` after Phase 2. The first is a read and fits. The second
  is a **write**, and ADR 0006 made MCP read-only with the service barrel
  exporting only readers, so read-only is enforced by what resolves. That needs a
  deliberate decision, not a quiet exception.
- **ADR 0007.** Aggregating on normalized name plus dimension, and deliberately
  not building canonical ingredient identity, with the evidence above, is exactly
  the kind of durable choice that gets reopened in six months without a record.
- **Technical design section 18** currently defers canonical ingredient identity
  and unit conversion. Both entries need updating to say what was decided instead.

---

## 8. Alternatives considered

- **Canonical ingredient entity now.** Most correct long term. Rejected for now:
  it is a migration, a curation UI, and a backfill before any grocery list works
  at all, and the evidence says normalized name plus dimension covers most of it.
  Revisit if real use produces merges the rules keep missing.
- **Learned alias table** (remember merges made by hand, so `garlic clove` =
  `garlic cloves` sticks). Attractive - it grows identity from actual use rather
  than up front. Deferred as scope, not rejected on merit. It is the natural
  second step if normalization alone proves too blunt.
- **Standing weekly list** instead of ad-hoc. Rejected: forces reconciliation
  logic between a regenerated list and one already edited and checked off.
- **Density conversion** (`1 cup flour` <-> `120 g flour`). Not needed by the
  evidence, needs a per-ingredient density table, and is the thing most likely to
  produce a confidently wrong number. Stay away unless real data demands it.
