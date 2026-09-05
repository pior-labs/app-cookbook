# ADR 0006 — A read-only stdio MCP server with a configured acting user

**Status:** Accepted
**Date:** 2026-09-04
**Supersedes:** the MCP entries deferred in [`TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN.md) section 18

## Context

[`PRD.md`](../PRD.md) section 10 places MCP v1 after Phase 1 and lists six
read-oriented capabilities: `search_recipes`, `get_recipe`, `get_favorites`,
`get_top_rated_recipes`, `get_recipes_by_tag`, and `scale_recipe`. Technical
design section 18 deliberately deferred three decisions until the recipe model
was stable: MCP transport, permissions, and tool contracts. Phase 1 is now
feature-complete and deployed on the household network, meeting the condition
technical design section 17 set for starting MCP work, so those three decisions
are the subject of this record.

Three properties of the Cookbook shape the answer:

- Favorites, ratings, and recently viewed history are **per-user** (PRD section
  5.4). Every application service already takes an explicit `userId`, and a
  conversational client asking "what are *my* favorite quick meals?" has to
  resolve to one specific household member.
- Recipes are **shared household data** whose loss matters (PRD section 15,
  Reliability). Deletion was made recoverable by
  [ADR 0005](./0005-recoverable-recipe-deletion.md) precisely because this data
  is long-lived.
- The household is **two people** on a self-hosted platform, not a multi-tenant
  service.

`app-finance-tracker` already runs a Pior Labs MCP server. It establishes the
house conventions this record follows where they fit: the
`@modelcontextprotocol/sdk` `McpServer` with `registerTool`, a per-tool
`readOnlyHint`, structured output alongside a readable text rendering, and a
JSON logger that writes to **stderr**. It also makes one choice this record
deliberately departs from: it reaches straight into its database package.

## Decision

### 1. Transport: stdio

MCP v1 speaks stdio, not HTTP.

The client is a household member's own assistant running on their own machine.
stdio needs no listening port, no route in `platform-deploy`, no TLS, and no
second authentication path into the application - the process is already
running as the person who launched it. An HTTP transport would need every one
of those, and would put a new authenticated network surface in front of the
household's recipes to serve two users.

This also keeps `AGENTS.md`'s standing constraint intact: no second
authentication system, and no app-level reverse proxy.

### 2. Data access: the application service layer

The MCP server imports `@cookbook/api`'s services. It does not issue its own
SQL, and it does not call the HTTP API.

Technical design section 3 anticipated exactly this: *"This boundary lets a
future MCP server import domain rules and call application services without
duplicating serving calculations or depending on the frontend."*

The alternatives were both worse:

- **Its own SQL** (the `app-finance-tracker` approach) would duplicate the
  active-recipe predicate, the household-rating aggregate, and the per-user
  favorite join. Every one of those is a rule a second implementation can get
  quietly wrong, and Trash exclusion is the one where being wrong means showing
  a cook a recipe they deleted.
- **The HTTP API** would need a session, which is the authentication problem
  stdio was chosen to avoid, and would serialize through a network hop between
  two processes on the same host for no benefit.

Serving scaling in particular must have one implementation. `scale_recipe`
calls the same `@cookbook/domain` fraction arithmetic the recipe detail screen
calls, so a recipe scaled in conversation and the same recipe scaled in the
browser cannot disagree.

To make this boundary explicit rather than incidental, `@cookbook/api` gains a
narrow `exports` map. The MCP server may import `@cookbook/api/services` and
`@cookbook/api/db`; it cannot reach into route handlers, middleware, or the
image pipeline.

### 3. Permissions: read-only, with the acting user configured out of band

**Every tool is read-only.** No tool creates, edits, favorites, rates, deletes,
or records a view. Tools carry `readOnlyHint: true`.

**The acting user is configuration, never a tool argument.** The server reads
`COOKBOOK_MCP_USER_EMAIL`, resolves it against the unique `users.email` column
once at startup, and fails to start if it names nobody. Each household member
configures their own MCP client with their own address.

This is the load-bearing decision of the three. If the acting user were a tool
parameter, the model would choose whose favorites to read, and "what are my
favorites?" would become a guess that silently returns the other person's
preferences. Because identity is resolved from configuration before any tool
runs, a per-user tool has exactly one possible subject and the model cannot
address another household member's data at all.

Read-only follows from the same reasoning applied to the shared half of the
data. Recipes are the household's long-lived records; an LLM that can only read
them cannot damage them, which lets MCP v1 ship without first answering the
much larger question of what a *write* permission model should look like. The
per-user writes that would be safest to add first - favorite and rate, which
touch only the acting user's own preferences and are trivially reversible - are
left to a later revision, so that revision can be judged on its own evidence.

Recording a view is also excluded, which is a deliberate consequence rather
than an oversight. Technical design section 4.6 already separated view
recording from reading a recipe so that *"future MCP reads do not accidentally
change browser history"*. Asking an assistant about a recipe is not the same
act as opening it, and it should not reorder what the `/recent` screen shows.

### 4. Where the process runs

On the application host, as a long-running container that clients `exec` into:

```
ssh <host> "docker exec -i cookbook-mcp-server node packages/mcp-server/dist/index.js"
```

`-i` is required. Without it the process gets no stdin, and the failure looks
like a server that never answers rather than a missing flag. The container must
not allocate a TTY, which would corrupt the JSON-RPC framing.

This is the pattern `finlens-mcp-server` already uses on the same host, and
matching it is the point.

Each client session gets its own `exec`'d process. The container's main process
serves no client and exists only to hold the container open, so compose runs it
as `sleep infinity` rather than as an MCP server that nobody talks to. An idle
server there would hold a Postgres connection open for no one, and -
since a stdio server must exit when its client closes stdin - would stop the
container the moment anything closed the container's own stdin.

Because the main process is therefore deliberately inert, health cannot be "is
the process running". It is defined instead as "could an `exec`'d session work":
the database is reachable and the configured user resolves. A container whose
main process is up but whose configuration is wrong would otherwise look fine
while every session failed.

The alternative considered and rejected was a per-session container
(`docker compose run --rm -T`), which leaves nothing idle and matches a stdio
server's actual lifecycle, but diverges from the platform's existing deployment
for no benefit a two-person household would notice.

Running on the host also keeps the database credential where it already lives.
The Cookbook's PostgreSQL publishes no host port and is reachable only on the
internal `pior_data` network, so a client machine needs SSH to the host rather
than a route to the database, and the password never reaches a laptop. Pointing
a locally-run server at the production database is not an option and is not
meant to be; local runs use the development database.

## Consequences

- The server needs no OAuth client, route, or DNS entry, so it adds nothing to
  `platform-deploy` and no public surface to the deployed application.
- Every household member needs their own MCP client entry. With two users this
  is two lines of configuration; it would not scale to a public service, and it
  is not meant to.
- Adding writes later is a permissions decision, not a rearchitecture: the
  acting user is already resolved and already threaded through every service
  call. A future ADR revisiting this should start with favorite and rate.
- The server holds a database connection for its lifetime, so it is subject to
  the same connection budget as the API. At household scale, with one process
  per signed-in member, this is not a constraint worth engineering around.
- Because the acting user is baked into the container's environment, a second
  household member wanting their own favorites needs their own container rather
  than a second client pointed at this one. With two people that is one extra
  service; it would not scale, and it is not meant to.
- Because `scale_recipe` reuses the domain package, a change to fraction
  formatting changes the browser and the assistant together. That is the
  intent.

## Alternatives considered

**Streamable HTTP transport with OAuth.** The right answer for a multi-user or
remote-access MCP server, and the wrong one here: it reintroduces the
authentication surface, needs platform routing, and serves two people who
already have shells on the machine.

**Passing `userId` as a tool argument.** Rejected above - it makes per-user
data addressable by the model and turns a fact into a guess.

**A single shared "household" identity for per-user tools.** This would make
`get_favorites` meaningless. PRD section 5.4 is explicit that one user's
favorites must not stand in for another's.

**A per-session container** (`docker compose run --rm -T`). Closer to what a
stdio server's lifecycle actually is, and it leaves nothing idle - but it
diverges from `finlens-mcp-server` on the same host for a saving a two-person
household would not notice. See decision 4.
