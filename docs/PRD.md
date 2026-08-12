# Pior Labs Cookbook

## Product Requirements Document

**Document version:** 0.1  
**Status:** Draft / pre-development  
**Product:** Cookbook  
**Repository:** `pior-labs/app-cookbook`  
**Category:** Self-hosted household productivity application

## 1. Product overview

Pior Labs Cookbook is a self-hosted household recipe management application designed to provide a centralized, enjoyable, and highly usable collection of recipes.

The initial application is intended for a small household and provides a shared recipe library in which authenticated users can create, modify, organize, discover, rate, favorite, and cook recipes.

The product should prioritize excellent user experience and visual design. It should feel like a polished consumer cooking application rather than an administrative interface for managing recipe records.

The Cookbook initially focuses on recipe management and serving-size calculations. Later phases add meal planning and grocery lists, smart recipe importing, and a playful Recipe Roulette discovery mode. Integration with the broader Pior Labs platform through MCP should begin after Phase 1 and evolve alongside later phases.

## 2. Problem statement

Recipes tend to become fragmented across websites, screenshots, handwritten notes, bookmarks, messages, cookbooks, and memory. Existing recipe websites commonly prioritize advertising, content discovery, or publishing rather than maintaining a small personalized collection of recipes that a household regularly cooks.

The Cookbook should provide one permanent household location for these recipes.

A recipe should answer practical questions immediately:

- What do we need?
- How much do we need?
- How many people does this recipe serve?
- How do we make it?
- How long does it take?
- Did we like it?
- Where did the recipe come from?

The application should remove the need to manually calculate ingredient quantities when cooking for different numbers of people.

Over time, the structured recipe data should also enable automatic grocery planning, recipe importing, interactive recipe discovery, and conversational access through other Pior Labs applications.

## 3. Product vision

Create a polished digital household cookbook that becomes the canonical source for recipes used in the home.

The application should make:

- Saving a recipe easy.
- Finding a recipe fast.
- Deciding what to cook enjoyable.
- Adjusting quantities automatic.
- Following a recipe while cooking straightforward.

The long-term vision extends beyond storing recipes. The Cookbook should eventually become the recipe and meal-planning data source for the broader Pior Labs ecosystem.

## 4. Target users

The initial product is intended for two authenticated household users.

The application does not initially need public registration, social discovery, public recipe sharing, creators, followers, comments, or other community functionality.

Recipes belong to the household rather than an individual user. All authenticated household users may:

- Create recipes
- Edit recipes
- Delete recipes
- Manage categories
- Manage tags
- Browse the complete recipe collection

The following interactions remain user-specific:

- Favorites
- Ratings
- Recently viewed recipes

The system should retain which user originally created a recipe even when that information is not displayed prominently.

## 5. Product principles

### 5.1 Consumer-quality experience

The Cookbook should visually resemble a polished modern cooking application rather than an internal CRUD tool. Food photography, typography, spacing, cards, responsive layouts, and interaction design should receive meaningful attention.

Functionality alone is not sufficient for the product to be considered complete.

### 5.2 Mobile-first cooking experience

Recipes are likely to be referenced from a phone or tablet while cooking. Recipe pages must remain highly usable on smaller displays.

Ingredients, measurements, serving controls, and instructions should remain easily readable and accessible.

### 5.3 Structured recipe data

Recipe information should be stored structurally wherever practical rather than as large blocks of unstructured text.

This is especially important for ingredients because serving scaling, future grocery-list generation, smart importing, and MCP functionality depend on predictable structured data.

### 5.4 Shared recipes, personalized discovery

The household maintains one shared recipe collection. Personal preferences remain personal.

For example, one user favoriting or rating a recipe must not overwrite another user's favorite or rating state.

### 5.5 Future features should build on the core model

Phase 1 should not implement future functionality unnecessarily. Its model should, however, avoid decisions that make planned grocery aggregation, smart importing, or MCP integration unnecessarily difficult later.

## 6. Phase 1 — Core Cookbook

Phase 1 establishes the Cookbook as a complete standalone application. The product should remain genuinely useful even if no future phases are implemented.

### 6.1 Recipe fields

Each recipe should support:

- **Name** — required primary recipe name.
- **Primary photo** — one image used prominently on recipe cards and the detail page.
- **Description** — a short description available to search and discovery surfaces.
- **Base serving size** — the canonical number of servings used for scaling.
- **Structured ingredients** — quantity, unit, ingredient name, and optional preparation/detail text.
- **Ordered instructions** — editable and reorderable preparation steps.
- **Optional notes** — household-specific adjustments, observations, or reminders.
- **Preparation time** — optional.
- **Cooking time** — optional; total time may be derived.
- **Primary category** — selected from application-managed categories.
- **Tags** — zero or more application-managed custom tags.
- **Optional source** — may be a URL or free text such as `Passed down by Grandma`.
- **Added by** — the user who originally created the recipe.

