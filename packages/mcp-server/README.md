# @cookbook/mcp-server

Read-only MCP access to the household cookbook, for a household member's own
assistant.

The decisions behind it - stdio, the service layer, read-only, and the
configured acting user - are recorded in
[ADR 0006](../../docs/DECISIONS/0006-read-only-stdio-mcp-server.md).

## Tools

All six are read-only. None of them can create, edit, favorite, rate, or delete
anything, and none records a recipe as viewed.

| Tool | Answers |
| --- | --- |
| `search_recipes` | Free text across name, description, ingredients, category, and tags, narrowed by category, time, rating, or favorites. |
| `get_recipe` | One full recipe - ingredients, instructions, notes, source - optionally scaled to a serving count. |
| `get_recipes_by_tag` | Recipes carrying every named tag. |
| `get_favorites` | The configured member's own favorites. |
| `get_top_rated_recipes` | Highest household-average ratings, best first. |
| `scale_recipe` | A recipe's ingredients recalculated for a serving count. |

Ingredient amounts are exact fractions from `@cookbook/domain` - the same
arithmetic the recipe screen runs - rendered as a cook would read them
("1½ cups"), so the assistant and the browser never disagree.

## Who it acts as

`COOKBOOK_MCP_USER_EMAIL` names one household member, resolved against
`users.email` at startup. The server refuses to start if it names nobody.

Identity is never a tool argument, so "my favorites" has exactly one possible
meaning and an assistant cannot read the other household member's preferences.
Each member configures their own client with their own address.

The address must belong to someone who has signed in through central SSO at
least once - `service-auth` is the only thing that creates Cookbook users.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `COOKBOOK_MCP_USER_EMAIL` | yes | The household member this server acts as. |
| `DATABASE_URL` | yes | Read by `@cookbook/api`. `DATABASE_URL_FILE` is accepted in production so the password stays server-managed. |
| `MCP_LOG_LEVEL` | no | `debug` \| `info` \| `warn` \| `error`. Default `info`. |

Logs go to **stderr**. stdout carries the MCP protocol and nothing else.

## Running it

### Against the deployed cookbook

The server runs on the application host as a long-running container, the same
way `finlens-mcp-server` does. Clients `exec` into it over SSH.

With Claude Code:

```sh
claude mcp add cookbook -- ssh optiplex \
  "docker exec -i cookbook-mcp-server node packages/mcp-server/dist/index.js"
```

Or, as client configuration:

```jsonc
{
  "mcpServers": {
    "cookbook": {
      "command": "ssh",
      "args": [
        "optiplex",
        "docker exec -i cookbook-mcp-server node packages/mcp-server/dist/index.js"
      ]
    }
  }
}
```

`-i` is required. Without it the process gets no stdin, and the failure looks
like a server that never answers rather than a missing flag.

The acting user comes from the container's environment, not the client, so it is
not repeated here. A second household member needs their own container with
their own `COOKBOOK_MCP_USER_EMAIL`.

This keeps the database credential on the host that already holds it: the
Cookbook's PostgreSQL publishes no host port, so the client machine needs SSH
rather than a route to the database, and the password never reaches a laptop.

### Against a local checkout

```jsonc
{
  "mcpServers": {
    "cookbook": {
      "command": "node",
      "args": ["/path/to/app-cookbook/packages/mcp-server/dist/index.js"],
      "env": { "COOKBOOK_MCP_USER_EMAIL": "you@example.com" }
    }
  }
}
```

`@cookbook/api` resolves to its build output, so build before first use:

```sh
pnpm --filter @cookbook/mcp-server... build
```

## Checking it works

```sh
COOKBOOK_MCP_USER_EMAIL=you@example.com pnpm --filter @cookbook/mcp-server smoke
```

The smoke check launches the real server as a subprocess, speaks MCP to it over
stdio, calls every tool against the development database, and asserts that all
six report `readOnlyHint`. It is the only check that catches a stray write to
stdout, which corrupts the protocol stream and cannot be caught by a unit test.

```sh
pnpm --filter @cookbook/mcp-server test
```

covers the rendering and the tool contract, and needs no database.
