# Pior Labs Application Agent Instructions

This repository is intended to become a Pior Labs user-facing application.

## Before making architectural changes

Read the current public platform documentation in `pior-labs/platform` and, when starting a new application, use `platform/prompts/new-webapp-bootstrap.md` as bootstrap context.

When implementation details conflict with this template, current platform/service documentation wins.

## Default architecture

Prefer the established Pior Labs paved road:

- TypeScript
- React + Vite
- Hono
- PostgreSQL + Drizzle
- pnpm
- Docker Compose
- GitHub Actions
- `@pior-labs/design-system`
- `service-auth` for OAuth/OIDC
- platform Caddy for production routing and TLS
- a minimal Caddy runtime inside the web container for static SPA serving only

`platform-deploy` owns production reverse-proxy behavior. The app web container must not proxy `/api/*`; platform Caddy routes API traffic directly to the app API container and all other traffic to the app web container.

Do not add a second authentication system, app-level reverse proxy, database server, or shared design system without a concrete requirement.

## Repository ownership

This repository owns:

- product code
- app-specific database schema and migrations
- app-specific containers
- the static web-server configuration used only to serve the compiled SPA
- CI and app deployment workflow
- application documentation

`platform-deploy` owns production infrastructure, Caddy reverse-proxy routing, shared Docker networks, database/role provisioning, and server-managed database credentials.

`service-auth` owns user authentication and trusted OAuth client registration.

## Security

- Never commit secrets.
- Prefer `DATABASE_URL_FILE` in production so database passwords remain server-managed.
- Never expose OAuth client secrets through `VITE_*` variables.
- Keep public ports closed unless there is a documented reason to publish them.
- Use health checks for long-running services.

## Template cleanup

When this template becomes a real app:

1. replace generic names and descriptions;
2. define the real domain schema;
3. generate and commit the first Drizzle migration;
4. register the OAuth client;
5. provision the database and routes in `platform-deploy`;
6. configure deployment variables/secrets;
7. update this file only where the application genuinely deviates from platform conventions.
