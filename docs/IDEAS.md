# Ideas

Product intent for things that do not exist yet.

Nothing here is a commitment or a plan. When one of these becomes real work it
gets written up properly in `IMPLEMENTING.md`, built, and then that file is
deleted - see [`AGENTS.md`](../AGENTS.md) for how documentation works in this
repository.

There is no drift risk in this file, because none of it describes code.

---

## Recipe Roulette

Deferred for possible later work. Scope lives in
[GitHub issue #20](https://github.com/pior-labs/app-cookbook/issues/20).

---

## Linked component recipes

Deferred: reuse a sauce, seasoning or other component by linking its recipe
from another recipe, for example "2 tbsp of my Italian seasoning recipe".
No linking capability is included in recipe sections.

Open questions before this becomes work:

- Should groceries expand the component's ingredients, or treat it as something
  kept on hand? How does the cook choose between those meanings?
- What recipe yield and yield unit are needed to turn a measured amount like
  "2 tbsp" into a fraction of the component recipe, rather than servings?
- In cooking mode, should component instructions appear inline or be a
  tap-through to a separate recipe?
- What happens when a linked recipe is trashed: retain a snapshot, mark it
  unavailable, or require a replacement? What should restoration do?
- How should cycles be prevented, including indirect links through several
  components?
- Should component recipes appear in dinner suggestions, or be excluded unless
  explicitly requested?

---

## Backlog

Not commitments. Recorded so they are not re-proposed as though new.

Cooking: timers, expanded Cooking Mode.

Recipes: multiple images, ingredient substitutions, duplication and forking,
recipe history, last-cooked tracking, seasonal collections, AI-assisted recipe
creation.

Discovery: a recommendation engine, "what can I cook with what I have?".

Groceries beyond Phase 2: pantry tracking, store-section ordering, integration
with external grocery services.

Other: nutrition tracking, household dashboard integration, multi-user
extensions to Recipe Roulette.
