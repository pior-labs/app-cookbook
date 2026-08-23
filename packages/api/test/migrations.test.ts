import { asc } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, db } from '../src/db/index.js';
import { categories } from '../src/db/schema.js';
import { STARTER_CATEGORIES, resetDatabase } from './helpers.js';

// The whole suite runs against a database built by applying every migration to
// an empty one, so this file asserts what the migrations are supposed to leave
// behind (technical design section 14.2).

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
