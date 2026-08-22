# Pior Labs Cookbook

Pior Labs Cookbook is a private, self-hosted household recipe manager. It is being built as a polished, mobile-friendly place to save, find, scale, and cook the recipes the household wants to keep.

The application is currently in **Phase 1 — Core Cookbook**. The responsive application shell, API baseline, PostgreSQL/Drizzle tooling, container configuration, CI, and central SSO integration are in place, along with the recipe domain model and the recipe create/read/update API. The product UI, images, discovery, and Trash are still to come.

## Stack

- React 19 + Vite frontend
- Hono API
- PostgreSQL + Drizzle ORM
- TypeScript and pnpm workspaces
- `@pior-labs/design-system`
- Docker Compose and GitHub Actions
- Pior Labs `service-auth` OAuth/OIDC configuration
- Platform-managed Caddy routing and TLS

## Repository layout

```text
packages/domain/  pure business rules, validation schemas, and domain types
packages/api/     Hono API, Drizzle tooling, and integration tests
packages/web/     React application and static Caddy runtime
docs/             product requirements, technical design, status, and decisions
```

The product source of truth is [`docs/PRD.md`](docs/PRD.md). Check [`docs/STATUS.md`](docs/STATUS.md) before assuming a documented requirement exists in the application.

## Local development

Requirements:

- Node.js 22
- pnpm 10.8.1 through Corepack
- a local PostgreSQL server with an empty `cookbook_dev` database
- GitHub Packages access for `@pior-labs/design-system`

Set up and start the app:

```bash
corepack enable
cp .env.example .env
pnpm install
pnpm dev
```

The default local endpoints are:

- web: `http://localhost:5173`
- API: `http://localhost:3002`
- API health: `http://localhost:3002/health`
- database readiness: `http://localhost:3002/api/readiness`

Vite proxies `/api/*` to the local API. Pior Labs applications reuse port `5173`
one at a time and authenticate against the hosted `https://auth.szarans.ca`
issuer, so application development does not require a local `service-auth`.

Run one process at a time when useful:

```bash
pnpm dev:web
pnpm dev:api
```

The repository does not start another PostgreSQL server. Local development uses an existing local PostgreSQL instance; production database provisioning is owned by `platform-deploy`.

## Database

Local commands use `DATABASE_URL` from the root `.env` file:

```bash
pnpm db:generate
pnpm db:migrate
```

The first migration creates the local user, account, session, and verification tables used by authentication. The second creates the recipe domain: recipes, ingredients, instructions, categories, tags, images, favorites, ratings, and recently viewed history, and seeds the starter categories.

Production uses `DATABASE_URL_FILE`. `platform-deploy` provisions the database, role, and server-managed connection file; this repository only mounts that file read-only into the API container.

## Testing

```bash
pnpm test
```

`@cookbook/domain` runs pure Vitest unit tests. `@cookbook/api` runs Vitest integration tests against a real PostgreSQL database rather than mocked SQL: the suite creates a disposable, per-run `<database>_test_<suffix>` database on the server named by `DATABASE_URL`, applies every migration to it, resets state before each test, and drops it afterwards. Two suites can run at once without colliding. `TEST_DATABASE_URL` points the suite at a specific database instead; it must not name the database in `DATABASE_URL`, and the harness refuses to start if it does, because it drops and recreates whatever it is given.

## Authentication

Cookbook uses the central Pior Labs `service-auth` OAuth 2.1/OIDC provider through an authorization-code flow with PKCE. Better Auth handles the callback and stores an HTTP-only Cookbook session in PostgreSQL. Configure the local app with:

```text
CENTRAL_AUTH_ISSUER
CENTRAL_AUTH_DISCOVERY_URL
CENTRAL_AUTH_CLIENT_ID=cookbook
CENTRAL_AUTH_CLIENT_SECRET
PUBLIC_BASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
BETTER_AUTH_TRUSTED_ORIGINS
```

The OAuth client secret and Cookbook session secret are server-only and must never use `VITE_*` names. Copy `.env.example` to `.env.local`, supply the deployed `cookbook` client secret, run `pnpm db:migrate`, and start Cookbook. Local application development uses the hosted SSO service.

Cookbook prefixes its Better Auth cookies with `cookbook`. Browser cookies are
scoped by hostname rather than port and persist after a development server
stops, so every Pior Labs application must use its own cookie prefix.

Before authenticated feature work or production deployment, `service-auth` must register a trusted client with:

- client ID: `cookbook`
- name: `Pior Labs Cookbook`
- production URI: `https://cookbook.szarans.ca`
- production callback: `https://cookbook.szarans.ca/api/auth/oauth2/callback/auth-pior`
- local callback: `http://localhost:5173/api/auth/oauth2/callback/auth-pior`
- scopes: `openid profile email offline_access`

The corresponding plaintext client secret belongs in local or server-managed secrets, not source control. The login screen, callback, protected API boundary, session restoration, and logout flow are implemented locally.

## Docker

The base Compose file publishes no host ports and joins the platform-owned `pior_edge` and `pior_data` networks. The API and web containers both have health checks.

For server-local debugging with loopback-only ports:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml config
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Production adds the platform-managed database connection file:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml config
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

The Caddy process inside the web image serves only the compiled SPA and falls back to `index.html`. It does not proxy `/api/*`.

## Production routing

The single production hostname is `https://cookbook.szarans.ca`. Split-horizon DNS resolves that same hostname appropriately on and away from the home network.

```text
cookbook.szarans.ca
        |
        v
platform Caddy
  |-- /api/* --> cookbook-api:3000
  `-- /*      --> cookbook-web:80
                         |
                         v
                  static SPA files only
```

TLS, ingress, DNS, shared networks, database provisioning, and routes are owned by `platform-deploy`.

## Validation and deployment

The CI workflow installs dependencies, typechecks, runs the unit and integration test suites against a PostgreSQL service container, and builds every package. There is no lint command yet; add one with the first code that needs it.

The deployment workflow remains manual until the production runner and these external dependencies are ready:

1. Register and seed the trusted Cookbook OAuth client in `service-auth`.
2. Provision the Cookbook database, role, secret file, and routes in `platform-deploy`.
3. Point `cookbook.szarans.ca` at the platform through split-horizon DNS.
4. Configure the repository production environment, `APP_ENV` secret, and `DEPLOY_DIR` variable.

## Scope

Phase 1 is being built in vertical slices. Recipe create, read, and update are implemented; images, product UI, search and discovery, favorites, ratings, recently viewed history, and Trash are not yet. Meal planning, grocery lists, imports, Recipe Roulette, and MCP are later work and are outside the current phase. See [`docs/STATUS.md`](docs/STATUS.md) for the authoritative state.
