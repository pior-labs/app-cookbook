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

**Accepted 2026-09-04. Amended 2026-09-09 (lifecycle).**

The MCP server is stdio, calls the API's application services directly rather
than issuing SQL or going back through HTTP, and acts as exactly one household
member resolved from `COOKBOOK_MCP_USER_EMAIL` at startup.

**Identity as configuration is the load-bearing decision.** If the acting user
were a tool argument, the model would be choosing whose favorites to read, and
"what are my favorites?" becomes a guess that can silently return the other
household member's preferences. Because identity is resolved before any tool
runs, a per-user tool has exactly one possible subject. This is why each member
runs their own container rather than sharing one.

**Read-only is enforced structurally, not by convention.**
`packages/api/src/services/index.ts` re-exports only readers, so a write tool
fails to resolve its import rather than reaching the household's recipes. The
contract test and the smoke check both assert it independently. Anyone adding
writes must change all three deliberately (see 0007).

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

**Decided 2026-09-07. Not yet implemented.**

Grocery aggregation will combine ingredients on a normalization key computed at
generation time and never stored. There will be no canonical ingredient entity
and no learned alias table.

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
