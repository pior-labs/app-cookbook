import { closeDatabase } from '@cookbook/api/db';
import { resolveUserByEmail } from '@cookbook/api/services';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpEnv } from './env.js';
import { describeCause } from './errors.js';
import { track, whenIdle } from './inflight.js';
import { createLogger } from './logger.js';
import { createServer } from './server.js';
import type { ActingUser } from './tools/helpers.js';

// The Cookbook MCP server (ADR 0006): read-only tools over stdio, acting as one
// configured household member.

// How long shutdown waits for in-flight work. Long enough for a tool call
// already talking to the database to finish and answer, short enough that a
// stuck one does not outlive the client that asked.
const SHUTDOWN_DRAIN_MS = 5_000;

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
  const shutdown = async (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { reason });

    try {
      // Let anything already running finish and be written before the transport
      // and the pool go away. Bounded, so a query that never returns cannot
      // keep this process alive past its client.
      await whenIdle(SHUTDOWN_DRAIN_MS);
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

  // A client that goes away without signalling closes stdin and nothing else,
  // and `StdioServerTransport` does not watch for that - it only listens for
  // `data` and `error`. Without this the process would sit on an idle
  // transport holding a database pool open, which the pool then holds the event
  // loop with, forever.
  //
  // That is not hypothetical here: the deployed shape is one long-running
  // container that clients `docker exec` into (ADR 0006 section 4), so an
  // abandoned process is not reaped by anything - it accumulates inside a
  // container that stays up, one leaked Postgres connection per session.
  //
  // Both events, because which one arrives depends on how stdin was handed to
  // us: a pipe at EOF emits `end` and then `close`, while a handle that is
  // simply closed may only emit `close`. `shutdown` is idempotent, so hearing
  // both costs nothing.
  const endOfInput = () => void shutdown('stdin closed');
  process.stdin.once('end', endOfInput);
  process.stdin.once('close', endOfInput);

  // Replies are counted as in-flight too. A handler returning is not the same
  // as its answer having reached the client, and shutting down in between loses
  // the reply to a call that had already done its work.
  const transport = new StdioServerTransport();
  const send = transport.send.bind(transport);
  transport.send = (message) => track(() => send(message));

  await server.connect(transport);

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
