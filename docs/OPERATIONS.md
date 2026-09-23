# Cookbook operations

How Cookbook is provisioned, deployed, backed up, and restored: the steps
someone actually runs, and who owns each one. This is the one document that has
to work when the application does not, so it is kept even though everything else
about the running system is described by the code.

`platform-deploy` owns the server, reverse proxy, DNS, database provisioning,
and persistent host directories. `service-auth` owns identity. This repository
owns the application, its migrations, and its containers.

## 1. Provisioning checklist

These are the external dependencies Cookbook needs in order to serve production
traffic. All of them are provisioned; the list is kept as the record of what was
set up and where, so a rebuild or a second environment has the steps rather than
having to rediscover them.

The deploy workflow stays manual (`workflow_dispatch`) by choice, not because
something is missing. A household cookbook is deployed when somebody decides to
deploy it.

### service-auth

- [x] The `cookbook` client exists and is seeded with the production secret.
- [x] Its registered callbacks include the canonical
      `https://cookbook.szarans.ca/api/auth/oauth2/callback/auth-pior` **and**
      the shared local one, `http://localhost:5173/api/auth/oauth2/callback/auth-pior`.

### platform-deploy

- [x] Cookbook database and role provisioned.
- [x] Connection file written to
      `/opt/docker/pior-labs/secrets/app-cookbook/database-url`, readable only
      by the deploy user, and referenced by `PLATFORM_DATABASE_URL_FILE`.
- [x] Persistent image directory created at
      `/opt/docker/pior-labs/data/app-cookbook/images`, owned by the API
      container's user, and referenced by `PLATFORM_IMAGE_STORAGE_DIR`.
- [x] The image directory is included in the same backup schedule as the
      database (see section 3 - they are one set).
- [x] `pior_edge` and `pior_data` networks reachable by the app containers.
- [x] Caddy routes `cookbook.szarans.ca/api/*` to `cookbook-api:3000` and
      everything else to `cookbook-web:80`.
- [x] Split-horizon DNS resolves `cookbook.szarans.ca` inside and outside.

### This repository

- [x] `DEPLOY_DIR` repository variable set.
- [x] `APP_ENV` repository secret holds the production `.env`, including
      `PLATFORM_DATABASE_URL_FILE`, `PLATFORM_IMAGE_STORAGE_DIR`,
      `CENTRAL_AUTH_CLIENT_SECRET`, `COOKBOOK_MCP_USER_EMAIL`, and a
      `BETTER_AUTH_SECRET` that is not shared with any other application.
- [x] A self-hosted runner labelled `self-hosted, linux, prod` is online.

### Dedicated production runner

Cookbook uses a repository-scoped runner with its own Linux account and
directories. Keeping it separate from the Auth, Finance, and platform runners
limits filesystem access and prevents one application's deployment checkout
from being owned by another runner.

The production convention is:

```text
Linux user:       cookbook-runner
Runner directory: /opt/actions-runner/cookbook
Deploy directory: /opt/docker/cookbook
Runner name:      optiplex-cookbook
Required labels:  self-hosted, linux, prod
```

Create the account and directories once:

```bash
id cookbook-runner >/dev/null 2>&1 || \
  sudo adduser --disabled-password --gecos "" cookbook-runner
sudo usermod -aG docker cookbook-runner

sudo mkdir -p /opt/actions-runner/cookbook /opt/docker/cookbook
sudo chown -R cookbook-runner:cookbook-runner \
  /opt/actions-runner/cookbook \
  /opt/docker/cookbook
```

Do not change ownership of the shared `/opt/actions-runner` or
`/opt/docker/pior-labs` directories.

In GitHub, open **Settings -> Actions -> Runners -> New self-hosted runner**
for this repository and choose Linux x64. Run GitHub's generated download and
extraction commands as the dedicated account:

```bash
sudo -iu cookbook-runner
cd /opt/actions-runner/cookbook
```

The registration token shown by GitHub is short-lived. Use it directly in the
configuration command and never store it in the repository or documentation:

