import { eq } from 'drizzle-orm';
import { categories } from '../db/schema.js';
import type { DbExecutor } from './shared.js';

export interface CategoryRecord {
  id: number;
  name: string;
}

export async function findCategoryById(
  exec: DbExecutor,
  id: number,
): Promise<CategoryRecord | null> {
  const [row] = await exec
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  return row ?? null;
}
