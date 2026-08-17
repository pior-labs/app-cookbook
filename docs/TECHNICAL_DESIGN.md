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
- Drizzle includes the application-local user, account, session, and verification tables required by authentication. The recipe domain schema remains deferred until its Phase 1 design is approved.
- The `cookbook` OAuth client uses central `service-auth` identities and stores an HTTP-only application session. The authorization boundary and identity mapping are defined in section 4.
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

The Cookbook delegates identity to `service-auth` using the OAuth 2.1/OIDC
authorization-code flow with PKCE. It is registered as the confidential client
`cookbook` and requests `openid profile email offline_access`.

The API uses Better Auth's generic OAuth client and Drizzle adapter. After the
central callback succeeds, it maintains a Cookbook-local, HTTP-only session
cookie and local `users`, `accounts`, `sessions`, and `verifications` records.
The linked `accounts.account_id` is the stable subject from `service-auth`;
Cookbook's numeric `users.id` is the foreign-key identity used by recipes and
per-user features. Cookbook does not enable passwords, signup, or any other
independent identity provider.

The central provider is responsible for deciding which household identities
may authenticate. Cookbook trusts identity claims only after issuer validation
against the configured discovery document. Matching verified identities may
link to the same local user through the trusted `auth-pior` provider.

The API authorization boundary is deny-by-default:

- `/health` and `/api/health` are public health checks.
- `/api/auth/*` is public so OAuth initiation and callbacks can complete.
- Every other `/api/*` route requires a valid Cookbook session.
- Authenticated handlers receive the local user ID, email, and display name
  from middleware; future per-user tables reference the local user ID.

Local development uses `service-auth` at `http://localhost:5173`, Cookbook web
at `http://localhost:5175`, and Cookbook API at `http://localhost:3002`. Vite
proxies Cookbook `/api/*` traffic to the API, preserving one browser-facing
Cookbook origin. The registered local callback is
`http://localhost:5175/api/auth/oauth2/callback/auth-pior`.

`CENTRAL_AUTH_CLIENT_SECRET` and the independent Cookbook
`BETTER_AUTH_SECRET` remain server-only configuration and must never use a
`VITE_*` variable. Production uses the canonical issuer and callback registered
by `service-auth`.

See [ADR 0001](./DECISIONS/0001-central-sso-and-local-sessions.md).

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
