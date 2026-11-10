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

CI builds the API, web and MCP images on GitHub-hosted runners after both the
integration and browser jobs pass. Pull requests build without publishing;
pushes to `main` publish to `ghcr.io/pior-labs/app-cookbook-{api,web,mcp}`.
Each successful main run saves an attempt-specific release manifest containing
all three immutable image digests and the source commit. Production never builds
images or installs application dependencies.

### First activation

1. Merge the workflow changes, then wait for the **entire Cookbook CI run on
   main**, including **Build release images**, to succeed.
2. Confirm Actions can create the three GHCR packages. If a package already
   exists, grant this repository Actions access to it. Keep image visibility
   private unless publication is deliberately agreed. Do not delete images or
   release artifacts that are still deployed or retained for rollback.
3. The production runner needs Python 3, curl (with `--retry-all-errors`), Docker
   Compose supporting `up --wait`, and write access to the existing `DEPLOY_DIR`.
   Docker registry authentication uses this workflow's temporary `GITHUB_TOKEN`;
   no personal access token or permanent Docker login is required.
4. Set a literal `COMPOSE_PROJECT_NAME` in `APP_ENV` matching the existing
   production project (`cookbook` in `.env.example`). This keeps container and
   volume identity stable across release directories. Keep existing repository
   variables/secrets, including `APP_ENV`, `DEPLOY_DIR`
   and optional `COOKBOOK_MCP_HTTP_ENABLED`. The deployment job references the
   `PRODUCTION` environment; configure environment protections separately if
   desired. Merely naming an environment does not require reviewer approval.
5. Run the manual deployment below. Earlier CI runs without a release manifest
   cannot be deployed through this workflow. The existing installation continues
   running until this first deployment is requested.

### Deploy or redeploy

Open **Actions -> Cookbook CI**, select a successful **push to main** run, and
copy its numeric run ID from the URL (`.../actions/runs/<run-id>`). Open
**Actions -> Deploy Cookbook -> Run workflow**, select `main`, and enter that
ID in `ci_run_id`. This works for a configuration-only redeployment too; it uses
the current `APP_ENV` and HTTP MCP setting with the selected release's images
and Compose configuration. Pushing to main never deploys production.

A hosted job verifies the CI workflow identity, successful conclusion, main
history, attempt, artifact and image identities before using the production
runner. It rejects PR runs, failed runs, incomplete image sets, branch tags and
expired manifests. The source revision is checked out by SHA, not by a moving
branch. All production deployment requests share `cookbook-production` concurrency
and do not cancel an active deployment. Any future production maintenance
workflow must use that same group. GitHub may replace a pending request with a
newer pending request; it is not a FIFO deployment queue.

The runner stages each candidate beneath `$DEPLOY_DIR/releases/`, writes private
runtime configuration, and renders a Compose file with digest-only images and
all build definitions removed. It pulls all images before running migrations,
starts containers with building/pulling disabled, waits for API/web/MCP health,
and probes both `/api/readiness` and `/` through canonical HTTPS ingress.
Migrations run before the new API starts, while the old application may still
be serving requests. Schema changes must therefore remain compatible with both
versions during rollout. Use additive changes first and remove old structures
only after older versions are no longer rollback candidates.

### Deployment records and recovery

After successful readiness checks, `$DEPLOY_DIR/current` points to the private
runtime directory. Use its resolved configuration for server-side operations:

```bash
cd "$DEPLOY_DIR/current"
export COMPOSE_FILE="$PWD/compose.json"
docker compose ps
```

Use this `COMPOSE_FILE` for the backup/restore and MCP commands below, rather
than adding old source Compose overrides. The original root checkout is left
intact for the transition, but is no longer the active runtime configuration.
Runtime files contain secrets, must stay private, and must never be uploaded as
Actions artifacts or copied into source control.

`$DEPLOY_DIR/.deployments/current.json` records the last healthy commit, CI
run/attempt, image digests, runtime directory and deployment run. `previous.json`
preserves the preceding healthy record. `attempt.json` describes the latest
attempt, including failures. Failed pulls, migrations, startup or ingress checks
leave the successful records and `current` link unchanged, but may have changed
the database or running containers. Inspect `attempt.json` and its `runtime_dir`
when diagnosing a failure; `current` represents last verified success, not a
claim about the live containers after a failed attempt.

To roll application images back, find the earlier `run_id` in `previous.json`
and dispatch **Deploy Cookbook** with that ID. It uses the current secrets and
revalidates/redeploys that release. There is no automatic rollback and no schema
downgrade. Confirm the earlier application works with the current schema before
requesting rollback. If the database must be restored, use the coordinated
backup/restore procedure below instead. The first migration to this process has
no recorded previous release from the legacy source-build deployment.

Release manifests are retained in Actions for 90 days. Keep GHCR images for at
least as long as their eligible release manifests, and never remove a currently
used image. Expired manifests cannot be selected; rebuild a reviewed main
revision through CI to establish a new eligible release. Private host release
directories are retained for diagnosis; clean them up deliberately while keeping
the current, previous and latest attempted runtimes. Old runtime directories
contain historical secrets and should not accumulate indefinitely.

The long-running containers use `restart: unless-stopped` to recover when they
exit and to start again after Docker or the host restarts, unless explicitly
stopped. This does **not** restart a container that remains running but becomes
unhealthy during a network outage; health checks report that state without
triggering a restart. Restore connectivity and check health/readiness; if a
service does not recover, use the same redeploy workflow. The migration command
uses `docker compose run --rm`, which overrides the service's restart policy so
the migration remains a one-off job.

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
docker compose stop api mcp
pg_dump --format=custom --file=cookbook-$(date +%F).dump "$COOKBOOK_DATABASE_URL"
tar --numeric-owner -czf cookbook-images-$(date +%F).tar.gz \
  -C /opt/docker/pior-labs/data/app-cookbook images
