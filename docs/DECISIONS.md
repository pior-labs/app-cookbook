# Decisions

Durable technical decisions and the reasoning behind them.

This file exists for one reason: **code documents what it does, but it can never
document what it deliberately does not do.** An absent feature has no file to
comment. Without a record, the next person to look re-derives the question from
scratch and often answers it differently.

So the test for whether something belongs here is not "is this important?" It is
**"would reading the code recover this?"** If yes, it belongs in a comment next
to the code, not here. Schema shapes, endpoint contracts, and tool inventories
are not decisions; they are the code, and they drift the moment they are copied.

Entries keep their original numbers. Code comments cite them as `ADR 0004`, and
those citations should keep resolving.

---

## 0001 - Central SSO with application-local sessions

**Accepted 2026-08-16.**

Cookbook is a confidential OAuth/OIDC client of `service-auth` (authorization
code with PKCE). Better Auth handles the callback and stores an HTTP-only
session in PostgreSQL. There is no local password, signup, or second identity
provider, and there must not be one.

Domain tables reference the local `users.id`, not an email address and not the
central subject. Identity is centralized; referential integrity is local. That
split is what lets favorites and ratings survive a change of email address.

**Why the session is local and same-origin:** the central access and refresh
tokens never reach the Vite application, so a frontend bug cannot leak them.

**The cookie prefix is `cookbook`, and this is not cosmetic.** Localhost cookies
are not isolated by port, so every Pior Labs application sharing `localhost`
needs a distinct Better Auth prefix or they overwrite each other's sessions
during development. Local development uses the hosted issuer, not a local one.

**Consequences worth knowing before touching auth:**

- Removing a household identity centrally prevents future sign-in but leaves
  existing Cookbook sessions valid until they expire or are revoked locally.
- The API database holds session and OAuth token material, so it is sensitive
  beyond the recipes in it.

---

## 0002 - Exact ingredient quantities with application units

**Accepted 2026-08-17.**

Quantities are a reduced numerator/denominator integer pair. Known units are
text codes from a versioned TypeScript registry; custom household units
(`clove`, `can`, `pinch`) are a separate normalized text label, mutually
exclusive with the code.

**Why not floats:** scaling is `quantity x requested / base`, and a third of a
cup has to survive that exactly. Floating point accumulates drift, and grocery
aggregation will later add these numbers across recipes, which compounds it.

**Why not formatted strings:** `"1 1/2"` cannot be multiplied.

**Why a text registry rather than a PostgreSQL enum:** adding a unit is a normal
product change. Behind an enum it becomes a database migration.

**What was deliberately not built:** Phase 1 performs no unit conversion at all.
The saved unit is preserved as written. Conversion is a Phase 2 concern
(see 0007).

---

## 0003 - Authenticated local recipe image storage

**Accepted 2026-08-17.**

Processed images live in an app-owned directory mounted only into the API
container; metadata lives in PostgreSQL. Uploads are decoded and verified,
bounded by bytes and dimensions, stripped of metadata, and written as `card` and
`detail` WebP variants under opaque generated keys.

**Why not object storage:** it introduces a second service and an operational
boundary owned by someone else, for a household-scale collection. The recipe API
semantics do not depend on the storage backend, so moving later is an adapter
and a migration, not a redesign.

**Why images are served through authenticated API endpoints rather than
statically:** static delivery would route around the authorization boundary. A
private recipe collection with publicly guessable photo URLs is not private.

**Why orphan reconciliation has to exist:** the filesystem and the database
cannot share a transaction. Write ordering favours recoverability instead -
replacement writes the new file before switching the database reference, and
permanent deletion commits the row removal before best-effort file cleanup. Both
orderings leak files rather than lose them, which is why a reconciler is
required rather than optional.

**Backups are one set.** PostgreSQL and the image directory must be captured
together or a restore produces recipes with missing photos.

---

## 0004 - Household-scale relational search

**Accepted 2026-08-17.**

Search is parameterized SQL over the normalized relational model: bounded
normalized tokens, every token required to match at least one searchable field,
escaped case-insensitive predicates, `EXISTS` subqueries for ingredients and
tags. Soft-deleted recipes are excluded from every normal path.