If a source is a URL it should render as a usable link. If it is plain text it should render as attribution. If no source exists, the source section should not render.

### 6.2 Ingredient model

Ingredients must be represented as structured records rather than exclusively as free-form strings.

Conceptually, an ingredient contains:

- Quantity
- Unit
- Ingredient name
- Optional preparation/detail text

Example:

- Quantity: `0.5`
- Unit: `cup`
- Ingredient: `onion`
- Preparation: `finely chopped`

Displayed naturally, this may appear as `½ cup onion, finely chopped`.

### 6.3 Serving and ingredient scaling

Each recipe has a base serving count, for example `Serves 4`.

A user must be able to temporarily adjust the desired serving count while viewing the recipe. Ingredient quantities automatically recalculate relative to the base serving size without modifying the saved recipe.

Human-readable fractions such as `½`, `⅓`, and `¼` should be preferred where appropriate rather than awkward decimal values.

### 6.4 Instructions and notes

Recipes contain ordered preparation steps. Users must be able to add, remove, edit, and reorder steps while editing a recipe.

Instructions should be highly readable on both mobile and desktop.

Recipe notes are optional and shared across the household. Examples include `Use less salt next time` or `Works better with chicken thighs`.

### 6.5 Categories

Recipes have one primary category.

The application may provide a small sensible starter set such as Breakfast, Lunch, Dinner, Dessert, Snack, and Drink.

Authenticated users must be able to create, rename, and delete categories through the UI. Deleting a category currently assigned to recipes must be handled safely rather than silently corrupting or removing recipes.

### 6.6 Tags

Tags provide a flexible organizational layer separate from categories. A recipe may have multiple tags.

There should be **no predefined tags**. Household users create their own tags through the UI.

Potential examples include `Late Night`, `Quick Meal`, `High Protein`, `Comfort Food`, `Date Night`, `Spicy`, `Meal Prep`, and `Summer`; these are examples only and should not exist automatically.

Users must be able to create, rename, delete, add, and remove tags through the application.

### 6.7 Favorites

Favorites are user-specific. Each authenticated user may independently favorite or unfavorite any recipe.

The application should provide an easy way for a user to browse or filter their favorites.

### 6.8 Ratings

Each authenticated user may provide one rating per recipe using a 1–5 star scale. A user may update their rating later.

The application may display an aggregate household rating while retaining individual ratings independently.

### 6.9 Recently viewed

The application should maintain recently viewed recipes on a per-user basis so users can quickly return to recipes they were considering or cooking.

Explicit `last cooked` tracking is not required.

### 6.10 Search

Global recipe search should consider at minimum:

- Recipe name
- Description
- Ingredients
- Category
- Tags

Users should not need to know how a recipe was categorized to find it. Searching `chicken`, for example, should return recipes that contain chicken as an ingredient even when it is not present in the title.

### 6.11 Filtering and browsing

Useful Phase 1 filters may include:

- Category
- Tag
- Favorites
- Rating
- Preparation/cooking time

The precise filter UI is a UX decision. It should remain simple enough for a household-scale recipe collection.

### 6.12 Recipe management

Authenticated users must be able to create, view, edit, and delete recipes.

Recipe creation should make adding ingredients, quantities, units, instructions, tags, category, and a photo straightforward enough that manual entry does not feel burdensome.

### 6.13 Deletion and recovery

Deleting a recipe should not immediately destroy it permanently.

Recipes should use a recoverable mechanism such as Trash or Recently Deleted. Users should be able to restore accidentally deleted recipes. Permanent deletion may occur through an explicit action or later retention policy.

### 6.14 Home and discovery experience

The home experience should encourage visual browsing instead of presenting a database table.

Potential sections include:

- Recently Viewed
- Favorites
- Highly Rated
- Recently Added
- Recipe categories

Food imagery should be a major component of the visual experience. Recipe cards should surface useful information without becoming cluttered.

### 6.15 Recipe detail experience

The recipe detail screen should prioritize information needed when choosing or preparing a recipe, including:

- Primary photo
- Name and description
- Rating and favorite control
- Prep/cook time
- Category and tags
- Serving controls
- Ingredients
- Instructions
- Notes
- Source when present

