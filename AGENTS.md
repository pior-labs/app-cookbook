# Pior Labs Application Agent Instructions

This repository is the Pior Labs Cookbook, a private household recipe management application.

## Source-of-truth hierarchy

Before making product or architectural changes, use the repository documentation in this order:

1. `docs/PRD.md` — what the Cookbook should do.
2. `docs/TECHNICAL_DESIGN.md` — how approved Cookbook-specific requirements are implemented.
3. `docs/STATUS.md` — what is actually implemented today.
4. `docs/DECISIONS/` — durable architectural decisions and their rationale.
5. The current issue, task, or PR — the immediate scope of work.

Do not assume a requirement in the PRD has already been implemented. Check `docs/STATUS.md` and the codebase.

## Current product scope

The current product phase is **Phase 1 — Core Cookbook**.

Do not implement Phase 2+ features unless the task explicitly changes scope. MCP v1 is planned after Phase 1 once the recipe model and API are stable.

Important Phase 1 product constraints include:

- Recipes are shared household data.
- Favorites, ratings, and recently viewed history are per-user.
- Ingredients must remain structured because serving scaling and future grocery aggregation depend on them.
- Serving adjustments must not mutate the saved base recipe.
- Recipe deletion must be recoverable.
- The UI should feel like a polished consumer cooking application, not primarily an administrative CRUD interface.
- Mobile usability is important because recipes will be referenced while cooking.

When a product requirement is unclear, prefer the PRD over inference from the template.

## Before making architectural changes

Read the current public platform documentation in `pior-labs/platform` and, when starting a new application, use `platform/prompts/new-webapp-bootstrap.md` as bootstrap context.

When implementation details conflict with this template, current platform/service documentation wins. Cookbook-specific approved decisions in `docs/TECHNICAL_DESIGN.md` may refine the paved road where explicitly documented.

Record durable deviations or major architectural choices in `docs/DECISIONS/`.

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
2. complete the Cookbook-specific technical design;
3. define the real domain schema;
4. generate and commit the first Drizzle migration;
5. register the OAuth client;
6. provision the database and routes in `platform-deploy`;
7. configure deployment variables/secrets;
8. update `docs/STATUS.md` as capabilities become real;
9. update this file only where the application genuinely deviates from platform conventions.
