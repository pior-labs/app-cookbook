FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --filter @cookbook/api... --frozen-lockfile

COPY packages/domain packages/domain
COPY packages/api packages/api
# Builds @cookbook/domain and then @cookbook/api in dependency order.
RUN pnpm --filter @cookbook/api... build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json packages/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --filter @cookbook/api... --prod --frozen-lockfile
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/drizzle packages/api/drizzle

CMD ["node", "packages/api/dist/index.js"]
