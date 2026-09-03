# Development Status

**Last updated:** 2026-08-23
**Current stage:** Phase 1 feature-complete — polish and end-to-end coverage implemented (slice 8); production provisioning outstanding
**Current product phase:** Phase 1 — Core Cookbook

This file records the application's **actual implementation state**.

- [`PRD.md`](./PRD.md) describes the desired product behavior.
- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) describes approved implementation decisions once they are made.
- This file describes what currently exists.

Agents and contributors must not infer that a PRD requirement has been implemented simply because it is documented.

## Current state

The Cookbook scaffold and central SSO integration are implemented and configured to use the hosted issuer. Registering the new shared `localhost:5173` callback in the deployed `service-auth` client remains an external dependency. The product requirements are approved, and the complete Phase 1 technical design and ADRs 0002–0005 are accepted. The pure `@cookbook/domain` package, the normalized recipe database schema, and the first domain migration are implemented (implementation sequence slice 1). Recipe aggregate create, read, and update are implemented behind the authenticated API boundary, with the shared error envelope and API integration tests (slice 2). The primary recipe photo is implemented end to end on the API: authenticated multipart upload, verified decoding, WebP variant generation, authenticated delivery, replacement, deletion, and orphan reconciliation (slice 3). The recipe creation, detail, edit, and serving-scaling screens are implemented on `@pior-labs/design-system` tokens, together with the category/tag read endpoints and the minimal recent-recipe list they depend on (slice 4). Browse/search with cursor pagination, the home discovery response, full category and tag management, and the `/`, `/recipes`, and `/organize` screens are implemented (slice 5). Per-user favorites, 1-5 ratings, and recently viewed history are implemented end to end, including the `/favorites` and `/recent` screens and the favorite and rating browse filters (slice 6). Recoverable deletion is implemented end to end: a recipe moves to Trash without destroying anything, restoration returns it with all of its retained state, and permanent deletion from Trash removes its rows and image files (slice 7). Mobile and accessibility polish and the Playwright critical-path suite are implemented, and the provisioning and restore procedures are documented in [`OPERATIONS.md`](./OPERATIONS.md) (slice 8). Every Phase 1 capability is now implemented and covered by tests. What remains is external and cannot be done from this repository: registering the OAuth client in `service-auth`, provisioning the database, image directory, routes, and DNS in `platform-deploy`, and running the documented restore verification against that environment once it exists.

## Completed

