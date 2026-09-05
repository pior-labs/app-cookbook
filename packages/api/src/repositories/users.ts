import { eq, sql } from 'drizzle-orm';
import { users } from '../db/schema.js';
import type { DbExecutor } from './shared.js';

export interface HouseholdUser {
  id: number;
  name: string;
  email: string;
}

// Resolving a household member by address. `users.email` is unique, and
// `service-auth` remains the only authority allowed to create identities, so
// this looks an existing person up - it never creates one.
//
// The comparison is case-insensitive because an email typed into a client's
// configuration file is typed by a human, and `Pior@example.com` names the same
// person as `pior@example.com`. The stored address is left as it was written.
export async function findUserByEmail(
  exec: DbExecutor,
  email: string,
): Promise<HouseholdUser | null> {
  const [row] = await exec
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()))
    .limit(1);

  return row ?? null;
}
