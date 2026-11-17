FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
# Node 25+ no longer bundles Corepack; install the pnpm named by packageManager.
RUN npm install --global --no-fund --no-audit \
    "$(node -p "require('./package.json').packageManager.split('+')[0]")"
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

FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Node 25+ no longer bundles Corepack; install the pnpm named by packageManager.
RUN npm install --global --no-fund --no-audit \
    "$(node -p "require('./package.json').packageManager.split('+')[0]")"
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --filter @cookbook/mcp-server... --prod --frozen-lockfile
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/mcp-server/dist packages/mcp-server/dist

# The image defaults to a per-client stdio process. The opt-in HTTP Compose
# override runs http-index.js and supplies the private listener's health probe.
CMD ["node", "packages/mcp-server/dist/index.js"]
