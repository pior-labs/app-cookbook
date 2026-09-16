# Phase 2 — Ad-hoc Meal Planning, AI Recommendations & Grocery Lists

## Objective

Phase 2 expands Cookbook from a recipe library into a lightweight household meal-planning and grocery-list workflow.

The feature is intentionally **ad-hoc**, not calendar-driven.

Users should be able to:

1. create a temporary meal plan,
2. choose several existing Cookbook recipes,
3. optionally ask AI to recommend meals,
4. select serving counts,
5. generate one combined grocery list,
6. review and edit that list,
7. use it directly while shopping or copy it into another application.

A typical use case may be planning five dinners at once, but the feature should not assume it will be used every week.

---

# Product Principles

Phase 2 should remain focused on:

> Choose meals → confirm servings → generate grocery list → shop

It should not become:

* a recurring weekly scheduler,
* a calendar application,
* a pantry-management system,
* a grocery ordering service,
* or a full chatbot embedded inside Cookbook.

The UI should remain consistent with the polished consumer-style experience established in Phase 1.

---

# 1. Meal Plans

A meal plan represents an ad-hoc collection of recipes selected for an upcoming period.

A plan does not require calendar dates.

Potential examples include:

* Five dinners
* Weekend meals
* Cottage weekend
* Meals before vacation

Meal plans may optionally have a name but naming should not be required.

A plan should persist so that it can be accessed from either the Cookbook UI or MCP.

---

# 2. Meal Plan Items

Each meal-plan item should reference:

* recipe
* selected serving count
* display/order position

The recipe's default serving count must not be assumed.

Example:

> Chicken Curry
> Recipe default: 4 servings
> Planned amount: 2 servings

Grocery calculations must use the selected serving count.

The same recipe may appear more than once if needed.

---

# 3. Meal Plan Builder

The Meal Plan page should provide a simple visual builder.

Example:

## Meal Plan

### Meal 1

**Chicken Curry**
2 servings

`− 2 +`

Change · Remove

### Meal 2

**Tacos**
4 servings

### Meal 3

**+ Add recipe**

Actions:

* **+ Add another meal**
* **Help me choose**
* **Generate Grocery List**

Recipe selection should reuse existing Cookbook recipe browsing, search, filtering, tags, categories, and favorites where practical.

Do not build a separate duplicate recipe-discovery system.

---

# 4. Guided AI Meal Recommendations

Cookbook should provide a lightweight guided AI recommendation flow through an action such as:

**Help me choose**

This should open a modal or similarly focused interaction rather than embedding a general-purpose chat interface.

The modal should allow users to provide structured constraints.

Potential inputs include:

* number of meals
* servings per meal
* maximum preparation/cooking time
* category filters
* tag filters
* prefer favorites
* minimum rating
* avoid recently used recipes
* optional free-text preference

Example free-text preferences:

> Mostly chicken.

> No pasta more than twice.

> Keep everything fairly quick.

The AI should recommend only recipes that already exist in Cookbook.

It must not invent new recipes unless another product feature explicitly supports recipe generation.

---

# 5. Recommendation Results

AI-generated recommendations should be presented as a draft before modifying the meal plan.

Example:

## Suggested Meal Plan

* Chicken Souvlaki
* Beef Stir Fry
* Cajun Pasta
* Tacos
* Chicken Curry

Actions:

* **Use this plan**
* **Regenerate**
* **Cancel**

The result may include a short explanation of how the recommendation matched the user's constraints.

Example:

> Selected five recipes under 45 minutes, prioritized highly rated meals, and limited pasta to one meal.

The explanation should remain concise.

Once accepted, the suggestion should create or populate the same normal persisted meal plan used by manual planning.

AI-generated plans must not use a separate persistence model.

---

# 6. AI Recommendation Responsibility

Meal recommendations are intentionally nondeterministic.

This is an appropriate use of an LLM because selecting meals based on preferences, ratings, tags, time constraints, and natural-language requirements is subjective.

