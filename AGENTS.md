# Pior Labs Application Agent Instructions

This repository is the Pior Labs Cookbook, a private household recipe management application.

## Source-of-truth hierarchy

Before making product or architectural changes, use the repository documentation in this order:

1. `docs/PRD.md` — what the Cookbook should do. Its Phase 1 and MCP v1 sections are delivered; sections 11-13 are the unbuilt phases. Read its "How to read this document" preamble before treating anything in it as outstanding work.
2. `docs/TECHNICAL_DESIGN.md` — how approved Cookbook-specific requirements are implemented.
3. `docs/STATUS.md` — what is actually implemented today.
4. `docs/DECISIONS/` — durable architectural decisions and their rationale.
5. The current issue, task, or PR — the immediate scope of work.

Do not assume a requirement in the PRD has already been implemented. Check `docs/STATUS.md` and the codebase.

## Current product scope

**Phase 1 — Core Cookbook is complete**, deployed on the household network, and
covered by tests. **MCP v1** is implemented: a read-only stdio server
(`packages/mcp-server`) exposing six recipe tools.

Nothing is currently in flight. Phase 2 (meal planning and grocery lists) begins
when the household wants it; do not start Phase 2+ work unless the task
explicitly opens that scope.

Because Phase 1 is done, most work now is change to existing behavior rather
than new capability. Check `docs/STATUS.md` and the code before adding
something - the likeliest mistake is now rebuilding what exists, not missing a
requirement.

The Phase 1 product constraints still hold, and still govern changes:

- Recipes are shared household data.
- Favorites, ratings, and recently viewed history are per-user.
- Ingredients must remain structured because serving scaling and future grocery aggregation depend on them.
- Serving adjustments must not mutate the saved base recipe.
- Recipe deletion must be recoverable.
- The UI should feel like a polished consumer cooking application, not primarily an administrative CRUD interface.
- Mobile usability is important because recipes will be referenced while cooking.

When a product requirement is unclear, prefer the PRD over inference from the existing code.

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

## Keeping the documentation honest

The scaffold's template cleanup is done: the names, technical design, domain
schema, migrations, OAuth client, `platform-deploy` provisioning, and deployment
configuration are all real.

What remains is ongoing. `docs/STATUS.md` is the one file that claims what
exists, so update it whenever a capability changes state - and correct
`README.md` and `docs/TECHNICAL_DESIGN.md` in the same change when a feature
lands, rather than leaving them describing the application as it used to be. A
stale document is worse than a missing one, because it is believed.

Record durable architectural choices in `docs/DECISIONS/`, and update this file
only where the application genuinely deviates from platform conventions.
