import { db } from '../db/index.js';
import { findUserByEmail, type HouseholdUser } from '../repositories/index.js';

// Resolving a configured address to the household member it names.
//
// The HTTP boundary never needs this: there, identity arrives on a verified
// session and `requireAuth` puts the local user ID into the request context.
// A stdio MCP client has no session, so its acting user comes from
// configuration and is resolved once at startup instead (ADR 0006).
//
// This is a read. It cannot create a household member, so a typo in a client's
// configuration fails loudly rather than quietly inventing a person with an
// empty cookbook.
export async function resolveUserByEmail(email: string): Promise<HouseholdUser | null> {
  return findUserByEmail(db, email);
}

export type { HouseholdUser };
