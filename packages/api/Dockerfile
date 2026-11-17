FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
# Node 25+ no longer bundles Corepack; install the pnpm named by packageManager.
RUN npm install --global --no-fund --no-audit \
    "$(node -p "require('./package.json').packageManager.split('+')[0]")"
COPY packages/api/package.json packages/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --filter @cookbook/api... --frozen-lockfile

COPY packages/domain packages/domain
COPY packages/api packages/api
# Builds @cookbook/domain and then @cookbook/api in dependency order.
RUN pnpm --filter @cookbook/api... build

FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Recipe image storage. Compose mounts a persistent volume here; creating the
# directory keeps the readiness check meaningful when nothing is mounted yet.
ENV IMAGE_STORAGE_DIR=/var/lib/cookbook/images
RUN mkdir -p /var/lib/cookbook/images

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Node 25+ no longer bundles Corepack; install the pnpm named by packageManager.
RUN npm install --global --no-fund --no-audit \
    "$(node -p "require('./package.json').packageManager.split('+')[0]")"
COPY packages/api/package.json packages/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --filter @cookbook/api... --prod --frozen-lockfile
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/drizzle packages/api/drizzle

CMD ["node", "packages/api/dist/index.js"]
