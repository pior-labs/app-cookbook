# Development Status

**Last updated:** 2026-08-22
**Current stage:** Phase 1 in progress — recipe aggregate API implemented (slice 2)
**Current product phase:** Phase 1 — Core Cookbook

This file records the application's **actual implementation state**.

- [`PRD.md`](./PRD.md) describes the desired product behavior.
- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) describes approved implementation decisions once they are made.
- This file describes what currently exists.

Agents and contributors must not infer that a PRD requirement has been implemented simply because it is documented.

## Current state

The Cookbook scaffold and local central SSO flow are implemented. The product requirements are approved, and the complete Phase 1 technical design and ADRs 0002–0005 are accepted. The pure `@cookbook/domain` package, the normalized recipe database schema, and the first domain migration are implemented (implementation sequence slice 1). Recipe aggregate create, read, and update are implemented behind the authenticated API boundary, with the shared error envelope and API integration tests (slice 2). Recipe images, browse/search, per-user preferences, Trash, and the product UI have not been implemented.

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
- Central `service-auth` OAuth/OIDC integration implemented with PKCE, issuer validation, and an HTTP-only local session.
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

## In progress

- Phase 1 slice 3: authenticated recipe image upload, transformation, delivery, replacement, and cleanup.

## Next

1. Confirm the `cookbook` client is seeded in the production `service-auth` environment.
2. Provision the Cookbook database, image storage, routes, DNS, and connection file in `platform-deploy`.
3. Continue Phase 1 in the documented vertical slices (recipe CRUD, images, UI, discovery, preferences, Trash, polish).

## Phase 1 — Core Cookbook

**Status:** In progress — authentication foundation and recipe aggregate API complete

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
