# Pior Labs Application Agent Instructions

This repository is the Pior Labs Cookbook, a private household recipe management
application.

## How documentation works here

**The code is the description of the application.** There is no document that
restates the schema, the endpoints, the routes, or the tool inventory, because
such a document is wrong the moment someone edits the code and forgets it, and a
stale document is worse than a missing one - it gets believed.

Four documents exist, and each one holds something code cannot:

| File | Holds |
| --- | --- |
| `docs/DECISIONS.md` | Why the code is the way it is, and what was deliberately **not** built. |
| `docs/OPERATIONS.md` | Provisioning, deploying, backups, and restore. Procedures for when the code is not running. |
| `docs/IDEAS.md` | Product intent for things that do not exist yet. |
| `docs/IMPLEMENTING.md` | The brief for the work in flight. Temporary. Deleted when it lands. |

Everything else goes in a comment next to the code it explains. This repository
comments densely and at the level of *why*, not *what* -
`packages/mcp-server/src/inflight.ts` and
`packages/api/src/services/index.ts` are the standard to match.

### The rules that keep this honest

- **Do not create a status file, a technical design, or a PRD.** They existed,
  they drifted, and they were deleted on purpose. `git log` and the code
  already answer "what is implemented".
- **Do not cite documents from code comments by section number.** Comments must
  stand on their own. Citing `DECISIONS.md` by ADR number is fine; those
  numbers are stable.
- **`docs/IMPLEMENTING.md` is deleted as the last step of the work it
  describes,** not as cleanup afterwards. Before it goes, its durable claims
  must land in a code comment or in `docs/DECISIONS.md`. Deleting it without
  that is just amnesia.
- **Add to `docs/DECISIONS.md` only when reading the code would not recover the
  reasoning.** The strongest signal is an absence: a thing considered and
  rejected has no code to comment, so it has to go there or it is lost. A
  decision visible in the code belongs in a comment.

## Current scope

Phase 1 (the core Cookbook) and MCP v1 are built, deployed on the household
network, and covered by tests. Phase 2 (meal planning, AI suggestions, and one
grocery list per plan, with the MCP planning tools) is built and covered by
tests. Read the code for what that means in detail.

Work in flight is described by `docs/IMPLEMENTING.md` if that file exists. If it
does not, nothing is in flight, and new capability needs a brief before it needs
a commit.

Most work now changes existing behaviour rather than adding capability. **The
likeliest mistake is rebuilding something that already exists**, so search the
code before adding.

## Product constraints that still govern changes

- Recipes are shared household data. Favorites, ratings, and recently viewed
  history are per-user.
- Ingredients must stay structured. Serving scaling and grocery aggregation both
  depend on it, and a free-text ingredient cannot be scaled or added up.
- Serving adjustment must never mutate the saved recipe.
- Recipe deletion must stay recoverable.
- The UI is a polished consumer cooking application, not an admin CRUD screen.
- Mobile usability matters more than usual, because recipes are read while
  cooking and grocery lists are read while shopping.

## Before making architectural changes

Read the current public platform documentation in `pior-labs/platform`. When
implementation details conflict with it, current platform documentation wins.
`docs/DECISIONS.md` records where Cookbook deliberately deviates.

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

`platform-deploy` owns production reverse-proxy behavior. The app web container
must not proxy `/api/*`; platform Caddy routes API traffic directly to the app
API container and all other traffic to the app web container.

Do not add a second authentication system, app-level reverse proxy, database
server, or shared design system without a concrete requirement.

## Repository ownership

This repository owns product code, the app-specific database schema and
migrations, app-specific containers, the static web-server configuration used
only to serve the compiled SPA, and CI and deployment workflows.

`platform-deploy` owns production infrastructure, Caddy reverse-proxy routing,
shared Docker networks, database and role provisioning, and server-managed
database credentials.

`service-auth` owns user authentication and trusted OAuth client registration.

## Security

- Never commit secrets.
- Prefer `DATABASE_URL_FILE` in production so database passwords remain
  server-managed.
- Never expose OAuth client secrets through `VITE_*` variables.
- Keep public ports closed unless there is a documented reason to publish them.
- Use health checks for long-running services.
