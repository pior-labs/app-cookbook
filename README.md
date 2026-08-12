# Pior Labs Web App Template

Reusable starting point for platform-native Pior Labs web applications.

This template provides the application-side foundation. Shared infrastructure remains owned by `pior-labs/platform-deploy`, shared authentication by `pior-labs/service-auth`, and platform conventions by `pior-labs/platform`.

## Included foundation

- pnpm workspace
- TypeScript
- React 19 + Vite frontend
- Hono API
- PostgreSQL + Drizzle ORM
- `@pior-labs/design-system`
- Docker / Docker Compose
- Caddy static web runtime
- platform-managed database secret support
- `pior_edge` and `pior_data` network conventions
- API and web health checks
- GitHub Actions CI
- self-hosted deployment workflow scaffold
- `AGENTS.md` with Pior Labs repository rules

Central OAuth/OIDC authentication is intentionally represented as configuration rather than reimplemented in this template. Each generated application must be registered as its own client in `service-auth` and should follow that repository's current integration contract.

## Create a new application

1. Use this repository as a GitHub template.
2. Name the new repository using the `app-*` convention, for example `app-cookbook`.
3. Read `AGENTS.md` and the Pior Labs bootstrap prompt in `pior-labs/platform/prompts/new-webapp-bootstrap.md`.
4. Replace the generic app metadata and package names where useful.
5. Copy `.env.example` to `.env` for local development.
6. Configure GitHub Packages access so `@pior-labs/design-system` can install.
7. Define the application's real Drizzle schema and generate its first migration.
8. Register the OAuth client in `service-auth`.
9. Add the application database/role and routing configuration in `platform-deploy`.
10. Configure the repository's production runner, `APP_ENV` secret, and `DEPLOY_DIR` variable before enabling deployment.

## Local development

```bash
corepack enable
cp .env.example .env
pnpm install
pnpm dev
```

The default development ports are:

- web: `http://localhost:5173`
- API: `http://localhost:3000`

Vite proxies `/api/*` to the local API during development.

## Production request routing

Production routing belongs to the platform Caddy instance managed by `platform-deploy`.

The expected pattern is:

```text
<app>.szarans.ca / <app>.ts.szarans.ca
        |
        v
platform Caddy
  |-- /api/* --> <app>-api:3000
  `-- /*      --> <app>-web:80
                         |
                         v
                  static Caddy
                  SPA files only
```

The Caddy process inside the web container is deliberately not a reverse proxy. It only serves the compiled Vite application and falls back to `index.html` for client-side routes. API routing, domains, TLS, and ingress remain platform responsibilities.

## Database

The API accepts either:

- `DATABASE_URL` for local development, or
- `DATABASE_URL_FILE` for a platform-managed production secret.

Production should use the generated database connection file from `platform-deploy` rather than duplicating the database password in GitHub.

Generate migrations after defining the application schema:

```bash
pnpm db:generate
pnpm db:migrate
```

The starter schema contains an intentionally generic example table. Replace it with the application's actual domain schema before the first real migration.

## Authentication

Each application receives its own trusted OAuth client in `service-auth`.

Configure the API with:

```text
CENTRAL_AUTH_ISSUER=
CENTRAL_AUTH_CLIENT_ID=
CENTRAL_AUTH_CLIENT_SECRET=
```

Do not expose `CENTRAL_AUTH_CLIENT_SECRET` to Vite/browser code. Use the current `service-auth` documentation as the source of truth for issuer, discovery, callback, scope, PKCE, and token handling details.

## Design system

The web package consumes `@pior-labs/design-system` from GitHub Packages. `.npmrc` configures the `@pior-labs` scope and `packages/web/src/index.css` imports the shared theme.

## Docker

The base Compose file joins the shared platform networks and publishes no host ports. For server-local debugging, use the local override:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Production adds the platform-managed database secret mount:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

## Deployment

`.github/workflows/deploy.yml` is manual by default. This prevents a newly generated repository from attempting a production deployment before its runner, environment, database, auth client, and routes are provisioned.

Once the app has been validated, add the desired automatic trigger (normally a push to `main`).

## Repository boundaries

This repository owns app-specific code, schema/migrations, containers, CI/CD, and documentation.

It should not become the source of truth for shared Caddy routing, PostgreSQL server provisioning, DNS conventions, central authentication implementation, or other Pior Labs platform infrastructure.
