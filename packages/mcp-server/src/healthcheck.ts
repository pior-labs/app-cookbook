// Container health probe.
//
// A stdio MCP server has no port to check, and the long-running container's own
// process is only holding the container open - clients get their own process
// through `docker exec`. So "healthy" means the things an exec'd session needs
// are actually in place: the database is reachable, and the configured acting
// user resolves to a real household member.
//
// Checking identity here matters. A typo in COOKBOOK_MCP_USER_EMAIL fails at
// startup for the exec'd process, which the client reports as a server that
// would not start; failing the health check instead surfaces it on the host,
// where it can be fixed.
import { closeDatabase } from '@cookbook/api/db';
import { resolveUserByEmail } from '@cookbook/api/services';
import { mcpEnv } from './env.js';

try {
  const env = mcpEnv();
  const user = await resolveUserByEmail(env.userEmail);

  if (!user) {
    throw new Error(`COOKBOOK_MCP_USER_EMAIL "${env.userEmail}" is not a Cookbook user.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