**This entry exists to record what is absent.** There is no `pg_trgm`, no
PostgreSQL full-text search, no denormalized search document, and no search
service. That is a deliberate choice, not an oversight, and it should not be
"fixed" without a measurement showing real latency on a real collection.

The reasoning: the dataset is a household's recipes. Every alternative adds
write coordination or deployment surface to beat a query that is already fast at
this size. The HTTP contract is kept independent of the implementation
specifically so this can be revisited without changing callers.

**Known and accepted:** leading-wildcard searches will not use B-tree indexes
efficiently, and relevance ranking is intentionally naive.

---

## 0005 - Recoverable recipe deletion

**Accepted 2026-08-17.**

Deleting sets `deleted_at` and `deleted_by_user_id` and destroys nothing.
Ingredients, instructions, tags, images, favorites, ratings, and history all
stay, so restoring returns the recipe the cook had rather than a reconstruction
of it. Permanent deletion is available only from Trash, after typing the recipe
name.

**Why Trash has its own repository methods instead of a default `WHERE
deleted_at IS NULL` filter:** a hidden default is easy for a future repository
to forget, and forgetting it silently exposes deleted recipes. Separate explicit
paths make the deletion scope visible in review. Every active query must go
through the active path.

**Why categories and tags behave differently:** a category referenced by a
trashed recipe cannot be deleted, because restoring would produce a recipe with
no category. Tags can be deleted, because losing a tag association does not
invalidate a recipe. The asymmetry is deliberate.

**What is absent:** no automatic retention policy. Trash keeps rows and files
until somebody acts. Adding expiry is a product decision.

---

## 0006 - A read-only stdio MCP server with a configured acting user

**Accepted 2026-09-04. Amended 2026-09-09 (lifecycle), 2026-09-15 (planning writes; ADR 0008).**

The MCP server is stdio, calls the API's application services directly rather
than issuing SQL or going back through HTTP, and acts as exactly one household
member resolved from `COOKBOOK_MCP_USER_EMAIL` at startup.

**Identity as configuration is the load-bearing decision.** If the acting user
were a tool argument, the model would be choosing whose favorites to read, and
"what are my favorites?" becomes a guess that can silently return the other
household member's preferences. Because identity is resolved before any tool
runs, a per-user tool has exactly one possible subject. This is why each member
runs their own container rather than sharing one.

**Recipe read-only access is enforced structurally, not by convention.**
MCP v1 exported only readers. Phase 2 deliberately adds planning and grocery
mutations to the service surface, contract tests, and smoke-check allowlist.
Recipe, favorite, and rating mutations remain excluded. The acting-user and
stdio decisions continue to apply.

**View recording is excluded on purpose.** Asking an assistant about a recipe is
not the same act as opening it, and it must not reorder what `/recent` shows.

**Why stdio over Streamable HTTP with OAuth:** HTTP is the right answer for a
multi-user or remote server. Here it would mean an OAuth client, a route, DNS,
and a public surface, to serve two people on one host. stdio needs none of it.

**Why the container's main process is `sleep infinity`:** clients `docker exec`
into the container, so each session gets its own process and the main process
serves nobody. Running a real server there would hold a Postgres connection open
for no one, and - because a stdio server must exit when its client closes stdin
- would stop the whole container the moment anything closed the container's own
stdin. Health is therefore "could an exec'd session work" (database reachable,
configured user resolves), not "is the process running".

**A stdio server must exit when stdin closes**, and the SDK's
`StdioServerTransport` does not do this: it listens only for `data` and `error`,
never `end` or `close`. Without an explicit handler the process sits on an idle
transport holding a database connection, forever, inside a container that stays
up by design. This was a real leak found in production, not a theoretical one.
Shutdown drains in-flight work first, or it cuts off a reply the client is still
waiting for. See `packages/mcp-server/src/inflight.ts`.

---

## 0007 - No canonical ingredient identity for grocery aggregation

**Decided 2026-09-07. Amended 2026-09-15 by ADR 0008 for LLM semantics.**

Grocery aggregation combines ingredients using identities computed at generation
time. The grocery snapshot retains display names and provenance, but there is
no global canonical ingredient entity or learned alias table.

**Why this is written down before it is built:** it records a decision *not* to
build the thing that looks most obviously correct. Without this, canonical
ingredient identity gets proposed again, with the same reasoning, in six months.