```bash
./config.sh \
  --url https://github.com/pior-labs/app-cookbook \
  --token <GITHUB-PROVIDED-TOKEN> \
  --name optiplex-cookbook \
  --labels prod \
  --work _work
```

Exit the runner account, then install and start the systemd service:

```bash
exit
cd /opt/actions-runner/cookbook
sudo ./svc.sh install cookbook-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

Confirm two things before dispatching production:

```bash
sudo -u cookbook-runner docker ps >/dev/null \
  && echo "Runner can access Docker"
```

- GitHub shows `optiplex-cookbook` as **Idle**.
- The runner has the custom `prod` label in addition to the automatic
  `self-hosted` and `linux` labels.

The deploy workflow is manual-only and is the only workflow in this public
repository that targets the self-hosted runner. Pull-request CI continues to
run on GitHub-hosted runners.

To inspect or restart the runner later:

```bash
cd /opt/actions-runner/cookbook
sudo ./svc.sh status
sudo ./svc.sh stop
sudo ./svc.sh start
```

## 2. Deploying

`.github/workflows/deploy.yml`, run manually, syncs the source, writes `.env`,
builds the images, runs migrations as a one-off container, and starts the stack.
Migrations run **before** the new API starts, so a deployment fails rather than
serving against an incompatible schema.

After a deploy:

```bash
curl -fsS https://cookbook.szarans.ca/api/readiness
```

`{"status":"ready","database":"connected","imageStorage":"writable"}` means both
halves of the application's persistent state are present. Anything else is a
failed deploy: readiness answers `503` when the database is unreachable or the
image directory is not writable.

## 3. The backup set

PostgreSQL and `PLATFORM_IMAGE_STORAGE_DIR` are **one** backup set. A recipe row
points at image files by an opaque storage key; a database restored to a
different point than the image directory produces recipes whose photos are
missing, or files nothing references.

Take both while the API is stopped, or take the database dump first and the
files second - never the other way around. A file written after the dump is an
orphan the reconciler can clean up; a row written after the files is a recipe
with a missing photo, which needs a human.

`pg_dump` and `pg_restore` run on the host, not in a container - the API image is
`node:22-alpine` and carries no PostgreSQL client. Their major version must match
the server's, or `pg_restore` will refuse the archive:

```bash
pg_dump --version && psql -tAc 'show server_version;'
```

Neither command takes the connection string from the application environment, so
read it from the platform-managed file first. It is the same file the API
container mounts, and it is the only place the password lives:

```bash
export COOKBOOK_DATABASE_URL="$(sudo cat /opt/docker/pior-labs/secrets/app-cookbook/database-url)"
```

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml stop api mcp
pg_dump --format=custom --file=cookbook-$(date +%F).dump "$COOKBOOK_DATABASE_URL"
tar --numeric-owner -czf cookbook-images-$(date +%F).tar.gz \
  -C /opt/docker/pior-labs/data/app-cookbook images
docker compose -f docker-compose.yml -f docker-compose.production.yml start api mcp
```

`--numeric-owner` matters: the API container writes these files as its own uid,
and a restore that rewrites ownership leaves a directory the container cannot
read.

## 4. Restoring

1. Stop the application so nothing writes during the restore:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.production.yml down
   ```

2. Restore the database in place, over whatever is currently there:

   ```bash
   export COOKBOOK_DATABASE_URL="$(sudo cat /opt/docker/pior-labs/secrets/app-cookbook/database-url)"
   pg_restore --clean --if-exists --dbname "$COOKBOOK_DATABASE_URL" cookbook-YYYY-MM-DD.dump
   ```

   `--clean` drops each object before recreating it and `--if-exists` keeps that
   quiet when the object is not there, so this same command is correct whether
   the target is populated or freshly created. Restoring in place means the
   connection file keeps pointing at the right database and no secret has to be
   rewritten. Restoring into a *new* database instead is a bigger operation -
   `platform-deploy` owns that file - and is not this procedure.

3. Restore the image directory from the **matching** archive, preserving
   ownership and permissions:

   ```bash
   tar --numeric-owner -xzf cookbook-images-YYYY-MM-DD.tar.gz \
     -C /opt/docker/pior-labs/data/app-cookbook
   ```

4. Start the application and confirm readiness:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
   curl -fsS https://cookbook.szarans.ca/api/readiness
   ```

