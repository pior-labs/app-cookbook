import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './context.js';

// Every request carries an ID that appears in structured request and error logs
// and in the `x-request-id` response header, so a user-reported failure can be
// traced without logging tokens, cookies, secrets, recipe content, or image
// bytes (technical design section 16).

export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = c.req.header('x-request-id')?.trim() || randomUUID();

  c.set('requestId', requestId);
  c.header('x-request-id', requestId);

  const startedAt = Date.now();
  await next();

  // `userId` is set only once the auth middleware has run, so it is absent on
  // public routes and on rejected requests.
  const userId = c.get('userId') as number | undefined;

  console.log(
    JSON.stringify({
      requestId,
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
      ...(userId == null ? {} : { userId }),
    }),
  );
};