**The evidence.** Every ingredient appearing in more than one of the ten seeded
recipes:

| Ingredient | Units seen across recipes | What it needs |
| --- | --- | --- |
| `all-purpose flour` | cup, cup | nothing, works today |
| `baking powder` | tsp, tsp | nothing, works today |
| `granulated sugar` | cup x3, tbsp | same-dimension conversion |
| `olive oil` | cup x2, tbsp | same-dimension conversion |
| `butter` | cup, tbsp x2 | same-dimension conversion |
| `kosher salt` | tbsp x2, tsp, none x2 | conversion, plus a rule for unmeasured |
| `eggs` | none x3, `large` | custom unit vs no unit |

Plus one near-miss that does not collide at all, because the names differ:
`garlic clove` in one recipe and `garlic cloves` in another.

Three things follow. **Density conversion never appears** - not one ingredient
is written in cups in one recipe and grams in another, because people write
recipes in one idiom. It was assumed to be the hard part and it is not in the
data. **The real gaps are small:** singular/plural, and conversion within a
dimension. **The garlic case is the encouraging one** precisely because it
appeared without anyone trying to construct a collision.

Caveat: ten recipes, seeded by one person in one sitting. Suggestive, not proof.
A year of real entry from mixed sources will be messier.

**The governing principle: prefer under-merging to over-merging.** A missed
merge is visible - two garlic lines on the list, noticed while shopping, costing
one edit. A wrong merge is invisible - one line with the wrong quantity,
discovered mid-recipe, costing a trip to the shop. Generated lists are editable,
which is the safety net. So combine only where confident and never guess.

**Do not teach `normalizeName` about plurals.** It is shared by categories,
tags, ingredients, and search, and it backs the unique indexes on
`categories.normalized_name` and `tags.normalized_name`. Make it plural-aware
and `Snack` and `Snacks` become the same tag, requiring a backfill of every
`normalized_name` column and risking unique-constraint violations on data that
is currently legal. Use a separate ingredient-only aggregation key instead.

**Consequence: Phase 2 needs no change to the recipe schema.** No migration on
`recipe_ingredients`, no backfill, no risk to Phase 1 data. Only new tables.

**Rejected alternatives.** A canonical ingredient entity is the most correct
long-term answer and was rejected for now because it is a migration, a curation
UI, and a backfill before a single grocery list works. A learned alias table -
remembering merges made by hand - is deferred as scope rather than rejected on
merit, and is the natural second step if normalization alone proves too blunt.
Density conversion (`1 cup flour` to grams) is the one to stay away from: it
needs per-ingredient data and is the most likely to produce a confidently wrong
number.

---

## 0008 - Semantic AI, deterministic quantities, shared planning services

**Accepted 2026-09-15. Amended 2026-09-23 by ADR 0010 for regeneration.**

The narrow seed-data evidence in ADR 0007 is not grounds to replace the Phase 2
LLM requirement with string matching. Semantic normalization and guided meal
recommendations are intentional engineering capabilities. A deterministic-only
implementation, or an AI interface without a working provider, was rejected.

OpenAI Responses structured output is the initial provider boundary. The model
is deployment configuration, not a baked-in assertion about price or quality.
An application-local adapter is sufficient for two bounded tasks; no platform
AI gateway, vector database, background worker, or general chat UI is introduced.
Recipe text is data, not instructions, and the provider gets no mutation tools.
Arithmetic, availability checks, serving validation, and persistence stay in
application code. Provider failures and invalid output yield conservative,
visible fallbacks.

**Model confidence is not a calibrated probability.** Reviewed equivalence
families covered by evaluation examples can be automatically merged only when
the LLM agrees with high confidence. Other semantic groupings require review,
even when the model claims certainty. These families are not applied during
fallback. This deliberately trades missed automatic merges for avoiding silent
false totals until live evaluation warrants a broader policy. The evaluation
includes negative examples and reports proposed and automatic decisions
separately; fixture tests do not establish live model quality.

**No inferred regional measurement convention.** Existing recipes do not say
whether a cup is US customary, metric, or imperial. Spoon units convert within
their family, metric units within theirs, and pounds/ounces within theirs;
cross-family volume conversions and density conversions are deferred. This
keeps an unknown cup definition from silently changing the shopping quantity.