Editing and destructive actions should remain accessible without visually dominating the cooking experience.

### 6.16 Cooking mode

A dedicated Cooking Mode is desirable but not mandatory for the initial Phase 1 release. It may be treated as a Phase 1.x enhancement.

Cooking Mode would prioritize large typography, minimal distractions, clear numbered steps, serving context, ingredient reference, touch-friendly controls, and phone/tablet usability.

Timers and step completion are future ideas, not current requirements.

### 6.17 Authentication and access

The Cookbook should integrate with the existing Pior Labs authentication platform and should not provide independent public registration.

Only authenticated authorized household users should have access. Detailed authentication architecture belongs in `TECHNICAL_DESIGN.md` rather than this PRD.

## 7. Phase 1 user stories

### Discovery

- As a user, I want to browse recipes visually so choosing what to cook is enjoyable.
- As a user, I want to search by name, ingredient, tag, or category so I can quickly find recipes.
- As a user, I want to see recently viewed recipes so I can quickly return to something I was considering.
- As a user, I want to view my favorites so I can quickly find meals I know I enjoy.

### Creation

- As a user, I want to create a recipe with ingredients, measurements, instructions, and a photo so our recipes are documented consistently.
- As a user, I want to add a description so I can quickly understand what a recipe is.
- As a user, I want to provide an optional source so we remember where a recipe originated.
- As a user, I want to add notes so we can record improvements or household-specific adjustments.

### Preparation

- As a user, I want to select how many servings I am preparing so ingredient quantities automatically adjust.
- As a user, I want recipe steps displayed clearly so I can easily follow them while cooking.

### Organization and preferences

- As a user, I want to organize recipes into categories for broad browsing.
- As a user, I want to create custom tags that reflect how we actually use recipes.
- As a user, I want favorites to be independent so my favorites represent my preferences.
- As a user, I want to rate recipes from one to five stars so we remember which meals we enjoyed most.

### Safety

- As a user, I want deleted recipes to be recoverable so an accidental deletion does not permanently erase a recipe.

## 8. Phase 1 acceptance criteria

Phase 1 is functionally complete when:

1. Authorized users can authenticate and access the Cookbook.
2. Users can create, edit, view, and safely delete recipes.
3. Recipes support one primary photo.
4. Recipes support names and descriptions.
5. Recipes support structured ingredients with quantities and units.
6. Recipes define a base serving size.
7. Users can change serving count and ingredient quantities scale correctly.
8. Recipes support ordered preparation instructions.
9. Recipes support optional notes.
10. Recipes support prep and cooking time.
11. Recipes support optional source attribution.
12. Users can manage categories through the UI.
13. Users can manage arbitrary custom tags through the UI.
14. Multiple tags may be associated with one recipe.
15. Users can search recipes using meaningful recipe metadata.
16. Users can browse/filter recipes by useful organizational attributes.
17. Favorites are maintained separately per user.
18. Ratings are maintained separately per user using a 1–5 star scale.
19. The application retains which user created each recipe.
20. Recently viewed recipes are tracked individually per user.
21. Deleted recipes can be recovered.
22. The UI is responsive and usable from desktop, tablet, and mobile displays.
23. The application meets the intended consumer-quality visual and interaction standard rather than presenting primarily CRUD-style administrative screens.

## 9. Phase 1 non-goals

The following are explicitly outside the initial release:

- Public recipe sharing
- Public accounts
- Social features, comments, or following
- Grocery-list generation
- Weekly meal planning
- Nutrition or calorie tracking
- Automatic recipe URL importing
- AI-generated recipes
- MCP integration itself
- Multiple recipe photos
- Explicit last-cooked tracking
- Pantry/inventory management
- Grocery-store integrations

MCP is deliberately outside the Phase 1 release, but MCP v1 should begin after Phase 1 rather than waiting for all later product phases.

## 10. MCP integration — after Phase 1

MCP integration is a platform capability rather than a numbered Cookbook product phase.

The first MCP version should be introduced **after Phase 1**, once the core recipe model and application API are stable enough to expose safely.

### MCP v1

The initial MCP should focus primarily on stable recipe-library capabilities such as:

- `search_recipes`
- `get_recipe`
- `get_favorites`
- `get_top_rated_recipes`
- `get_recipes_by_tag`
- `scale_recipe`

Potential conversational interactions include:

- What pasta recipes do we have?
- Show me our chicken curry recipe.
- Scale our taco recipe to six people.
- What are my favorite quick meals?
- What are our highest-rated dinners?

### MCP evolution

