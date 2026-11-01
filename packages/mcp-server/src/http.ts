import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { begin, end, whenIdle } from './inflight.js';
import type { Logger } from './logger.js';
import { createServer } from './server.js';
import type { ActingUser } from './tools/helpers.js';

interface HttpOptions {
  publicUrl: URL;
  token: string;
}

export function createHttpListener(user: ActingUser, logger: Logger, options: HttpOptions) {
  const credential = createHash('sha256').update(`Bearer ${options.token}`).digest();
  const active = new Set<ReturnType<typeof createServer>['server']>();
  let stopping = false;

  const listener = createHttpServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const reply = (status: number) => { response.writeHead(status).end(); };
    if (stopping) return reply(503);
    // This is a liveness endpoint only, intentionally free of household data.
    // The container probe separately verifies database access and identity.
    if (request.url === '/health' && request.method === 'GET') return reply(200);

    // Validate the original Host, preserved by platform Caddy, rather than
    // trusting arbitrary forwarded headers. No browser cross-origin access is
    // needed; rejecting foreign origins also blocks DNS-rebinding attacks.
    if (request.headers.host !== options.publicUrl.host) return reply(403);
    if (request.headers.origin && request.headers.origin !== options.publicUrl.origin) return reply(403);
    if (request.url !== '/mcp') return reply(404);
    const supplied = createHash('sha256').update(request.headers.authorization ?? '').digest();
    if (!timingSafeEqual(credential, supplied)) {
      response.setHeader('WWW-Authenticate', 'Bearer realm="cookbook"');
      return reply(401);
    }
    // No server-pushed notifications or session state are needed by these
    // tools. Stateless requests avoid idle sessions holding server instances
    // indefinitely, and keep parallel desktop clients independent.
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return reply(405);
    }

    begin();
    const { server } = createServer(user, logger);
    active.add(server);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      active.delete(server);
      void server.close().catch(() => logger.error('Could not close HTTP MCP transport'));
      end();
    };
    response.once('close', cleanup);
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch {
      // Request headers, bodies and SDK errors can contain credentials or
      // imported content. Keep transport failures deliberately unadorned.
      logger.error('HTTP MCP request failed');
      if (!response.headersSent) reply(500);
      else response.destroy();
    }
  });

  return {
    listener,
    async stop(drainMs = 75_000) {
      stopping = true;
      listener.close();
      // Track replies as well as handlers. A disconnected client may still
      // have a tool persisting data; its handler remains tracked separately.
      await whenIdle(drainMs);
      listener.closeAllConnections();
      await Promise.all([...active].map((server) => server.close()));
    },
  };
}
