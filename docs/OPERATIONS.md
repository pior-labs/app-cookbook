# Cookbook operations

How Cookbook is provisioned, deployed, backed up, and restored. It expands
[`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) sections 15.2 and 15.3 into the
steps someone actually runs, and records who owns each one.

`platform-deploy` owns the server, reverse proxy, DNS, database provisioning,
and persistent host directories. `service-auth` owns identity. This repository
owns the application, its migrations, and its containers.

## 1. Provisioning checklist

These are external dependencies. Until every box is ticked, the deploy workflow
stays manual (`workflow_dispatch`) and the application cannot serve production
traffic.

### service-auth

- [ ] The `cookbook` client exists and is seeded with the production secret.
- [ ] Its registered callbacks include the canonical
      `https://cookbook.szarans.ca/api/auth/oauth2/callback/auth-pior` **and**
      the shared local one, `http://localhost:5173/api/auth/oauth2/callback/auth-pior`.

### platform-deploy

- [ ] Cookbook database and role provisioned.
- [ ] Connection file written to
      `/opt/docker/pior-labs/secrets/app-cookbook/database-url`, readable only
      by the deploy user, and referenced by `PLATFORM_DATABASE_URL_FILE`.
- [ ] Persistent image directory created at
      `/opt/docker/pior-labs/data/app-cookbook/images`, owned by the API
      container's user, and referenced by `PLATFORM_IMAGE_STORAGE_DIR`.
- [ ] The image directory is included in the same backup schedule as the
      database (see section 3 - they are one set).
- [ ] `pior_edge` and `pior_data` networks reachable by the app containers.
- [ ] Caddy routes `cookbook.szarans.ca/api/*` to `cookbook-api:3000` and
      everything else to `cookbook-web:80`.
- [ ] Split-horizon DNS resolves `cookbook.szarans.ca` inside and outside.

### This repository

- [ ] `DEPLOY_DIR` repository variable set.
- [ ] `APP_ENV` repository secret holds the production `.env`, including
      `PLATFORM_DATABASE_URL_FILE`, `PLATFORM_IMAGE_STORAGE_DIR`,
      `CENTRAL_AUTH_CLIENT_SECRET`, and a `BETTER_AUTH_SECRET` that is not
      shared with any other application.
- [ ] A self-hosted runner labelled `self-hosted, linux, prod` is online.

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

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml stop api
pg_dump --format=custom --file=cookbook-$(date +%F).dump "$COOKBOOK_DATABASE_URL"
tar --numeric-owner -czf cookbook-images-$(date +%F).tar.gz \
  -C /opt/docker/pior-labs/data/app-cookbook images
docker compose -f docker-compose.yml -f docker-compose.production.yml start api
```

`--numeric-owner` matters: the API container writes these files as its own uid,
and a restore that rewrites ownership leaves a directory the container cannot
read.

## 4. Restoring

1. Stop the application so nothing writes during the restore:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.production.yml down
   ```

2. Restore the database into an empty database, then point the connection file
   at it:

   ```bash
   pg_restore --clean --if-exists --dbname "$COOKBOOK_DATABASE_URL" cookbook-YYYY-MM-DD.dump
   ```

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

   - `orphanedFolders` are files no recipe references. After a clean restore
     this is usually empty; a few are expected if the files were captured after
     the dump. Remove them only once the restore is confirmed good, by re-running
     with `--delete`.
   - `missingKeys` are recipes whose image files are **not** there. This is the
     serious direction: it means the two halves came from different points in
     time. Restore the matching image archive rather than deleting anything.

6. Read a representative image end to end, as a signed-in browser would:

   open any recipe that has a photo and confirm the detail image renders. Image
   delivery is authenticated, so this is a browser check rather than a `curl`
   one. A `404` with a `Recipe image file is missing` line in the API log is the
   same failure `missingKeys` reports.

7. Confirm the application itself, not just its storage: sign in, open a recipe,
   scale its servings, and check Trash still lists what it listed before.

## 5. Routine maintenance

- **Orphaned image files.** Interrupted uploads and post-commit cleanup failures
  leave files behind by design - the application never risks a recipe to tidy
  storage. Run the reconciler periodically and, once its report looks right,
  again with `--delete`.
- **Trash.** Phase 1 has no automatic retention policy
  ([ADR 0005](./DECISIONS/0005-recoverable-recipe-deletion.md)). Trashed recipes
  keep their rows and image files until somebody deletes them permanently. That
  is deliberate: adding expiry is a product decision, not an operational one.
