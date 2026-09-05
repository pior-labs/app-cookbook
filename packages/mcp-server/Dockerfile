FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --filter @cookbook/mcp-server... --frozen-lockfile

COPY packages/domain packages/domain
COPY packages/api packages/api
COPY packages/mcp-server packages/mcp-server
# Builds @cookbook/domain, then @cookbook/api, then the server, in dependency
# order. The API is a real build dependency here rather than an incidental one:
# `@cookbook/api/services` resolves to its compiled output at runtime.
RUN pnpm --filter @cookbook/mcp-server... build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --filter @cookbook/mcp-server... --prod --frozen-lockfile
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/mcp-server/dist packages/mcp-server/dist

# No EXPOSE and no HEALTHCHECK: this is a stdio server, not a listening service.
# It is started per client session (`docker compose run --rm -T mcp`), speaks
# JSON-RPC on stdin and stdout, and exits when its client disconnects. A health
# probe would have nothing to probe, and anything it printed would corrupt the
# protocol stream.
CMD ["node", "packages/mcp-server/dist/index.js"]
