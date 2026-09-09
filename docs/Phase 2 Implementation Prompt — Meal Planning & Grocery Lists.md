
# 1. Product Goal

Phase 2 should let authenticated users create an ad-hoc meal plan containing recipes already stored in Cookbook.

For each selected meal, the user chooses how many servings will be prepared.

Cookbook then:

1. scales each recipe's ingredients,
2. normalizes compatible ingredients,
3. aggregates quantities,
4. generates an editable grocery-list snapshot.

The resulting grocery list should be usable directly in Cookbook or easily copied into another application such as Apple Notes.

---

# 2. Core UX Flow

The primary flow should be:

1. **Start meal plan**
2. **Add recipes**
3. **Set servings**
4. **Generate grocery list**
5. **Review/edit grocery list**
6. Either:
   - **Start Shopping Mode**, or
   - **Copy grocery list as text**

Avoid unnecessary configuration.

---

# 3. Meal Plans

A meal plan represents a temporary/ad-hoc collection of meals.

It does not need to represent a calendar week.

Potential examples:

- Five dinners
- Three meals for the weekend
- Cottage Weekend
- Meals Before Vacation

A plan may optionally have a user-provided name, but naming should not be required.

The system should support multiple persisted plans unless current architecture provides a strong reason not to.

Plans should have a simple lifecycle such as:

- draft
- grocery list generated
- archived/completed

Exact technical representation should follow existing project architecture.

---

# 4. Meal Plan Items

Each meal-plan item should reference:

- a Cookbook recipe
- selected serving count
- display/order position

Do not assume the recipe's default serving count.

Example:

Recipe default:

> Chicken Curry — serves 4

Meal plan:

> Chicken Curry — 2 servings

Grocery generation must use the selected 2-serving quantity.

The same recipe may appear more than once if the architecture naturally permits it.

---

# 5. Meal Plan Builder UI

Add a dedicated **Meal Plan** experience to the application.

The interface should feel consistent with the polished consumer-style Cookbook UI.

Do not make it resemble:

- a spreadsheet
- Kanban board
- enterprise calendar
- recurring schedule manager
- admin CRUD interface

A plan should visually resemble a collection of selected recipe cards.

Example concept:

## Meal Plan

### Meal 1

**Chicken Curry**  
2 servings

`−` `2` `+`

Change · Remove

### Meal 2

**Tacos**  
4 servings

### Meal 3

**+ Add recipe**

At the bottom:

**+ Add another meal**

Primary action:

**Generate Grocery List**

---

# 6. Selecting Recipes

Reuse the existing recipe browsing/search experience wherever practical.

When the user selects **Add Recipe**, allow them to:

- search recipes
- browse recipes
- filter using existing Cookbook capabilities
- select a recipe

Do not duplicate recipe-discovery logic unnecessarily.

Once selected, the recipe is added to the meal plan.

---

# 7. Optional AI Meal Selection

Add support for an optional AI-assisted workflow where a user can ask for help selecting meals.

Example:

> Pick five quick dinners for two people. Mostly chicken and pasta.

The AI should use existing Cookbook recipes and existing search/filter/MCP or domain capabilities.

The AI should propose a plan rather than silently modifying the current plan.

Example:

## Suggested Plan

- Chicken Souvlaki
- Cajun Pasta
- Beef Stir Fry
- Tacos
- Chicken Curry

Actions:

- **Use this plan**
- **Regenerate**
- **Cancel**

AI meal selection is subjective, so nondeterministic behavior is acceptable here.

Do not allow the model to invent recipes that do not exist in Cookbook unless explicitly supported by another product feature.

If the AI capability cannot be cleanly implemented in this PR without introducing unrelated infrastructure, establish the domain/API interfaces required for it and document the remaining integration work.

---

# 8. Grocery List Generation

Generating a grocery list should:

1. read every meal-plan item,
2. retrieve its recipe ingredients,
3. scale quantities according to selected servings,
4. normalize ingredient identities where appropriate,
5. convert compatible units,
6. aggregate compatible ingredients,
7. create a persistent grocery-list snapshot.

The generated list must not remain dynamically coupled to recipe data.

Once generated, it becomes an editable snapshot.

Changing a recipe afterward should not unexpectedly rewrite an active shopping list.

The user may explicitly regenerate the list if needed.

---

# 9. Deterministic vs AI Responsibilities

Do **not** ask an LLM to perform the entire grocery calculation.

Use this division:

## Deterministic logic

Use normal application logic for:

- recipe serving scaling
- arithmetic
- compatible unit conversion
- adding quantities
- grocery-list persistence
- checked state
- manual edits

## AI-assisted logic

AI may be used for ambiguous ingredient normalization.

Examples:

- `scallion` → `green onion`
- `green onions` → `green onion`
- `potatoes` → `potato`

The AI should help determine ingredient identity, not perform authoritative quantity math.

---

# 10. Ingredient Normalization

Do not require a complete global ingredient taxonomy before Phase 2 can work.

The initial implementation may normalize ingredients at grocery-generation time.

Conceptually, normalization should produce information similar to:

```text
NormalizedIngredient
- originalName
- canonicalName
- quantity
- unit
- confidence
```

