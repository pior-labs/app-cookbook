import { listCategories } from '@cookbook/api/services';
import { normalizeName } from '@cookbook/domain';

// Name-to-id lookups for the things a person names in conversation.
//
// This module is separate from `helpers.ts` on purpose: importing
// `@cookbook/api/services` pulls in the database module, which opens a
// connection at import time. Keeping the formatting helpers free of that import
// is what lets them be unit-tested without a database.

// Categories are named, not numbered, in anything a cook says. Matching uses
// the same normalization the application uses for case-insensitive uniqueness,
// so "dinner" finds "Dinner".
export async function findCategoryId(name: string): Promise<number | undefined> {
  const categories = await listCategories();
  const target = normalizeName(name);
  return categories.find((category) => normalizeName(category.name) === target)?.id;
}
