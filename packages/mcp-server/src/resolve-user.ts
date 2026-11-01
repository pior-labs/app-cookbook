import { resolveUserByEmail } from '@cookbook/api/services';
import { describeCause } from './errors.js';
import type { ActingUser } from './tools/helpers.js';

// Both transports resolve the member before accepting traffic. A network
// listener must not defer an invalid identity until the first personal query.
export async function resolveActingUser(email: string): Promise<ActingUser> {
  let resolved;
  try {
    resolved = await resolveUserByEmail(email);
  } catch (error) {
    // This is the first database access. Postgres otherwise describes an
    // unreachable host as a failed select, sending operators after the query.
    throw new Error(`Could not reach the Cookbook database. ${describeCause(error)}`);
  }
  if (!resolved) {
    throw new Error(
      `COOKBOOK_MCP_USER_EMAIL is set to "${email}", which is not a Cookbook user. ` +
      'Household members are created by signing in through central SSO; sign in once in the browser, then start this server again.',
    );
  }
  return { id: resolved.id, name: resolved.name, email: resolved.email };
}
