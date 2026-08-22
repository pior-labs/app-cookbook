import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import {
  adminDatabaseUrl,
  connectionOptions,
  testDatabaseName,
  testDatabaseUrl,
} from './test-database-url.js';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

async function withAdminClient(run: (client: postgres.Sql) => Promise<void>): Promise<void> {
  const admin = connectionOptions(adminDatabaseUrl());
  // `drop database if exists` emits a notice when the database is absent,
  // which is the normal first-run case.
  const client = postgres(admin.url, { ...admin.options, max: 1, onnotice: () => {} });

  try {
    await run(client);
  } finally {
    await client.end();
  }
}

async function dropTestDatabase(name: string): Promise<void> {
  await withAdminClient(async (client) => {
    await client.unsafe(`drop database if exists "${name}" with (force)`);
  });
}

// Creating the database from scratch and applying every migration to it makes
// migration application part of the test run, not just a deployment step.
export async function setup(): Promise<void> {
  const name = testDatabaseName();

  await dropTestDatabase(name);
  await withAdminClient(async (client) => {
    await client.unsafe(`create database "${name}"`);
  });

  const target = connectionOptions(testDatabaseUrl());
  const client = postgres(target.url, { ...target.options, max: 1 });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

export async function teardown(): Promise<void> {
  await dropTestDatabase(testDatabaseName());
}