- Repository initialized from the Pior Labs paved-road scaffold.
- Product requirements captured for the Core Cookbook and future phases.
- Phase 1 product requirements approved on 2026-08-17.
- Documentation hierarchy established.
- Existing Pior Labs application/platform conventions available through `AGENTS.md`.
- Generic package, container alias, metadata, environment, and UI placeholders replaced with Cookbook identity.
- Responsive Cookbook application shell built with `@pior-labs/design-system` foundations.
- Hono liveness, metadata, readiness, not-found, and error-handling baseline established.
- PostgreSQL and Drizzle configuration retained with production `DATABASE_URL_FILE` support.
- Generic template database table removed; the first migration contains only the local authentication tables.
- Central `service-auth` OAuth/OIDC integration implemented with PKCE, issuer validation, an app-specific cookie namespace, and an HTTP-only local session; local configuration now targets the hosted issuer.
- Public health/auth routes and a deny-by-default authenticated `/api/*` boundary implemented.
- Responsive login, session restoration, authenticated home, and logout states implemented and exercised locally end to end.
- Authenticated screens carry the same language as *ambient shell, solid content*: the mesh drifts behind every screen (rendered once in `App`, at a lower blob opacity), the topbar is glass over it, page content sits on its own wash, and cards, panels, and fields stay opaque so recipe text is never set over moving colour.
- Bloom / Slate theme picker on the sign-in card and in the topbar, persisted by the design system; component tests mount screens through a theme-aware `render` helper.
- Login and session-restore screens rebuilt to the chosen login concept, "Frosted Recipe Card" ([`design/02-frosted-recipe-card.md`](./design/02-frosted-recipe-card.md)): a ruled recipe card in glass over the design system's drifting mesh, in the same materials as the central `service-auth` sign-in page. The concept gallery now renders the real screen in slot 2, and the template's leftover login palette and dead placeholder styles are gone from `index.css`.
- Static-only web Caddy runtime, private container ports, and health checks confirmed.
- CI configured to install, typecheck, test, and build the pnpm workspace.
- Manual production deployment workflow retained pending external provisioning.
- Pure `@cookbook/domain` package with ingredient fraction parsing/reduction/scaling/formatting, unit registry, name normalization, stable domain types, and request validation schemas, covered by unit tests.
- Normalized recipe domain Drizzle schema (categories, tags, recipes, ingredients, instructions, recipe/tag joins, images, favorites, ratings, recently viewed) with database checks and indexes.
- First domain migration with conflict-safe starter-category seed, applied and verified against the local database.
- Repository foundations: aggregate relations and a shared database-executor seam for transactional writes.
- Shared API error envelope with field-scoped validation messages, plus request-ID structured request and error logging.
- Hono application factory with an injected session resolver, so the deny-by-default `/api/*` boundary is exercised in tests.
- `POST /api/recipes`, `GET /api/recipes/:id`, and `PUT /api/recipes/:id`: one-transaction aggregate writes covering ingredients, instructions, and tag assignments, with server-derived positions, server-derived created-by, and optimistic `version` concurrency.
- API integration tests against a disposable migrated PostgreSQL database, and a CI PostgreSQL service so migrations and integration tests run on every push.
- `PUT /api/recipes/:id/photo`, `GET /api/recipes/:id/photo/:variant`, and `DELETE /api/recipes/:id/photo`: multipart upload validated by decoding rather than by filename or declared type, with byte, dimension, and pixel limits, EXIF orientation applied, metadata stripped, and `card`/`detail` WebP variants generated.
- Opaque generated storage keys, atomic variant writes, and write-new/switch-reference/delete-old replacement ordering, so an interrupted upload always leaves at least one valid image.
- Authenticated image delivery with a content-hash `ETag`, conditional `304` responses, and private cache headers; the web container never mounts the image directory.
- `pnpm images:reconcile` orphan-cleanup maintenance command, reporting by default and removing unreferenced files with `--delete`, and reporting rather than discarding metadata whose files are missing.
- Readiness verifies the configured image directory is writable in addition to the database, and Compose mounts a persistent image directory into the API container only.
- Image integration tests covering validation, replacement, delivery, cleanup, and reconciliation against a disposable temporary directory.
- `GET /api/categories` and `GET /api/tags` with active recipe counts, plus `POST /api/tags` for inline tag creation from the recipe form.
- Client-side routing for `/`, `/recipes`, `/recipes/new`, `/recipes/:id`, `/recipes/:id/edit`, `/favorites`, `/recent`, `/organize`, and `/trash`, mounted only for an authenticated session.
- Typed API client returning the shared error envelope, with field-scoped errors, retry, and abort handling shared by every recipe screen.
- Recipe creation and edit form: structured ingredient and instruction rows with button-based keyboard and touch reordering, unit selection with custom units, inline tag creation, mutually exclusive source fields, and entered values preserved after a failed save.
- Client-side validation reusing the `@cookbook/domain` schemas, so the same rules produce the same field-scoped messages as the API.
- Recipe detail with serving scaling: exact fraction arithmetic, unit labels agreeing with the scaled amount, the base serving count always visible, and one-action reset. Serving changes never touch the saved recipe.
- Photo upload, replacement, and removal wired into the edit flow and offered after a recipe is first saved.
- Optimistic-concurrency conflict handling: a version conflict explains what happened and offers reload or a separate copy without discarding the edit.
- Loading skeletons, empty states, network-error retry, and a browser guard on leaving a dirty form.
- React Testing Library suite covering serving controls and scaled display, form validation and ordered-row editing, accessible labelling, and page-level error and conflict states.
- `GET /api/recipes` browse and search: normalized bounded tokens matched against recipe name, description, ingredient, category, and tag with escaped `ILIKE` and `EXISTS` subqueries, composed with category, match-all tag, favorite, minimum household rating, and maximum total time filters.
- One aggregate query per result page: the household rating and the acting user's favorite/rating are computed in the same statement rather than looked up per row, replacing the per-row lookups of the slice 4 recent list.
- Opaque keyset cursor pagination for all four sorts (`recentlyAdded`, `recentlyUpdated`, `name`, `rating`), each with an `id` tie-breaker, a cursor bound to the sort it was issued for, and a recoverable field-scoped error for a stale or corrupt cursor.
- `GET /api/home`: recently viewed, favorites, highly rated, recently added, and category summaries for the current user in one response.
- `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`, `PUT /api/tags/:id`, and `DELETE /api/tags/:id`, with case-insensitive uniqueness and a category delete blocked by live *and* trashed recipes, each with its own explanation.
- Shared route helpers for ID parameters, JSON bodies, and repeated query parameters, so `tagId=1&tagId=2` reaches the schema as an array instead of losing every value but the first.
- `/` home discovery: recently viewed, favorites, highly rated, and recently added rails plus category shortcuts, with empty sections hidden rather than shown blank.
- `/recipes` browse: debounced search, category, match-all tag, time, and sort controls, all mirrored into the URL so a filtered view is shareable and survives the back button; "load more" appends rather than replaces, and a failed page keeps the results already on screen.
- `/organize` category and tag management: inline rename, create, and confirmed delete, with the in-use conflict explained in the row that caused it and a rejected name left in the box.
- Shared application shell with section navigation, and one recipe card used by every list.
- API integration tests for search, filters, all four sorts, full cursor walks, and home sections; React Testing Library coverage for the discovery and organize screens.
- `POST /api/recipes/:id/view`, `PUT`/`DELETE /api/recipes/:id/favorite`, and `PUT`/`DELETE /api/recipes/:id/rating`: per-user state keyed by the session user, idempotent in both directions, refused for a recipe in Trash, and each answering with the resulting user state and household rating in one transaction.
- `GET /api/recent`: the acting user's recently viewed recipes, ordered by view time and capped by `limit`, documented in technical design section 7.2 as deliberately cursor-free.
- Recently viewed is one row per person per recipe: re-opening a recipe moves it back to the top rather than lengthening the list, and the timestamp comes from the database rather than a client clock.
- Favorite and rating controls on recipe detail and on every recipe card, optimistic per section 11.3: the control flips immediately, a failure restores the previous value and announces why, and the household average always comes from the server rather than being predicted.
- View recording fires once a recipe detail has loaded and stays silent on failure; a recipe that failed to load is never recorded as opened.
- `/favorites` and `/recent` screens with their own empty states, plus favorite and minimum-household-rating filters in browse and "see all" links from the home rails.
- Shared cursor-pagination hook and result renderer behind browse and favorites, so both page, count, empty out, and recover from a failed "load more" identically.
- API integration tests for favorites, ratings, view recording, and recent history including per-user isolation and Trash exclusion; React Testing Library coverage for the optimistic flip, the revert-and-announce path, and both per-user screens.
- `DELETE /api/recipes/:id`, `GET /api/trash`, `POST /api/trash/:id/restore`, and `DELETE /api/trash/:id`: soft deletion records who deleted the recipe and removes no rows or image files, restoration clears only the deletion metadata, and permanent deletion is reachable only for a recipe already in Trash.
- A separate Trash repository path scoped to deleted recipes, so the active and deleted scopes stay visible in review rather than depending on a hidden default condition.
- Permanent deletion removes every dependent row through the schema's cascades in one transaction and deletes the image folder only after that has committed, so a failed cleanup leaves an orphan for `pnpm images:reconcile` rather than a recipe pointing at nothing.
- One shared opaque keyset cursor behind browse and Trash, bound to the ordering it was issued for, so a browse cursor pasted into Trash is a recoverable field-scoped error rather than a wrong page.
- `/trash` screen: restore in one press, permanent deletion gated on typing the recipe name, per-row failure messages, and its own empty state; `Move to Trash` on recipe detail confirms in place and then follows the recipe to Trash.
- One shared cursor-pagination hook behind browse, favorites, and Trash, so all three page, extend, and recover from a failed "load more" identically.
- API integration tests for soft deletion, Trash listing and pagination, restoration with favorites/ratings/history/tags intact, permanent deletion of rows and image files, and the category that a trashed recipe keeps blocked; React Testing Library coverage for restore, the typed-name confirmation, and the recipe-detail delete flow.
- Playwright critical-path suite in `@cookbook/e2e`: create and view a recipe, scale its servings and prove the saved recipe is untouched, edit it, find it by ingredient, favorite and rate it as one cook without affecting another, and move it to Trash and restore it - plus the skip-link focus order.
- End-to-end API harness (`packages/api/test/e2e-server.ts`): the real application against a real migrated disposable database, with the central-SSO session replaced by a cookie the test sets. It lives in `test/`, which the build excludes.
- A second CI job runs the browser suite against a PostgreSQL service container and uploads the Playwright report when it fails.
- Fixed a bug the browser suite caught immediately: the web app posted the *parsed* recipe body, so every recipe saved with an ingredient quantity was rejected by the API. Request and parsed types are now distinct in `@cookbook/domain`, and the client sends what it validated.
- Accessibility pass: arrow-key and Home/End selection in the rating radio group with focus following the choice, `aria-required` on every required control, a skip link past the eight-item topbar, and a readable colour for the chosen rating, which was previously near-invisible against the card.
- Mobile pass: the section navigation is one scrollable strip instead of two wrapped rows, photo-less recipe cards no longer reserve a screen of blank space, small controls take a full 44px target on touch devices, and button labels no longer wrap mid-word.
- Browse filters open on request rather than standing open: the panel is a toolbar (search, sort, and a Filters control carrying the count applied) over a line of chips naming every narrowing in force, with the filters themselves inline on a wide screen and a sheet over the page on a phone, where they had been the entire first screen.
- Tag colours: a tag can be given a colour (`tags.color`, migration `0002`, nullable so "no colour" stays the ordinary state) - one of seven palette swatches or any six-digit hex typed into the box beside them - set from `/organize`, where a colour or a rename is written into the row it changed rather than by refetching the list, and rendered wherever a tag appears - the browse filters, the recipe form, and the recipe itself - by mixing the tag's hex against the active theme's ink and surface rather than painting it flat.
- `docs/OPERATIONS.md`: provisioning checklist for `service-auth`, `platform-deploy`, and this repository; the database-and-images backup set; the restore procedure with its reconciliation and image-read verification; and routine maintenance.

