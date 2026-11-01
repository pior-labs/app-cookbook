import { closeDatabase } from '@cookbook/api/db';
import { mcpEnv } from './env.js';
import { httpEnv } from './http-env.js';
import { createHttpListener } from './http.js';
import { createLogger } from './logger.js';
import { resolveActingUser } from './resolve-user.js';

async function main() {
  const env = mcpEnv();
  const http = httpEnv();
  const logger = createLogger(env.logLevel);
  const user = await resolveActingUser(env.userEmail);
  const { listener, stop } = createHttpListener(user, logger, http);
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await stop();
      await closeDatabase();
    } catch {
      logger.error('Unclean HTTP MCP shutdown');
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(http.port, '0.0.0.0', resolve);
  });
  logger.info('Cookbook HTTP MCP server started', { port: http.port, actingUser: user.email });
}

main().catch(async () => {
  // Configuration errors may contain environment values; never print a schema
  // exception here, since it could reproduce the credential path or contents.
  process.stderr.write('Cookbook HTTP MCP server failed to start; check HTTP configuration, database and acting user.\n');
  process.exitCode = 1;
  await closeDatabase();
});