5. Reconcile the two halves. The command reports by default and changes nothing:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.production.yml \
     exec api node packages/api/dist/images/reconcile.js
   ```

   It exits non-zero when `missingKeys` is not empty, so this step can be
   scripted: a failing status means storage came back incomplete. Orphaned files
   alone still exit `0`, because they are not a restore failure.

   - `missingKeys` are recipes whose image files are **not** there. This is the
     serious direction and the one that decides whether the restore succeeded:
     it means the two halves came from different points in time. Restore the
     matching image archive rather than deleting anything.
   - `orphanedFolders` are files no recipe references. This count says nothing
     about restore quality - it reflects however much churn the directory has
     accumulated, since every photo replacement leaves the old folder behind for
     this command to collect. A drill against the development set found 100
     orphaned folders against 10 referenced ones, all of it ordinary history.
     Do not read a large number as a failed restore, and do not run `--delete`
     to tidy it until `missingKeys` is empty and the restore is confirmed good -
     against a half-restored database those "orphans" are live recipes.

6. Read a representative image end to end, as a signed-in browser would:

   open any recipe that has a photo and confirm the detail image renders. Image
   delivery is authenticated, so this is a browser check rather than a `curl`
   one. A `404` with a `Recipe image file is missing` line in the API log is the
   same failure `missingKeys` reports.

7. Confirm the application itself, not just its storage: sign in, open a recipe,
   scale its servings, and check Trash still lists what it listed before.

### When this was last exercised

2026-09-07, as a drill against the development database and image directory:
dumped, restored into a scratch database, extracted the image archive to a
scratch root, and reconciled the two. The dump/restore round-trip preserved
every row, the image archive extracted byte-identical with ownership intact, and
`missingKeys` was empty. Deliberately deleting one referenced folder then made
`missingKeys` report both of its variants, so step 5 does catch the mismatch it
exists to catch.

The drill also found that the reconciler exited `0` in that state, which would
have let a scripted restore check pass over an incomplete restore. It now exits
non-zero on missing files, covered by the reconcile command exit-status tests in
`packages/api/test/photos.test.ts`.

Not covered by that drill, because dev cannot exercise it: `sudo` access to the
platform secret file, PostgreSQL client/server versions on the production host,
and steps 6 and 7, which need the deployed application and a signed-in browser.
Run those against production before trusting this end to end.

## 5. Routine maintenance

- **Orphaned image files.** Interrupted uploads and post-commit cleanup failures
  leave files behind by design - the application never risks a recipe to tidy
  storage. Run the reconciler periodically and, once its report looks right,
  again with `--delete`.
- **Trash.** Phase 1 has no automatic retention policy
  ([decision 0005](./DECISIONS.md#0005---recoverable-recipe-deletion)). Trashed recipes
  keep their rows and image files until somebody deletes them permanently. That
  is deliberate: adding expiry is a product decision, not an operational one.

## 6. The MCP server

`cookbook-mcp-server` is a third container in the same stack
([decision 0006](./DECISIONS.md#0006---a-read-only-stdio-mcp-server-with-a-configured-acting-user)). It publishes no port, joins `pior_data` only, and has no route in
`platform-deploy`, so there is nothing to provision for it beyond the stack
itself. It reads the same platform-managed connection file as the API.

MCP can write meal plans and grocery lists through the shared application
services. Stop both API and MCP during a quiesced backup; their persisted data
is included in the same database dump. Recipe editing remains unavailable over
MCP. The container itself has no additional persistent volume to back up.

### One container per household member

`COOKBOOK_MCP_USER_EMAIL` names the household member the server acts as, and it
comes from the container's environment rather than from the client. `get_favorites`
therefore has exactly one possible subject.

A second household member needs a **second service** with their own address, not
a second client pointed at this one. The address must belong to someone who has
signed in through central SSO at least once - `service-auth` is the only thing
that creates Cookbook users - and an address naming nobody is a startup failure
rather than a server that answers with empty results.

### Checking it

The container's own process is `sleep infinity`; it serves no client and exists
only to hold the container open. So "is the process up" says nothing useful, and
the health check asks whether an `exec`'d session *would* work - database
reachable, configured user resolving:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml \
  ps mcp
docker inspect --format '{{.State.Health.Status}}' cookbook-mcp-server
```

