FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/api/package.json packages/api/package.json
RUN pnpm install --filter @webapp/api... --no-frozen-lockfile

COPY packages/api packages/api
RUN pnpm --filter @webapp/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY packages/api/package.json packages/api/package.json
RUN pnpm install --filter @webapp/api... --prod --no-frozen-lockfile
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/drizzle packages/api/drizzle

CMD ["node", "packages/api/dist/index.js"]
