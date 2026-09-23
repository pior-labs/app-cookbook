import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { closeDatabase, db } from '../src/db/index.js';
import { categories } from '../src/db/schema.js';
import { STARTER_CATEGORIES, resetDatabase } from './helpers.js';
import { connectionOptions } from './test-database-url.js';

// The whole suite runs against a database built by applying every migration to
// an empty one, so this file asserts what the migrations are supposed to leave
// behind.

afterAll(async () => {
  await closeDatabase();
});

describe('domain migration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('seeds the starter categories the test fixture expects', async () => {
    const rows = await db
      .select({ name: categories.name, normalizedName: categories.normalizedName })
      .from(categories)
      .orderBy(asc(categories.id));

    expect(rows.map((row) => row.name)).toEqual([...STARTER_CATEGORIES]);
    expect(rows.map((row) => row.normalizedName)).toEqual(
      STARTER_CATEGORIES.map((name) => name.toLowerCase()),
    );
  });
});

// Every other test sees a database migrated from empty, so a migration that
// reshapes existing rows is never exercised by them. This builds a scratch
// database at the migration before one-list-per-plan, fills it with the shape
// that migration has to fix, and then applies the rest.
describe('one grocery list per plan (0004)', () => {
  const ONE_LIST_PER_PLAN = 4;

  function urlFor(name: string): string {
    const url = new URL(inject('testDatabaseUrl'));
    url.pathname = `/${name}`;
    return url.toString();
  }

  async function withClient<T>(url: string, run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
    const target = connectionOptions(url);
    const client = postgres(target.url, { ...target.options, max: 1, onnotice: () => {} });
    try {
      return await run(client);
    } finally {
      await client.end();
    }
  }

  // The migrations folder as it stood before `index`, so the migrator can be
  // stopped there and then resumed with the real folder.
  async function migrationsBefore(index: number): Promise<string> {
    const source = fileURLToPath(new URL('../drizzle', import.meta.url));
    const folder = await mkdtemp(join(tmpdir(), 'cookbook-migrations-'));
    await mkdir(join(folder, 'meta'));
    const journal = JSON.parse(await readFile(join(source, 'meta', '_journal.json'), 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < index);
    await writeFile(join(folder, 'meta', '_journal.json'), JSON.stringify(journal));
    for (const entry of journal.entries as { tag: string }[])
      await copyFile(join(source, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
    return folder;
  }

  it('keeps each plan its newest list, marks it saved, and leaves a plan without one a draft', async () => {
    const name = `${new URL(inject('testDatabaseUrl')).pathname.slice(1)}_upgrade`;
    const admin = urlFor('postgres');
    const scratch = urlFor(name);
    const before = await migrationsBefore(ONE_LIST_PER_PLAN);

    await withClient(admin, (sql) => sql.unsafe(`drop database if exists "${name}" with (force)`));
    await withClient(admin, (sql) => sql.unsafe(`create database "${name}"`));
    try {
      await withClient(scratch, async (sql) => {
        await migrate(drizzle(sql), { migrationsFolder: before });

        const [{ id: user }] = await sql`
          insert into users (name, email) values ('Ada', 'ada@example.test') returning id`;
        const [{ id: shopped }] = await sql`
          insert into meal_plans (name, created_by_user_id, updated_by_user_id)
          values ('Shopped', ${user}, ${user}) returning id`;
        const [{ id: planning }] = await sql`
          insert into meal_plans (name, created_by_user_id, updated_by_user_id)
          values ('Planning', ${user}, ${user}) returning id`;
        // Three snapshots, oldest first, each with an item of its own.
        const lists: number[] = [];
        for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
          const [{ id }] = await sql`
            insert into grocery_lists
              (meal_plan_id, plan_version, normalization, created_by_user_id, updated_by_user_id, created_at)
            values (${shopped}, 1, 'fallback', ${user}, ${user}, ${`${day}T12:00:00Z`}) returning id`;
          await sql`insert into grocery_items (grocery_list_id, data)
            values (${id}, ${JSON.stringify({ name: `from ${day}` })}::jsonb)`;
          lists.push(id);
        }

        await migrate(drizzle(sql), {
          migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
        });

        const remaining = await sql`select id from grocery_lists where meal_plan_id = ${shopped}`;
        expect(remaining.map((row) => row.id)).toEqual([lists[2]]);
        const items = await sql`select data from grocery_items`;
        expect(items.map((row) => row.data.name)).toEqual(['from 2026-09-03']);

        const [saved] = await sql`select status, confirmed_at from meal_plans where id = ${shopped}`;
        expect(saved.status).toBe('confirmed');
        expect(new Date(saved.confirmed_at).toISOString()).toBe('2026-09-03T12:00:00.000Z');

        const [draft] = await sql`select status, confirmed_at from meal_plans where id = ${planning}`;
        expect(draft).toEqual({ status: 'draft', confirmed_at: null });

        // And the one-list rule now holds at the database.
        await expect(sql`
          insert into grocery_lists (meal_plan_id, plan_version, normalization, created_by_user_id, updated_by_user_id)
          values (${shopped}, 1, 'fallback', ${user}, ${user})`).rejects.toThrow();
      });
    } finally {
      await withClient(admin, (sql) => sql.unsafe(`drop database if exists "${name}" with (force)`));
      await rm(before, { recursive: true, force: true });
    }
  });
});
