import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { connectionOptions, namedDatabaseUrl } from './test-database-url.js';

// The API the browser suite runs against (technical design section 14.3). It is
// the real application - real routes, real database, real migrations - with one
// substitution: the session comes from a cookie the test sets rather than from
// central SSO. That is the "controlled authenticated test state" the design
// allows, so a browser run does not depend on a live OAuth provider.
//
// This lives in `test/`, which the build excludes, so no path through the
// shipped image can reach it.

const DATABASE_NAME = process.env.E2E_DATABASE_NAME ?? 'cookbook_e2e';

// Its own variable rather than `API_PORT`: importing the application's env
// module applies `.env.local`, which owns `API_PORT` for the development
// server, and a browser run must not fight a running dev API for the port.
const PORT = Number(process.env.E2E_API_PORT ?? 3102);

// Which seeded person the browser is acting as. A Playwright context sets this
// cookie, so "as one user without affecting another" is two browser contexts
// rather than two servers.
const USER_COOKIE = 'cookbook_e2e_user';

const E2E_USERS = [
  { name: 'Ada Lovelace', email: 'ada@example.test' },
  { name: 'Grace Hopper', email: 'grace@example.test' },
] as const;

const databaseUrl = namedDatabaseUrl(DATABASE_NAME, process.env.E2E_DATABASE_URL);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function cookieValue(header: string | null | undefined, name: string): string | undefined {
  return header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// `create database` cannot run against the database being created, so
// administration connects to the server's default one.
async function withAdminClient(run: (client: postgres.Sql) => Promise<void>): Promise<void> {
  const admin = connectionOptions(withDatabase(databaseUrl, 'postgres'));
  const client = postgres(admin.url, { ...admin.options, max: 1, onnotice: () => {} });

  try {
    await run(client);
  } finally {
    await client.end();
  }
}

// Every run starts from an empty migrated database, so a suite never inherits
// what a previous run left behind, and migration application is exercised by
// the browser suite too.
async function resetDatabase(): Promise<void> {
  await withAdminClient(async (client) => {
    await client.unsafe(`drop database if exists "${DATABASE_NAME}" with (force)`);
    await client.unsafe(`create database "${DATABASE_NAME}"`);
  });

  const target = connectionOptions(databaseUrl);
  const client = postgres(target.url, { ...target.options, max: 1 });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  await resetDatabase();

  const imageStorageDir = await mkdtemp(join(tmpdir(), 'cookbook-e2e-images-'));

  // Set before the application modules are imported: the database client and
  // the image directory are both resolved at import time. `NODE_ENV=test` stops
  // `.env.local` from overriding them back to the development values.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.DATABASE_URL_FILE;
  process.env.IMAGE_STORAGE_DIR = imageStorageDir;

  const [{ serve }, { createApp }, { createRequireAuth }, { db }, { users }] = await Promise.all([
    import('@hono/node-server'),
    import('../src/app.js'),
    import('../src/middleware/auth.js'),
    import('../src/db/index.js'),
    import('../src/db/schema.js'),
  ]);

  const seeded = await db
    .insert(users)
    .values(E2E_USERS.map((user) => ({ ...user, emailVerified: true })))
    .returning({ id: users.id, name: users.name, email: users.email });

  const byId = new Map(seeded.map((user) => [String(user.id), user]));
  const actingUser = (header: string | null | undefined) =>
    byId.get(cookieValue(header, USER_COOKIE) ?? '') ?? seeded[0];

  const app = createApp({
    requireAuth: createRequireAuth(async (headers) => actingUser(headers.get('cookie'))),
    // The web app decides it is signed in by reading this, and signs out by
    // posting to it. Nothing else in the auth surface is on the critical path.
    authHandler: (request) =>
      Response.json(
        new URL(request.url).pathname.endsWith('/get-session')
          ? { user: actingUser(request.headers.get('cookie')) }
          : {},
      ),
  });

  serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' });

  const shutdown = async () => {
    await rm(imageStorageDir, { recursive: true, force: true });
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  console.log(
    `Cookbook end-to-end API on http://127.0.0.1:${PORT} (database ${DATABASE_NAME}; ` +
      `${seeded.map((user) => `${USER_COOKIE}=${user.id} is ${user.name}`).join(', ')})`,
  );
}

await main();