The MCP should expand alongside later Cookbook phases rather than being redesigned as a final phase.

After Phase 2, additional capabilities may include:

- `get_meal_plan`
- `generate_grocery_list`

Phase 3 may later expose controlled recipe-import workflows where appropriate.

Phase 4 Recipe Roulette is primarily a UI experience and does not require a corresponding MCP feature unless a useful conversational interaction is identified later.

Exact MCP tools, write permissions, and contracts belong in the technical design.

## 11. Phase 2 — Meal Planning and Grocery Lists

Phase 2 expands the Cookbook from recipe management into household meal planning.

### Weekly meal planning

Users should be able to associate recipes with days of a particular week and specify the number of servings that will be prepared. Not every day must contain a planned meal.

### Grocery-list generation

Users should be able to generate a grocery list from selected planned recipes.

The generator should:

- Read recipes selected for the period
- Respect selected serving quantities
- Scale ingredients accordingly
- Combine identical or compatible ingredients
- Add required quantities together

For example, two recipes that each require `½ potato` should produce `1 potato`. Recipes requiring `500 g chicken` and `250 g chicken` should produce `750 g chicken`.

This should primarily use deterministic structured-data logic. An LLM should not be required for arithmetic the application can calculate reliably. AI may eventually assist with ambiguous ingredient normalization.

### Grocery-list interaction

Users should be able to:

- Add custom grocery items
- Remove unnecessary items
- Adjust quantities
- Check items off while shopping

The generated list therefore becomes editable after generation.

## 12. Phase 3 — Smart Recipe Import

Phase 3 introduces assisted recipe ingestion.

Users should be able to provide the URL of a recipe webpage. The application should attempt to extract and convert the page into the Cookbook's internal format, including where available:

- Name
- Description
- Primary image
- Ingredients
- Quantities and units
- Serving count
- Instructions
- Prep time
- Cook time
- Source URL

An LLM may be used to interpret inconsistent or poorly structured webpage content and normalize it into the Cookbook schema.

### Import review

Imported recipes must not immediately become permanent recipes without review.

The application should present a draft that users can correct before saving, including ingredients, quantities, units, instructions, category, tags, image, and serving information.

The user explicitly confirms the import before the recipe is saved.

## 13. Phase 4 — Recipe Roulette

Phase 4 introduces an optional interactive recipe discovery mode designed to make deciding what to cook more engaging.

Rather than browsing through the normal recipe library, users enter a swipe-based experience where eligible recipes are randomized and presented one at a time.

### Entry and filtering

Recipe Roulette should be accessible as a distinct experience from the normal recipe browser.

By default, all active recipes are eligible. Before starting, users may optionally narrow the pool using filters.

Initial filters should include:

- Category
- Tags

Future filters may include maximum cooking time, minimum rating, favorites only, specific ingredients, or other properties that become available later.

### Recipe pool

Eligible recipes are randomized for the session. A recipe should normally appear only once in a session unless the user restarts.

Deleted or unavailable recipes must not appear.

### Swipe experience

Recipes are presented individually using a large visual card dominated by the primary food photo.

The card may also show name, rating, prep/cook time, category, tags, serving size, and short description.

**Swipe left — Skip:** removes the recipe from the current session only. It does not change recipe data, rating, favorites, tags, or future visibility.

**Swipe right — Choose:** ends the session and takes the user directly to that recipe's detail or cooking experience, with immediate access to serving controls, ingredients, instructions, and notes.

If a dedicated Cooking Mode exists by this phase, Recipe Roulette may transition directly into it.

### Alternative controls and accessibility

Swipe gestures must not be the only control. Visible Skip and Choose controls should also exist for desktop users, accessibility, and users who prefer buttons. Keyboard interaction may also be supported.

### Session progress and exhaustion

The interface may show lightweight progress such as `8 recipes remaining` or `Recipe 4 of 12`.

If all eligible recipes are skipped, the user should be able to restart with the same filters, change filters, or return to the recipe library. The application should never automatically select the final recipe merely because all others were skipped.

If filters return zero recipes, the application should explain that no recipes match and allow the user to modify or clear the filters.

### Recipe Roulette acceptance criteria

Phase 4 is functionally complete when:

