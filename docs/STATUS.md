# Development Status

**Last updated:** 2026-08-22
**Current stage:** Phase 1 in progress — recipe creation, detail, edit, and serving-scaling UI implemented (slice 4)
**Current product phase:** Phase 1 — Core Cookbook

This file records the application's **actual implementation state**.

- [`PRD.md`](./PRD.md) describes the desired product behavior.
- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) describes approved implementation decisions once they are made.
- This file describes what currently exists.

Agents and contributors must not infer that a PRD requirement has been implemented simply because it is documented.

## Current state

The Cookbook scaffold and central SSO integration are implemented and configured to use the hosted issuer. Registering the new shared `localhost:5173` callback in the deployed `service-auth` client remains an external dependency. The product requirements are approved, and the complete Phase 1 technical design and ADRs 0002–0005 are accepted. The pure `@cookbook/domain` package, the normalized recipe database schema, and the first domain migration are implemented (implementation sequence slice 1). Recipe aggregate create, read, and update are implemented behind the authenticated API boundary, with the shared error envelope and API integration tests (slice 2). The primary recipe photo is implemented end to end on the API: authenticated multipart upload, verified decoding, WebP variant generation, authenticated delivery, replacement, deletion, and orphan reconciliation (slice 3). The recipe creation, detail, edit, and serving-scaling screens are implemented on `@pior-labs/design-system` tokens, together with the category/tag read endpoints and the minimal recent-recipe list they depend on (slice 4). Browse/search, home discovery, per-user preferences, and Trash have not been implemented.

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
- `GET /api/recipes` limited to recent recipes: `sort` and `limit` only, rejecting search and filter parameters rather than silently returning an unfiltered list.
- Client-side routing for `/`, `/recipes/new`, `/recipes/:id`, and `/recipes/:id/edit`, mounted only for an authenticated session.
- Typed API client returning the shared error envelope, with field-scoped errors, retry, and abort handling shared by every recipe screen.
- Recipe creation and edit form: structured ingredient and instruction rows with button-based keyboard and touch reordering, unit selection with custom units, inline tag creation, mutually exclusive source fields, and entered values preserved after a failed save.
- Client-side validation reusing the `@cookbook/domain` schemas, so the same rules produce the same field-scoped messages as the API.
- Recipe detail with serving scaling: exact fraction arithmetic, unit labels agreeing with the scaled amount, the base serving count always visible, and one-action reset. Serving changes never touch the saved recipe.
- Photo upload, replacement, and removal wired into the edit flow and offered after a recipe is first saved.
- Optimistic-concurrency conflict handling: a version conflict explains what happened and offers reload or a separate copy without discarding the edit.
- Loading skeletons, empty states, network-error retry, and a browser guard on leaving a dirty form.
- React Testing Library suite covering serving controls and scaled display, form validation and ordered-row editing, accessible labelling, and page-level error and conflict states.

## In progress

- Phase 1 slice 5: browse, search, filtering, home discovery, and category/tag management.

## Next

1. Register the shared `localhost:5173` callback and reseed the `cookbook` client in the production `service-auth` environment.
2. Provision the Cookbook database, persistent image directory (`PLATFORM_IMAGE_STORAGE_DIR`), routes, DNS, and connection file in `platform-deploy`.
3. Continue Phase 1 in the documented vertical slices (discovery, preferences, Trash, polish).

## Phase 1 — Core Cookbook

**Status:** In progress — authentication foundation, recipe aggregate API, image pipeline, and recipe UI complete

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
