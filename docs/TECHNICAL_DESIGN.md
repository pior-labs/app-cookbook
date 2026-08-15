# Technical Design

**Status:** Not yet approved  
**Current product scope:** Phase 1 — Core Cookbook

This document is the technical counterpart to [`PRD.md`](./PRD.md). The PRD defines **what** the Cookbook should do; this document will define **how** the application implements those requirements.

Do not treat unresolved sections in this file as permission to invent architecture during unrelated implementation work. Architectural decisions should be made deliberately, documented here, and recorded in `docs/DECISIONS/` when the rationale should survive future refactors.

## Existing Pior Labs paved road

Unless the Cookbook has a concrete reason to deviate, follow the repository and platform conventions documented in the root `AGENTS.md`:

- TypeScript
- React + Vite
- Hono
- PostgreSQL + Drizzle
- pnpm
- Docker Compose
- GitHub Actions
- `@pior-labs/design-system`
- `service-auth` for OAuth/OIDC
- Platform Caddy for production routing and TLS

These are platform defaults, not a substitute for the Cookbook-specific design work below.

## Established scaffold baseline

The initialization scaffold establishes only the following app-owned implementation details:

- The pnpm workspace contains `@cookbook/web` and `@cookbook/api` packages.
- The web package is a React/Vite SPA using `@pior-labs/design-system` and a responsive Cookbook shell.
- Local development uses `http://localhost:5175` for the web app and `http://localhost:3002` for the API so a local `service-auth` instance can run on its established ports.
- The Hono API exposes liveness endpoints at `/health` and `/api/health`, application metadata at `/api`, and a PostgreSQL-backed readiness check at `/api/readiness`.
- The API accepts `DATABASE_URL` locally and prefers the server-managed `DATABASE_URL_FILE` contract in production.
- Drizzle tooling is configured, but the schema is intentionally empty and no baseline migration exists. The first migration belongs with the approved Phase 1 domain model.
- The app reserves the OAuth client ID `cookbook` and server-only central-auth configuration variables. Session handling, token validation, identity mapping, and authorization remain unresolved below.
- The web runtime Caddy serves static SPA files only. Platform Caddy owns `cookbook.szarans.ca`, TLS, and direct `/api/*` routing to the API container.

These are applications of the Pior Labs paved road, not Cookbook-specific architectural deviations, so no ADR is required for the scaffold.

## Design work to complete before feature implementation

### 1. Domain model

Define the Phase 1 model for:

- Recipes
- Structured ingredients
- Ordered instructions
- Categories
- Tags
- User-specific favorites
- User-specific ratings
- Recently viewed history
- Recoverable deletion
- Created-by metadata

The model must preserve the distinction between household-shared recipe data and per-user preference/history data.

### 2. Ingredient representation and serving scaling

Resolve:

- Quantity storage format
- Supported units
- Unit normalization rules
- Optional/unitless ingredients such as `2 eggs` or `salt to taste`
- Fraction storage versus display formatting
- Scaling behavior and rounding rules
- Whether compatible units are converted during normal recipe viewing or deferred to Phase 2

Serving scaling must remain deterministic and must not mutate the saved base recipe.

### 3. API boundaries

Define the application API needed for Phase 1, including:

- Recipe CRUD
- Search/filtering
- Category and tag management
- Favorites
- Ratings
- Recently viewed state
- Image upload/reference handling
- Recovery and permanent deletion operations

Core business logic should remain reusable outside the frontend so it can later be exposed through MCP without duplicating product rules.

### 4. Authentication and authorization

Document how the Cookbook integrates with `service-auth`, including:

- Session/token validation
- User identity mapping
- Authorized household access
- API authorization boundaries
- Local development behavior

Do not introduce a second authentication system.

### 5. Image storage

Choose and document the storage strategy for one primary recipe image per recipe, including:

- Upload flow
- Storage location/provider
- File naming or object keys
- Size/type validation
- Replacement and deletion behavior
- Backup implications
- Local and production configuration

### 6. Search

Choose the Phase 1 search strategy for recipe name, description, ingredients, category, and tags.

The implementation should be proportionate to a household-scale collection while leaving a reasonable path for future growth.

### 7. Recoverable deletion

Define the soft-delete/trash model and restore behavior. Permanent-deletion retention policy may remain configurable or deferred, but accidental deletion must be recoverable.

### 8. Frontend structure and UX states

Define the primary application surfaces and responsibilities, including:

- Home/discovery
- Recipe browse/search
- Recipe detail
- Create/edit recipe
- Category/tag management
- Favorites
- Recently viewed
- Trash/recovery
- Optional Phase 1.x Cooking Mode

Document loading, empty, error, and destructive-action states where they materially affect UX.

### 9. Validation

Define validation rules for recipe input, structured ingredients, serving counts, ratings, categories, tags, and image uploads.

Validation should be enforced at appropriate API and UI boundaries rather than relying exclusively on the client.

### 10. Testing strategy

Define expected test coverage for:

- Serving calculations
- Recipe CRUD
- Authorization
- User-specific favorites/ratings
- Search behavior
- Soft deletion and restoration
- Critical API validation
- High-value frontend flows

### 11. Deployment and configuration

Document Cookbook-specific deployment details while respecting `platform-deploy` ownership of shared production infrastructure.

Include only app-owned configuration here. Shared routing, network, database-role provisioning, and server-managed secrets remain platform responsibilities.

## Phase boundaries

The technical design must optimize for Phase 1 without implementing later phases prematurely.

However, Phase 1 decisions should preserve a clean path to:

- MCP v1 after Phase 1
- Phase 2 meal planning and grocery aggregation
- Phase 3 smart recipe importing
- Phase 4 Recipe Roulette

## Decision log

Durable architectural decisions should be recorded in [`DECISIONS/`](./DECISIONS/README.md) and linked back here where relevant.

## Approval state

This file is intentionally a scaffold. Before substantial Phase 1 feature implementation begins, the unresolved sections above should be turned into an reviewed technical design.