1. Users can launch Recipe Roulette from the Cookbook.
2. All active recipes are included by default.
3. Users may optionally filter the recipe pool before beginning.
4. Category filtering is supported.
5. Tag filtering is supported.
6. Eligible recipes are randomized for each session.
7. Recipes are presented individually using a visual recipe card.
8. Swiping left skips the current recipe.
9. A skipped recipe does not reappear during the same session.
10. Swiping right selects the current recipe.
11. Selecting a recipe ends the session and navigates to the cooking/detail experience.
12. Visible controls provide alternatives to swipe gestures.
13. The interface handles an exhausted recipe pool.
14. The interface handles filters returning zero recipes.
15. Recipe Roulette works effectively on mobile and desktop.
16. Recipe Roulette does not alter recipe metadata or user preferences unless the user explicitly performs those actions elsewhere.

Recipe Roulette should feel meaningfully different from normal recipe browsing. The normal Cookbook answers, `What recipes do we have?`; Recipe Roulette answers, `We don't know what we want. Help us pick something.`

## 14. Conceptual product entities

The PRD does not define the database schema, but current requirements imply these product concepts:

- **User** — authenticated household member.
- **Recipe** — central shared recipe record.
- **Ingredient** — structured ingredient belonging to a recipe.
- **Instruction** — ordered preparation step.
- **Category** — shared configurable primary classification.
- **Tag** — shared configurable label associated with multiple recipes.
- **Favorite** — relationship between a user and recipe.
- **Rating** — a user's 1–5 star rating for a recipe.
- **Recently Viewed** — user-specific recipe access history.
- **Deleted Recipe** — recoverable recipe state rather than immediate permanent deletion.

Future phases introduce concepts such as meal plans, grocery lists, smart-import drafts, and Recipe Roulette sessions.

These are conceptual product entities only. Their technical implementation belongs in `TECHNICAL_DESIGN.md`.

## 15. Non-functional requirements

### Responsive design

All primary functionality must work on desktop, tablet, and mobile. Mobile usability is particularly important for recipe viewing while cooking and grocery-list use while shopping.

### Performance

For the expected household-scale dataset, recipe browsing, filtering, and searching should feel immediate.

### Accessibility

UI components should follow reasonable accessibility practices, including keyboard usability where appropriate, visible focus states, adequate contrast, semantic controls, useful image alternative text, and mobile-friendly touch targets.

### Reliability

Recipe data represents long-lived household information. Application design should prioritize safe persistence and recoverability. Backup strategy belongs primarily to the platform/infrastructure layer but should be considered before production deployment.

### Privacy

The Cookbook is a private household application. Recipes, preferences, meal plans, and related user information should not be publicly accessible by default.

## 16. UX success criteria

A successful UX should make these actions feel effortless:

- Browse available meals
- Search for something specific
- Identify recipes visually
- Favorite a recipe
- Rate a meal
- Change serving size
- Understand required ingredients
- Follow cooking instructions
- Add a new recipe
- Return to a recently viewed recipe

The product should minimize unnecessary forms, configuration screens, technical terminology, and administrative interactions.

## 17. Future ideas / backlog

The following are intentionally not commitments:

- Dedicated Cooking Mode enhancements
- Cooking timers
- Step completion while cooking
- Multiple recipe images
- Ingredient substitutions
- Pantry tracking
- Shopping categories such as Produce / Dairy / Meat
- Grocery-list ordering based on store sections
- Recipe recommendation engine
- `What can I cook with what I have?`
- Recipe history
- Last-cooked tracking
- Recipe duplication/forking
- Seasonal collections
- AI-assisted recipe creation
- AI-assisted ingredient normalization
- Unit conversion between metric and imperial measurements
- Integration with external grocery services
- Household dashboard integration
- Nutrition tracking
- Multi-user / matching extensions to Recipe Roulette

## 18. Open product and technical questions

No blocking product questions currently remain for the initial PRD.

Implementation-level decisions should deliberately remain unresolved until technical planning, including:

- Exact domain/database schema
- File/image storage strategy
- Search implementation
- Ingredient unit representation
- Fraction storage and rendering
- Authentication and authorization implementation details
- API boundaries and contracts
- Grocery ingredient normalization strategy
- LLM/provider selection for smart importing
- MCP server architecture and permissions

These decisions should be captured in `TECHNICAL_DESIGN.md` and, where durable architectural rationale matters, in `docs/DECISIONS/`.

## 19. Definition of product success

The initial Cookbook is successful if it becomes easier and more enjoyable for the household to store, discover, and cook its own recipes than using scattered bookmarks, screenshots, notes, and external recipe websites.

The intended progression is:

**Core Cookbook → MCP v1 → Meal Planning & Grocery Lists → Smart Import → Recipe Roulette**

A successful Phase 1 should create a stable structured foundation for later capabilities without requiring the core Cookbook concept to be rebuilt.