An `unhealthy` container is a misconfiguration visible on the host, rather than
every client session failing with nothing to look at.

### Client setup

Each household member configures their own client to `exec` into the container
over SSH:

```sh
claude mcp add cookbook -- ssh <host> \
  "docker exec -i cookbook-mcp-server node packages/mcp-server/dist/index.js"
```

`-i` is required; without it the process gets no stdin and the failure looks
like a server that never answers. The container allocates no TTY, because a TTY
breaks the JSON-RPC framing.

The database password never reaches a client machine: PostgreSQL publishes no
host port, so the client needs SSH rather than a route to the database.

### When something is wrong

Logs are JSON on **stderr**; stdout carries the MCP protocol and nothing else.

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml \
  logs --tail 100 mcp
```

A session that connects and then goes quiet is usually a stray write to stdout
corrupting the protocol stream. `pnpm --filter @cookbook/mcp-server smoke` is
the check that catches that; no unit test can.

## 7. AI configuration and evaluation

Configure `COOKBOOK_AI_MODEL` with an OpenAI model supporting Responses API
structured outputs, and supply `OPENAI_API_KEY` only to the server environment.
The existing Compose `env_file` supplies it to API and MCP, not the web bundle.
No AI credential belongs in a `VITE_*` variable or in git.

For a server-managed file, have `platform-deploy` provision a readable secret,
set `PLATFORM_OPENAI_API_KEY_FILE` to its host path, and include the optional
`-f docker-compose.ai.yml` overlay when starting the stack. This mounts the same
read-only secret into API and MCP and sets `OPENAI_API_KEY_FILE`. Include that
overlay in subsequent Compose operations on this stack. Direct local runs can
set `OPENAI_API_KEY_FILE` to a readable local path instead.

The provider calls `https://api.openai.com/v1/responses` over outbound HTTPS.
MCP needs that egress as well as database access, but no inbound port or Caddy
route. `COOKBOOK_AI_TIMEOUT_MS` defaults to 20000 and accepts 100–60000. The
adapter bounds concurrent requests per process and falls back on overload.
Missing keys, missing model configuration, timeouts, refusals, and invalid
structured output leave grocery generation usable with exact-name matching.
Recommendations fall back to filtered choices with an explicit warning that
free-text preferences were not interpreted. These fallbacks are resilience,
not evidence that live AI is configured successfully.

`cookbook_ai` JSON events go to stderr and include model, latency, token usage,
validation/failure and fallback metadata. No recipe text, preference text, raw
provider response or credentials are logged. Normalization results and original
ingredient contributions can be inspected through the authenticated grocery list.

Before enabling a model or changing the normalization prompt, run the synthetic
evaluation against that configuration:

```bash
pnpm --filter @cookbook/domain build
pnpm --filter @cookbook/api eval:normalization
```

This command makes paid provider calls. It emits JSONL with each expected and
observed decision, automatic/review behavior, latency, usage and summary counts.
Optional `AI_EVAL_INPUT_USD_PER_MILLION` and `AI_EVAL_OUTPUT_USD_PER_MILLION` supply
current operator-verified prices for approximate cost comparison. Keep results
outside the source tree and compare runs for prompt/model changes; false merges,
missed merges and fallbacks cause a nonzero exit. Unit and integration tests use
fixtures and do not substitute for this live evaluation.