High-confidence normalizations may be merged automatically.

Low-confidence or semantically distinct ingredients must remain separate.

Examples:

High confidence:

> scallions + green onions  
> → green onions

Should remain separate:

> red onion  
> yellow onion

If AI normalization fails or is unavailable, grocery generation should still succeed using conservative deterministic matching rather than failing entirely.

---

# 11. Ambiguous Normalizations

Do not force the user to approve every normalization.

Only surface uncertain cases.

Example:

## Possible duplicate

**scallions** + **green onions**

Merge as **green onions**?

- Merge
- Keep separate

Avoid making grocery generation feel like a data-cleaning workflow.

---

# 12. Unit Conversion

Support deterministic conversion only where units are safely compatible.

Examples:

- mg ↔ g ↔ kg
- tsp ↔ tbsp ↔ cup ↔ ml ↔ l where supported by existing measurement conventions
- equivalent count-based units where unambiguous

Do not perform ingredient-density conversions such as:

> 1 cup flour → grams

unless the application has explicit ingredient-specific conversion data.

When units cannot safely be combined, retain separate entries.

---

# 13. Grocery List Review Screen

After generation, show a reviewable grocery list.

Potential grouping may include categories such as:

- Produce
- Meat
- Dairy
- Pantry

Do not make grocery-store categorization a blocking requirement if the current ingredient model does not support it.

The list must allow users to:

- edit an item
- change quantity
- remove an item
- add a manual item
- merge an identified duplicate where supported

Manual additions should support non-recipe items such as:

- milk
- bananas
- paper towels

The grocery list is an editable artifact after generation.

---

# 14. Ingredient Provenance

Where practical, retain provenance for generated grocery items.

Example:

## Chicken breast — 1.25 kg

Derived from:

- Chicken Souvlaki — 500 g
- Cajun Pasta — 250 g
- Chicken Curry — 500 g

This information does not need to dominate the default UI.

It may appear in an expanded item view or details interaction.

The purpose is to make unexpected grocery totals understandable.

---

# 15. Shopping Mode

Provide a simplified mobile-focused shopping experience.

Shopping Mode should emphasize:

- large touch targets
- clear quantities
- ingredient names
- checkboxes/check-off controls
- minimal visual noise

Example:

- [ ] 3 onions
- [ ] 2 bell peppers
- [ ] 1.25 kg chicken breast
- [x] 750 g pasta

Checked items may move into a **Completed** section.

Show lightweight progress such as:

> 8 of 14 items remaining

Users should also be able to manually add an item while shopping.

---

# 16. Copy Grocery List

Users must be able to copy the grocery list into the system clipboard as plain text.

This is intended for workflows such as pasting the list into:

- Apple Notes
- Messages
- Reminders
- another grocery-list application

Provide a clearly visible action such as:

**Copy List**

The copied result should be human-readable without requiring Cookbook.

Example:

```text
Grocery List

Produce
- 3 onions
- 2 bell peppers
- 1 bunch green onions

Meat
- 1.25 kg chicken breast
- 500 g ground beef

Pantry
- 750 g pasta
- 3 tbsp olive oil

Other
- Milk
- Paper towels
```

Do not include implementation IDs, recipe IDs, normalization metadata, or other internal information.

If categories are not supported, a simple flat list is acceptable:

```text
Grocery List

- 3 onions
- 2 bell peppers
- 1.25 kg chicken breast
- 750 g pasta
- 3 tbsp olive oil
```

Use the browser Clipboard API with an appropriate fallback where practical.

Provide clear success feedback such as:

> Grocery list copied.

---

# 17. MCP v2 / Phase 2 MCP Extensions

Phase 2 must extend the existing Cookbook MCP so the same workflow can be performed through the future Pior Labs chatbot.

Do not create MCP-only business logic.

Both the web UI and MCP tools must invoke the same underlying meal-plan and grocery-list services.

Conceptually:

```text
Web UI ───────┐
              ├── MealPlan / Grocery domain services
MCP Server ───┘
```

---

# 18. Required MCP Capabilities

Implement or expose capabilities equivalent to:

### Meal plans

- `create_meal_plan`
- `get_meal_plan`
- `add_recipe_to_meal_plan`
- `remove_recipe_from_meal_plan`
- `update_meal_plan_item`

`update_meal_plan_item` should support at minimum:

- serving count
- ordering/position where applicable

### Grocery lists

- `generate_grocery_list`
- `get_grocery_list`
- `add_grocery_list_item`
- `update_grocery_list_item`
- `remove_grocery_list_item`

Updating a grocery-list item should support the fields needed by the UI, including checked/completed state.

Use exact names consistent with existing MCP naming conventions if they differ from these suggestions.

---

# 19. MCP Conversational Use Cases

The resulting tools should support conversations such as:

> Plan five meals for us: tacos, chicken curry, Cajun pasta, burgers, and stir fry. Make each one for two people.

The assistant should be able to:

1. resolve recipes using existing Cookbook search tools,
2. create the meal plan,
3. add each recipe,
4. set servings.

Another example:

> Make me a four-meal plan using our Quick Meal recipes.