Plans and lists are shared household artifacts with explicit creator/editor
attribution. Per-user ownership was rejected because one member should be able
to finish the other's shopping. Favorites and ratings keep their existing scope.
MCP uses those same services and the configured household identity from ADR 0006;
it gains no recipe-editing authority and no second authentication mechanism.

Regeneration creates another snapshot. Destructively rebuilding the current
list would erase manual shopping edits and is therefore rejected. Model calls
run outside database transactions; plan and recipe versions are rechecked before
saving so a slow recommendation/normalization cannot silently save stale work.

Guided suggestions retrieve existing recipes through the current discovery
service. The first 100 matching candidates bound latency and model context;
the UI discloses truncation. "Recently used" means recipes in the last five
updated meal plans, not recipe views or an invented cooking-history signal.
Free-text preferences are not claimed to be satisfied during deterministic
fallback. A proposal is explicitly reviewed before replacing meals, with recipe
availability validated again at acceptance.

---

## 0009 - Meal plans are deleted outright, and take their grocery lists

**Accepted 2026-09-23.**

Deleting a meal plan destroys it, its meals, and every grocery list generated
from it. There is no Trash for plans and no restore.

**Why this does not follow ADR 0005.** A recipe is written once, by hand, and
cannot be reproduced from anything the application still holds - so recipe
deletion is recoverable. A meal plan is a name, an ordered set of recipe
pointers, and a serving count per pointer. Rebuilding one takes the minute it
took to build the first time, and the recipes it pointed at are untouched.
Recoverable plan deletion was rejected: it would mean a second Trash concept,
a restore path, and a soft-deleted state threaded through every planning query,
to protect something that costs a minute to recreate.

**Why the grocery lists go too, when ADR 0008 protects them.** ADR 0008 made
`grocery_lists.meal_plan_id` `restrict` so a list's manual shopping edits could
never be destroyed as a *side effect* of a plan operation - regeneration
snapshots rather than rebuilds for the same reason. Deleting the plan is not a
side effect; it is someone saying the whole plan is finished with. The
constraint stays `restrict` rather than becoming `cascade`, and the service
deletes the lists explicitly and first. That keeps the database refusing any
future path that has not deliberately decided what happens to the lists, and
the confirmation names how many lists will go before they go.

**What is absent:** no bulk delete and no automatic expiry of stale plans. Both
are product decisions, and neither is needed to clear out a plan by hand.

---

## 0010 - One grocery list per meal plan, carried forward on rebuild

**Accepted 2026-09-23. Amends the regeneration paragraph of ADR 0008.**

A meal plan is something finished, not edited forever. It is a `draft` while
its meals are open, `confirmed` once saved, and `done` when the week is over.
Saving is what builds the plan's one grocery list. Before this, a plan could be
edited indefinitely and every "Generate grocery list" added another snapshot,
so a plan collected "Latest list", "Earlier list 2", and nothing said which
list matched which version of the plan.

**Why ADR 0008 kept every snapshot, and why that is no longer needed.** ADR 0008
rejected rebuilding a list because it would erase manual shopping edits, so
regeneration made a new snapshot beside the old one. The edits were what needed
protecting, not the snapshots. Saving a reopened plan now rebuilds the one list
in place and carries the edits forward. What the person did to the list
survives, and there is only ever one list.

**What is carried forward, and how it is recognised.**

| What they did | On rebuild |
| --- | --- |
| Added an item by hand | Kept exactly as it was, ticked or not. |
| Ticked an item | Stays ticked if everything the meals now need was already ticked. If the meals now need more, it is unticked and says so. |
| Edited a generated item | Kept if the meals need exactly what they needed. Otherwise the new amount wins, and it says so. |
| Removed a generated item | Stays removed if the meals need exactly what they needed. Otherwise it comes back, and says so. |
| Accepted or rejected a merge | Applied again when the same ingredients meet, so it is not asked twice. |

A generated item is recognised across a rebuild by its *sources*, which meal and
which ingredient, never by its name, because a person can rename an item and
cannot change where it came from. A merge decision is recognised by the
*ingredient names that met*, because "green onion" meeting "scallion" is the
same question whichever meals brought them. "What the meals need" is the
item's sources with their amounts. Comparing that is what lets a rebuild tell
an edit worth keeping from an edit the new plan made wrong.