The LLM may reason over Cookbook recipe metadata and existing application data.

Deterministic application logic should remain responsible for:

* persistence,
* authorization,
* recipe availability,
* serving counts,
* validation.

---

# 7. Grocery List Generation

Once the meal plan is ready, the user can generate a grocery list.

Generation must:

1. retrieve all selected meal-plan recipes,
2. scale each recipe's ingredients according to planned servings,
3. preprocess ingredient data,
4. perform semantic ingredient normalization,
5. validate normalization output,
6. convert compatible units where safe,
7. aggregate compatible quantities,
8. create a persistent grocery-list snapshot.

The grocery list must not remain dynamically coupled to the recipes after generation.

If a recipe changes later, the grocery list should not silently change.

Users may explicitly regenerate the grocery list from the meal plan if needed.

---

# 8. LLM-Assisted Ingredient Normalization

Phase 2 must intentionally use an LLM for semantic ingredient normalization.

This is a core Phase 2 engineering requirement rather than an optional optimization.

The LLM should answer questions such as:

> Do these ingredient names represent the same grocery item?

Examples likely to normalize:

* scallion → green onion
* green onions → green onion
* chicken breasts → chicken breast
* boneless skinless chicken breast → chicken breast

Examples that should normally remain separate:

* red onion

* yellow onion

* chicken breast

* chicken thigh

* tomato paste

* tomato sauce

The LLM is responsible for interpreting semantic ingredient identity.

It is **not** responsible for authoritative grocery arithmetic.

---

# 9. Normalization Pipeline

The intended architecture is:

```text
Recipe ingredients
      ↓
Serving scaling
      ↓
Deterministic preprocessing
      ↓
LLM semantic normalization
      ↓
Structured output validation
      ↓
Deterministic unit conversion
      ↓
Deterministic quantity aggregation
      ↓
Grocery list
```

The guiding rule is:

> AI determines what ingredients mean. Application code determines what quantities equal.

---

# 10. Structured LLM Output

Ingredient normalization should use structured model output rather than free-form prose.

The output should conceptually contain:

* original ingredient
* canonical ingredient name
* grouping/mapping
* confidence or certainty indicator
* optional explanation or warning

Example:

```json
{
  "groups": [
    {
      "canonicalName": "green onion",
      "ingredients": [
        "scallions",
        "green onions"
      ],
      "confidence": 0.98
    }
  ],
  "unmatched": [
    "red onion"
  ]
}
```

The exact schema belongs in the technical design.

LLM output must be validated before it affects grocery-list aggregation.

---

# 11. AI Failure and Fallback

The normal grocery-generation path should attempt LLM normalization.

If the model:

* times out,
* fails,
* returns invalid structured data,
* or is otherwise unavailable,

Cookbook should fall back to conservative deterministic matching.

The grocery list should still generate.

The user may be informed that semantic normalization was unavailable.

Fallback behavior should prioritize avoiding incorrect merges over maximizing aggregation.

---

# 12. Ambiguous Ingredient Matches

Cookbook should not require the user to review every successful normalization.

High-confidence matches may be normalized automatically.

Questionable cases may be surfaced for review.

Example:

## Possible duplicate

**Heavy cream** + **whipping cream**

Merge as **cream**?

* Merge
* Keep separate

The exact confidence mechanism should be defined during technical design and evaluation.

Do not treat model-reported confidence as inherently trustworthy without validation/testing.

---

# 13. Deterministic Quantity Logic

The following must remain deterministic:

* serving-size scaling
* quantity arithmetic
* supported unit conversion
* quantity aggregation
* grocery-list persistence
* checked/completed state
* manual edits

An LLM must not be asked to perform final grocery quantity arithmetic when application code can calculate it reliably.

---

# 14. Unit Conversion

Support deterministic conversion only where units are safely compatible.

Examples:

* mg ↔ g ↔ kg
* tsp ↔ tbsp
* ml ↔ l
* other supported volume units where established application rules permit conversion

Do not automatically perform ingredient-density conversions such as:

