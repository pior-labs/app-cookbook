# Development Status

**Last updated:** 2026-08-16
**Current stage:** Phase 1 foundation / authentication integrated
**Current product phase:** Phase 1 — Core Cookbook

This file records the application's **actual implementation state**.

- [`PRD.md`](./PRD.md) describes the desired product behavior.
- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) describes approved implementation decisions once they are made.
- This file describes what currently exists.

Agents and contributors must not infer that a PRD requirement has been implemented simply because it is documented.

## Current state

The generic web application template has been initialized as Pior Labs Cookbook. The repository has a Cookbook-specific application shell, operational baseline, and working local central SSO flow. The Cookbook recipe domain model and product features have not been implemented.

## Completed

- Repository initialized from the Pior Labs paved-road scaffold.
- Product requirements captured for the Core Cookbook and future phases.
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
- CI configured to install, typecheck, and build the pnpm workspace.
- Manual production deployment workflow retained pending external provisioning.

## In progress

- Reviewing and approving the remaining Phase 1 recipe-domain technical design.

## Next

Before substantial Cookbook feature implementation:

1. Review and approve `docs/PRD.md` as the product source of truth.
2. Complete `docs/TECHNICAL_DESIGN.md` for the Phase 1 recipe domain model.
3. Register and seed the `cookbook` trusted OAuth client in the production `service-auth` environment.
4. Provision the Cookbook database, routes, DNS, and connection file in `platform-deploy`.
5. Record important architectural decisions in `docs/DECISIONS/` as needed.
6. Break Phase 1 into implementation epics/issues or incremental PRs.
7. Implement Phase 1 only unless scope is explicitly changed.

## Phase 1 — Core Cookbook

**Status:** In progress — authentication foundation complete

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
