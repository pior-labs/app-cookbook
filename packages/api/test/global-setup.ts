import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';
import {
  adminDatabaseUrl,
  connectionOptions,
  testDatabaseName,
  testDatabaseUrl,
} from './test-database-url.js';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

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

// Only ever names the database this run created, so a suite running in parallel
// keeps its own. A hard kill (SIGKILL) skips teardown and leaves one behind;
// they are harmless and safe to drop by hand.
async function dropTestDatabase(name: string): Promise<void> {
  await withAdminClient(async (client) => {
    await client.unsafe(`drop database if exists "${name}" with (force)`);
  });
}

// Creating the database from scratch and applying every migration to it makes
// migration application part of the test run, not just a deployment step.
export async function setup(project: TestProject): Promise<void> {
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

  project.provide('testDatabaseUrl', testDatabaseUrl());
}

export async function teardown(): Promise<void> {
  await dropTestDatabase(testDatabaseName());
}