docker compose start api mcp
```

`--numeric-owner` matters: the API container writes these files as its own uid,
and a restore that rewrites ownership leaves a directory the container cannot
read.

## 4. Restoring

1. Stop the application so nothing writes during the restore:

   ```bash
   docker compose down
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
   docker compose up -d
   curl -fsS https://cookbook.szarans.ca/api/readiness
   ```

5. Reconcile the two halves. The command reports by default and changes nothing:

   ```bash
   docker compose \
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
- **Trash.** There is no automatic retention policy
  ([decision 0005](./DECISIONS.md#0005---recoverable-recipe-deletion)). Trashed recipes
  keep their rows and image files until somebody deletes them permanently. That
  is deliberate: adding expiry is a product decision, not an operational one.

## 6. The MCP server

`cookbook-mcp-server` is a third container in the same stack
([decision 0006](./DECISIONS.md#0006---a-read-only-stdio-mcp-server-with-a-configured-acting-user)). It publishes no port, joins `pior_data` only, and has no route in
`platform-deploy`, so there is nothing to provision for it beyond the stack
itself. It reads the same platform-managed connection file as the API.

MCP can create explicitly approved recipes and write meal plans and grocery lists through the shared application
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
docker compose \
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
docker compose \
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

Recipe imports use `gpt-6-luna` by default, independently of the grocery model.
`COOKBOOK_IMPORT_MODEL` overrides it with an image-capable Responses model that
supports strict structured output. The same server key and request timeout apply.
Apply the recipe provenance migration before starting the updated API and MCP.
Import needs outbound HTTP(S) to public recipe pages and their photos in addition
to OpenAI; it has no inbound port or proxy change. Extraction failure leaves the
user able to enter a recipe manually. There is no guessed-recipe fallback.

Import previews and screenshots are transient and need no backup. Once saved,
original ingredient wording and import method live in PostgreSQL; an accepted
page photo uses the existing recipe-image volume and backup procedure. MCP
URL/text previews omit photo bytes; automatic page-photo attachment is in the web
review flow. Use a clear screenshot containing one recipe when a site blocks the
fetcher. The fetcher deliberately does not bypass logins or browser challenges.


## 8. Private HTTP MCP for ChatGPT desktop

Use the desktop app's direct Streamable HTTP MCP connection from a computer
that can reach Cookbook over LAN or Tailscale. The server acts as
`COOKBOOK_MCP_USER_EMAIL`, including all approved write tools, so provision a
separate instance for another member. That member must already have signed in
through central SSO. The existing SSH/stdio command remains available.

On the application host, create the credential outside the deployment checkout.
Run as the deployment administrator; make the file readable by the container's
runtime user, without making it world-readable:

```bash
sudo install -d -m 700 /opt/docker/pior-labs/secrets/app-cookbook
sudo sh -c 'umask 077; openssl rand -hex 32 > /opt/docker/pior-labs/secrets/app-cookbook/mcp-http-token'
```

Set these non-secret values in the production application environment (`APP_ENV`
for Actions). Never put the credential itself in Git or the client URL:

```dotenv
MCP_HTTP_PUBLIC_URL=https://cookbook.szarans.ca
PLATFORM_MCP_HTTP_TOKEN_FILE=/opt/docker/pior-labs/secrets/app-cookbook/mcp-http-token
```

Set repository variable `COOKBOOK_MCP_HTTP_ENABLED` to `true` and dispatch
**Deploy Cookbook** with a successful main CI run ID. The selected release must
contain the HTTP override. Its health probe checks the listener, database and
configured member, and its shutdown grace period lets tool writes finish.
Without the variable, the workflow intentionally uses the stdio-only configuration. Deploy/reload `platform-deploy`'s Cookbook Caddy
site with its `/mcp` route to `cookbook-mcp:3001`. Do not publish port 3001 or add
a router port forward. The existing private DNS and HTTPS certificate suffice.
A request to `https://cookbook.szarans.ca/mcp` without a credential should return
401; 502 means the upstream listener or edge network alias is unavailable.

In ChatGPT desktop, open **Settings → MCP servers → Add server**, select
**Streamable HTTP**, and use `https://cookbook.szarans.ca/mcp`. Supply the file's
credential as a Bearer Authorization header using the client's private settings.
Save and restart, then use `/mcp` to check the connection. For clients configured
through `~/.codex/config.toml`, the equivalent is:

```toml
[mcp_servers.cookbook]
url = "https://cookbook.szarans.ca/mcp"
bearer_token_env_var = "COOKBOOK_MCP_TOKEN"
```

The desktop process must inherit `COOKBOOK_MCP_TOKEN`. For a GUI launch that
doesn't inherit shell variables, set the Authorization header in private client
configuration instead; protect that file and keep it out of source control.
See the [official desktop MCP instructions](https://learn.chatgpt.com/docs/extend/mcp).
This direct desktop connection depends on the computer's network access; hosted
ChatGPT plugins do not gain access to a private LAN URL from this configuration.

To rotate or revoke access, replace the credential file and recreate the MCP
container (`docker compose up -d --no-build --pull never --force-recreate mcp`,
using the current runtime's `COMPOSE_FILE`, with no deployment in progress).
Recreation is required even for an in-place edit because credentials are loaded
once at startup; it also refreshes a bind mount after an atomic replacement.
Update the desktop credential, then verify that the old value returns 401.
To disable HTTP, unset the Actions variable and redeploy a successful CI release. The Caddy route then fails closed rather than serving recipe data.
