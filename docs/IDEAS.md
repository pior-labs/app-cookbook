# Ideas

Product intent for things that do not exist yet.

Nothing here is a commitment or a plan. When one of these becomes real work it
gets written up properly in `IMPLEMENTING.md`, built, and then that file is
deleted - see [`AGENTS.md`](../AGENTS.md) for how documentation works in this
repository.

There is no drift risk in this file, because none of it describes code.

---

## Smart recipe import

Give the application the URL of a recipe webpage and have it extract the recipe
into Cookbook's own format: name, description, primary image, ingredients with
quantities and units, servings, instructions, prep and cook time, source URL.

An LLM is the reasonable tool for interpreting badly structured recipe pages,
which is most of them.

**The part that matters:** an import must never save directly. It produces a
draft the cook reviews and corrects - ingredients, quantities, units,
instructions, category, tags, image, servings - and explicitly confirms. A
recipe that arrives wrong and silently becomes permanent is worse than no import
feature, because the error is discovered while cooking.

---

## Recipe Roulette

A swipe-based way to decide what to cook, for when nobody wants to browse.

The normal Cookbook answers "what recipes do we have?". Roulette answers "we
don't know what we want, help us pick". If it does not feel meaningfully
different from browsing, it is not worth building.

All active recipes are eligible by default, optionally narrowed by category and
tag before starting, then randomized for the session. One large card at a time,
dominated by the photo. Swipe left skips for this session only and changes
nothing about the recipe. Swipe right ends the session and goes straight to the
recipe, or into Cooking Mode.

**Constraints worth keeping:** swipe cannot be the only control - visible Skip
and Choose buttons must exist for desktop, accessibility, and preference. A
skipped recipe does not come back in the same session. When the pool is
exhausted, the user restarts, changes filters, or leaves; the application never
picks the last recipe by default just because everything else was skipped.
Roulette never alters recipe data or preferences.

---

## Backlog

Not commitments. Recorded so they are not re-proposed as though new.

Cooking: timers, step completion, expanded Cooking Mode.

Recipes: multiple images, ingredient substitutions, duplication and forking,
recipe history, last-cooked tracking, seasonal collections, AI-assisted recipe
creation.

Discovery: a recommendation engine, "what can I cook with what I have?".

Groceries beyond Phase 2: pantry tracking, store-section ordering, integration
with external grocery services.

Other: nutrition tracking, household dashboard integration, multi-user
extensions to Recipe Roulette.
