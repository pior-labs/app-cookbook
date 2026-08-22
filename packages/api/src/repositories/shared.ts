import { normalizeName } from '@cookbook/domain';
import { isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipes } from '../db/schema.js';

// Foundations shared by every repository. Repositories own database access
// only; transactions and orchestration live in services (technical design
// section 3).

// Categories, tags, and ingredients persist a `normalized_name` companion for
// case-insensitive uniqueness and search. Repositories always derive it with
// the shared domain rule so the application and the database seed agree.
export { normalizeName };

export type Database = typeof db;

// A repository method accepts either the base connection or an open
// transaction, so the same code runs inside and outside a transaction. This is
// the seam the recipe aggregate write path (slice 2) builds on.
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

// The default predicate for "live" recipes. Soft-deleted recipes are excluded
// everywhere except the explicit Trash repository path (section 10).
export function activeRecipe() {
  return isNull(recipes.deletedAt);
}

export function toIso(value: Date): string {
  return value.toISOString();
}
