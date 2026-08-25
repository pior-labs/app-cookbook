FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY packages/web/package.json packages/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token)" \
    pnpm install --filter @cookbook/web... --frozen-lockfile

COPY packages/domain packages/domain
COPY packages/web packages/web
# Builds @cookbook/domain and then @cookbook/web in dependency order.
RUN pnpm --filter @cookbook/web... build

FROM caddy:2-alpine AS runtime
COPY packages/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/packages/web/dist /srv
EXPOSE 80