The assistant may:

1. search/filter recipes,
2. select reasonable options,
3. create the plan,
4. add the meals.

Then:

> Generate the grocery list.

The assistant calls the grocery-generation capability.

The resulting plan/list must also appear in the normal Cookbook web UI.

MCP and the web interface must operate on the same persisted objects.

---

# 20. MCP Tool Design

Prefer small composable MCP tools rather than one large tool such as:

`plan_meals_and_generate_grocery_list`

The assistant should be able to chain operations.

Example:

```text
search_recipes
      ↓
create_meal_plan
      ↓
add_recipe_to_meal_plan × N
      ↓
generate_grocery_list
```

The user does not need to see or understand the individual tool calls.

---

# 21. Home Page Integration

If there is an active/recent meal plan, the Cookbook home experience may display a compact continuation card.

Example:

## Current Meal Plan

5 meals planned  
12 grocery items remaining

**Continue →**

Do not add unnecessary dashboard complexity.

If there is no current meal plan, the section may be omitted.

---

# 22. Navigation

Meal planning should have a clear entry point, likely:

- Recipes
- **Meal Plan**
- Favorites

Do not require Grocery Lists to become a separate top-level navigation area unless implementation or UX testing provides a strong reason.

Grocery lists conceptually belong to their originating meal plan.

---

# 23. Explicit Non-Goals

Do not turn Phase 2 into any of the following:

- recurring weekly scheduling
- calendar synchronization
- breakfast/lunch/dinner calendar management
- pantry inventory
- expiration-date tracking
- grocery-store integrations
- grocery-price comparison
- automatic purchasing
- nutrition tracking
- complex ingredient taxonomy management
- mandatory AI dependency for basic grocery generation

A useful deterministic fallback must remain available if AI normalization is unavailable.

---

# 24. Suggested Delivery Breakdown

Do not implement the entire phase as one uncontrolled change if the scope becomes large.

Prefer incremental PRs such as:

## Phase 2A — Meal Plan Foundation

- data model
- meal-plan domain service
- plan builder
- recipe selection
- serving overrides
- persistence

## Phase 2B — Grocery Generation

- recipe scaling integration
- basic ingredient matching
- unit conversion
- aggregation
- grocery-list snapshot
- provenance

## Phase 2C — Grocery List UX

- review/edit UI
- manual items
- check-off state
- Shopping Mode
- Copy List

## Phase 2D — AI Ingredient Normalization

- normalization service
- confidence handling
- ambiguous merge UI
- deterministic fallback

## Phase 2E — MCP Extensions

- meal-plan tools
- grocery-list tools
- tool validation
- authentication/user attribution
- integration tests

If implementation dependencies make another ordering cleaner, document the reason before deviating.

---

# 25. Technical Principles

Preserve these rules:

- UI and MCP share business/domain logic.
- Serving arithmetic is deterministic.
- Unit conversion is deterministic.
- AI assists interpretation, not authoritative arithmetic.
- Grocery lists are snapshots.
- Ambiguous normalization should be conservative.
- Existing Cookbook recipe data remains the source of truth.
- The experience must remain useful without AI availability.
- Authenticated-user ownership/auditing should follow existing Phase 1 conventions.
- Do not duplicate existing recipe search or scaling logic.

---

# 26. Acceptance Criteria

Phase 2 is complete when:

1. An authenticated user can create an ad-hoc meal plan.
2. Recipes can be added to and removed from the plan.
3. Each planned recipe has a selectable serving count.
4. Recipes can be reordered where supported.
5. A grocery list can be generated from the plan.
6. Recipe quantities are correctly scaled before aggregation.
7. Compatible ingredients are aggregated.
8. Compatible units are deterministically converted where safe.
9. Ambiguous ingredients are not silently merged incorrectly.
10. AI-assisted normalization has a safe fallback.
11. The generated grocery list persists as an editable snapshot.
12. Grocery items can be manually added.
13. Grocery items can be edited.
14. Grocery items can be removed.
15. Grocery items can be checked off.
16. Shopping Mode works well on mobile.
17. Grocery-list provenance can be inspected where practical.
18. The grocery list can be copied as clean plain text.
19. MCP can create and modify meal plans.
20. MCP can generate and retrieve grocery lists.
21. MCP and UI operate on the same persisted meal-plan/grocery data.
22. Existing Phase 1 functionality continues to work.
23. Relevant tests, typechecking, linting, and builds pass.
24. `docs/STATUS.md` is updated to reflect the implementation.
25. `docs/TECHNICAL_DESIGN.md` and ADRs are updated for any new durable architectural decisions.

---

# 27. Before Implementation

Before coding, inspect the existing Phase 1 ingredient representation and document:

1. how ingredient names are currently stored,
2. how quantities and units are represented,
3. how serving scaling currently works,
4. whether reusable ingredient/domain services already exist,
5. which parts of grocery aggregation can reuse existing logic,
6. whether any schema changes are required.

If a Phase 1 design decision materially affects the proposed Phase 2 architecture, adapt Phase 2 to the existing implementation rather than creating duplicate systems.

Then implement Phase 2 incrementally.