## In progress

- Nothing in this repository. Phase 1 is feature-complete; the remaining work is
  external provisioning, listed under **Next**.

## Next

1. Register the shared `localhost:5173` callback and reseed the `cookbook` client in the production `service-auth` environment.
2. Provision the Cookbook database, persistent image directory (`PLATFORM_IMAGE_STORAGE_DIR`), routes, DNS, and connection file in `platform-deploy`.
3. Run the documented restore verification (`OPERATIONS.md` section 4) against the provisioned environment, then enable the deployment workflow's push trigger.
4. Once Phase 1 is deployed and stable, begin MCP v1.

## Phase 1 — Core Cookbook

**Status:** Feature-complete — every listed capability is implemented and tested; production provisioning is the only outstanding work

Planned scope includes:

- Recipe CRUD
- One primary recipe photo
- Descriptions and optional source attribution
- Structured ingredients and serving scaling
- Ordered instructions and notes
- Prep/cook time
- Categories and custom tags
- Search and filtering
- Per-user favorites
- Per-user 1–5 star ratings
- Per-user recently viewed history
- Created-by metadata
- Recoverable deletion
- Responsive consumer-quality UI/UX
- Integration with existing Pior Labs authentication

### Phase 1.x candidate

- Dedicated Cooking Mode

Cooking Mode is desirable but is not required for the initial Phase 1 release.

## MCP v1

**Status:** Not started  
**Timing:** After Phase 1

MCP should begin once the Phase 1 recipe model and API are stable. Initial read-oriented capabilities are expected to cover recipe search, retrieval, favorites, ratings/tags, and serving scaling.

## Phase 2 — Meal Planning and Grocery Lists

**Status:** Future / not started

## Phase 3 — Smart Recipe Import

**Status:** Future / not started

## Phase 4 — Recipe Roulette

**Status:** Future / not started

## Deferred / backlog

See the PRD for the full backlog. Notable deferred ideas include:

- Nutrition tracking
- Pantry tracking
- Multiple recipe images
- Last-cooked history
- AI-assisted recipe creation
- Grocery-service integrations
- Expanded Cooking Mode features

## Updating this file

Update `STATUS.md` when a meaningful product capability changes state, a phase begins or completes, or an explicitly planned item is deferred.

Do not use this file as a changelog for every commit.