> 1 cup flour → grams

unless Cookbook later gains explicit ingredient-specific conversion data.

If two quantities cannot safely be converted into a common unit, keep them separate.

---

# 15. Grocery List Review

After generation, users should receive an editable grocery list.

Users must be able to:

* edit an item
* change its quantity
* remove an item
* add a manual item
* resolve ambiguous merges where applicable
* regenerate the list from the meal plan

Manual items may include groceries or household items unrelated to recipes.

Examples:

* milk
* bananas
* paper towels

The generated grocery list becomes its own editable snapshot.

---

# 16. Ingredient Provenance

Generated grocery items should retain enough provenance to explain where totals came from.

Example:

## Chicken breast — 1.25 kg

Derived from:

* Chicken Souvlaki — 500 g
* Cajun Pasta — 250 g
* Chicken Curry — 500 g

This may be hidden behind an expandable detail view rather than shown by default.

Provenance is intended to make unexpected aggregation results understandable.

---

# 17. Shopping Mode

Users should be able to enter a simplified mobile-focused Shopping Mode.

The experience should emphasize:

* large touch targets
* ingredient name
* quantity
* check-off control
* minimal visual noise

Example:

* [ ] 3 onions
* [ ] 2 bell peppers
* [ ] 1.25 kg chicken breast
* [x] 750 g pasta

Checked items may move into a Completed section.

Show lightweight progress such as:

> 8 of 14 items remaining

Users should be able to manually add grocery-list items while shopping.

---

# 18. Copy Grocery List

Users must be able to copy the grocery list as plain text.

Provide an action such as:

**Copy List**

The copied text should be useful when pasted into:

* Apple Notes
* Messages
* Reminders
* another grocery application

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

If grocery categories are not available, a clean flat list is acceptable.

Do not copy internal IDs, provenance metadata, confidence scores, or normalization details.

Provide clear confirmation after copying.

---

# 19. MCP v2

Phase 2 must extend the existing Cookbook MCP so external agents can perform the same meal-planning workflow.

MCP and the Cookbook UI must operate on the same persisted domain objects and business services.

Do not create MCP-specific meal-plan logic.

Conceptually:

```text
Cookbook UI ──────┐
                  ├── Meal Plan / Grocery domain services
Cookbook MCP ─────┘
```

---

# 20. Meal Plan MCP Capabilities

MCP should expose capabilities equivalent to:

* `create_meal_plan`
* `get_meal_plan`
* `add_recipe_to_meal_plan`
* `remove_recipe_from_meal_plan`
* `update_meal_plan_item`

`update_meal_plan_item` should support at minimum:

* serving count
* item ordering where applicable

Use naming consistent with existing MCP conventions.

---

# 21. Grocery List MCP Capabilities

MCP should expose capabilities equivalent to:

* `generate_grocery_list`
* `get_grocery_list`
* `add_grocery_list_item`
* `update_grocery_list_item`
* `remove_grocery_list_item`

These tools should invoke the same underlying services used by the web application.

---

# 22. Future Chatbot Recommendation Workflow

The future Pior Labs chatbot should be able to perform richer conversational planning through MCP.

Example:

> Plan five dinners for two. Keep most under 45 minutes, use chicken at most twice, and prioritize recipes we rated highly.

The chatbot may:

1. search Cookbook recipes,
2. inspect relevant metadata,
3. reason over candidate meals,
4. propose a plan,
5. create the plan after appropriate confirmation,
6. generate the grocery list when requested.

This recommendation logic belongs at the agent/chatbot layer.

The Cookbook MCP provides the tools and data required to perform it.

---

# 23. Cookbook Recommendation vs Chatbot Recommendation

Cookbook itself should offer a bounded guided recommendation experience through the **Help me choose** modal.

The future chatbot may support much richer free-form planning.

Both should ultimately operate on the same recipe and meal-plan domain capabilities.

Cookbook should not embed a second general-purpose chatbot purely for meal planning.

---

# 24. Suggested Implementation Breakdown

Prefer incremental delivery.

