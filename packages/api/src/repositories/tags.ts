import { inArray } from 'drizzle-orm';
import { tags } from '../db/schema.js';
import type { DbExecutor } from './shared.js';

export interface TagRecord {
  id: number;
  name: string;
}

// Returns only the tags that exist. Callers compare the count to decide whether
// the request referenced a tag that has since been deleted.
export async function findTagsByIds(exec: DbExecutor, ids: number[]): Promise<TagRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  return exec
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.id, ids));
}