The rule that shaped the tick behaviour: carrying a tick forward on an item
whose amount grew would mean never buying the difference. So a tick carries
only when the new need is covered by what was ticked, which also covers the
common case of removing a meal, where shared ingredients need less.

Merge decisions and removals are stored on the list as they happen, in
`merge_decisions` and `dismissed`, because a rejected merge and a removed item
leave nothing behind for a rebuild to read.

**The lock is in the service, not the UI.** MCP calls the same planning services
as HTTP and has no UI to hide a button in. Meals change only in `draft`. A
list can be edited while its plan is `confirmed` or `draft`: one person may
reopen the plan while another is standing in the shop, so the list stays
usable, and anything ticked meanwhile is read under lock at save time and
carried forward. Nothing edits a `done` plan or its list until it is moved back.

**No transition asks for confirmation.** Each one is reversible and loses
nothing: reopening keeps the list and carries its edits forward, and done can
be undone. Only deletion (ADR 0009) asks.

**Migrating existing plans.** A plan that had several snapshots kept its newest,
the one "Latest list" pointed at, and became `confirmed`, since it had been
shopped from. Its older snapshots were deleted. A plan with no list stayed a
`draft`. `grocery_lists.meal_plan_id` is now unique, and the `restrict` foreign
key from ADR 0009 stays.

**What is absent:** no history of past versions of a list, and no way to see a
list as it was before a rebuild. The flags on changed items say what moved;
keeping every version would bring back the snapshot pile this replaced.

---

## 0011 - Meal planning stays ad-hoc, and rich planning belongs to the chatbot

**Accepted 2026-09-23. Recorded when the Phase 2 brief was retired.**

Meal planning is deliberately ad-hoc: choose a few meals, set servings, save,
shop. It is not calendar-driven and does not assume weekly use.

**Rejected for Phase 2, and not built:** recurring weekly scheduling, calendar
synchronization, pantry inventory, expiration tracking, grocery-store
integrations, grocery pricing, automated purchasing, nutrition tracking, and a
complete global ingredient taxonomy (ADR 0007 covers the last). Some of these
are product ideas for later and are listed in `docs/IDEAS.md`; none of them is
missing by accident.

**Two kinds of recommendation, one set of capabilities.** Cookbook offers a
bounded guided flow, Help me choose, over its own recipes. Richer free-form
planning ("five dinners for two, mostly under 45 minutes, chicken at most
twice") belongs to the separate Pior Labs chatbot, which reasons over recipes
through MCP and uses the same planning services the UI does: it searches and
reads recipes, creates a plan, adds meals, and saves the plan to build its
grocery list. Cookbook does not embed a second, general-purpose chatbot for
meal planning; ADR 0008 already rules out a general chat UI in the app.

---

## 0012 - Recipe import previews do not write; MCP creation requires approval

**Accepted 2026-09-24.**

Import supports public recipe links, one screenshot, and recipe text through
MCP. A model may extract a plausible but wrong amount, so extraction never
creates a recipe or feeds a grocery list. The cook reviews the draft and saves
through the ordinary recipe validation and creation service. Missing amounts
stay absent; original ingredient wording stays alongside the structured fields
so later corrections have evidence. Previews are transient: no draft table or
source screenshot storage is needed for a single review session.

This deliberately extends the recipe read-only boundary of ADR 0006 with
`create_recipe`, not recipe update or deletion. MCP presents the draft and
warnings and waits for explicit approval; the creation tool requires a separate
confirmation argument and always attributes the write to its configured member.
The server cannot independently verify a conversation in a third-party client;
the client must honor the review/approval instruction. Page content is data,
never authorization. No MCP image transport is offered until a chosen client can
reliably pass an image or authenticated upload reference.

The web review imports a page photo automatically when possible, as requested,
and lets the cook remove it before saving. Photo failure does not lose the
recipe. Screenshots are extraction inputs, not recipe photos. MCP previews omit
photo bytes to keep tool results bounded; photo attachment uses the web flow.

Not built: bulk imports, video/social extraction, paywall or bot-challenge
bypasses, recipe rewriting, nutrition estimation, and automatic placement into a
meal plan. These would broaden the meaning of import beyond faithful extraction
and review. No new auth service, browser automation, vector database or model
runtime is needed.