## Phase 2A — Meal Plan Foundation

* meal-plan schema
* meal-plan service
* meal-plan builder
* recipe selection
* serving overrides
* persistence

## Phase 2B — Grocery Generation Foundation

* serving scaling integration
* deterministic preprocessing
* unit conversion
* grocery-list snapshot
* provenance

## Phase 2C — LLM Ingredient Normalization

* model integration
* prompt/schema design
* structured output validation
* normalization pipeline
* fallback behavior
* ambiguity handling
* evaluation dataset

## Phase 2D — Grocery List UX

* review/edit interface
* manual items
* Shopping Mode
* Copy List
* check-off workflow

## Phase 2E — Guided AI Meal Recommendations

* Help me choose modal
* structured preferences
* recommendation service
* proposal/review flow
* regenerate behavior

## Phase 2F — MCP v2

* meal-plan tools
* grocery-list tools
* service reuse
* auth/user attribution
* integration tests

Implementation order may change if repository dependencies justify it, but durable architectural changes should be documented.

---

# 25. LLM Evaluation

Because semantic normalization is an intentional learning objective, Phase 2 should include a small evaluation dataset.

Examples should include positive and negative normalization cases.

Potential examples:

* scallion / green onion → merge
* green onions / green onion → merge
* green onion / red onion → do not merge
* chicken breast / chicken breasts → merge
* chicken breast / chicken thigh → do not merge
* parmesan / parmigiano reggiano → expected normalization decision
* tomato sauce / tomato paste → do not merge

The evaluation should make it possible to compare:

* prompt changes
* model changes
* false merges
* missed merges
* latency
* cost

The purpose is to treat the LLM component as an engineered system rather than an opaque API call.

---

# 26. Observability

The technical implementation should provide enough observability to understand LLM behavior.

Where practical, capture:

* model used
* request latency
* success/failure
* structured-output validation failure
* fallback usage
* token usage/cost where available
* normalization decisions suitable for debugging

Do not expose sensitive application data unnecessarily in logs.

---

# 27. Non-Goals

Phase 2 does not include:

* recurring weekly scheduling
* calendar synchronization
* pantry inventory
* expiration-date tracking
* grocery-store integrations
* grocery pricing
* automated purchasing
* nutrition tracking
* a complete global ingredient taxonomy
* a full chat interface embedded in Cookbook

---

# 28. Acceptance Criteria

Phase 2 is complete when:

1. Users can create a persisted ad-hoc meal plan.
2. Recipes can be added and removed.
3. Each planned meal has a configurable serving count.
4. Users can build plans manually.
5. Cookbook provides a guided AI **Help me choose** flow.
6. AI recommendations use existing Cookbook recipes only.
7. AI recommendations are reviewed before being applied.
8. Users can generate a grocery list from a meal plan.
9. Recipe quantities are scaled deterministically.
10. Ingredient normalization uses an LLM in the normal generation path.
11. LLM normalization returns validated structured output.
12. The application has a conservative deterministic fallback.
13. Unit conversions and grocery arithmetic remain deterministic.
14. Ambiguous ingredients are not silently merged without appropriate handling.
15. Grocery lists persist as editable snapshots.
16. Users can add, edit, and remove grocery items.
17. Users can check grocery items off.
18. Grocery-item provenance can be inspected where practical.
19. Shopping Mode is usable on mobile.
20. Users can copy the grocery list as clean plain text.
21. MCP can create and modify meal plans.
22. MCP can generate and retrieve grocery lists.
23. MCP and the UI share the same domain services and persisted data.
24. The future chatbot has sufficient MCP capabilities to perform conversational meal planning.
25. A small LLM normalization evaluation dataset exists.
26. Relevant LLM latency/fallback behavior is observable.
27. Existing Phase 1 and MCP v1 functionality continues to work.
28. Relevant tests, linting, typechecking, and builds pass.
29. `docs/STATUS.md`, `docs/TECHNICAL_DESIGN.md`, and relevant ADRs are updated.
