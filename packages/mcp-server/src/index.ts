import { closeDatabase } from '@cookbook/api/db';
import { resolveUserByEmail } from '@cookbook/api/services';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpEnv } from './env.js';
import { createLogger } from './logger.js';
import { createServer } from './server.js';
import type { ActingUser } from './tools/helpers.js';

// The Cookbook MCP server (ADR 0006): read-only tools over stdio, acting as one
// configured household member.

// A driver error's `message` describes the statement that failed; the reason it
// failed - refused connection, unknown host, bad password - is on `cause`.
// Reporting only the message sends an operator looking at the wrong thing.
function describeCause(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause;
  if (cause instanceof Error && cause.message !== error.message) {
    return `${cause.message} (while running: ${error.message.split('\n')[0]})`;
  }

  return error.message.split('\n')[0];
}

async function main() {
  const env = mcpEnv();
  const logger = createLogger(env.logLevel);

  // Identity is resolved once, before the transport is connected. A server that
  // cannot say who it is acting as must not answer a single per-user question,
  // so this failing is fatal rather than deferred to the first tool call.
  //
  // This is also the first thing that touches the database, so it is where an
  // unreachable server shows up. Postgres reports that as a failed `select`,
  // which reads like a bug in this query rather than a connection problem -
  // hence the distinction below.
  let resolved;
  try {
    resolved = await resolveUserByEmail(env.userEmail);
  } catch (error) {
    throw new Error(`Could not reach the Cookbook database. ${describeCause(error)}`);
  }

  if (!resolved) {
    throw new Error(
      `COOKBOOK_MCP_USER_EMAIL is set to "${env.userEmail}", which is not a Cookbook user. ` +
        'Household members are created by signing in through central SSO; sign in once in the browser, then start this server again.',
    );
  }

  const user: ActingUser = { id: resolved.id, name: resolved.name, email: resolved.email };
  const { server, tools } = createServer(user, logger);

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { signal });

    try {
      await server.close();
      await closeDatabase();
      process.exitCode = 0;
    } catch (error) {
      logger.error('Unclean shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await server.connect(new StdioServerTransport());

  // Startup detail goes to stderr. stdout belongs to the transport.
  logger.info('Cookbook MCP server started', {
    transport: 'stdio',
    actingUser: user.email,
    toolsRegistered: tools.length,
    tools,
  });
}

main().catch(async (error) => {
  // The logger needs parsed configuration, which is the very thing that may
  // have failed, so startup failure is written plainly to stderr instead.
  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Cookbook MCP server failed to start',
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );

  process.exitCode = 1;

  // Identity resolution runs before the transport is connected, so a failure
  // here can leave an open connection pool behind - and an open pool holds the
  // event loop, which turns "refused to start" into a process that never exits
  // and a client that waits forever. Releasing it lets the process end on its
  // own, with stderr already flushed.
  try {
    await closeDatabase();
  } catch {
    // Nothing useful left to do: the original failure is already reported.
  }
});
