import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './context.js';

// Every request carries an ID that appears in structured request and error logs
// and in the `x-request-id` response header, so a user-reported failure can be
// traced without logging tokens, cookies, secrets, recipe content, or image
// bytes (technical design section 16).

// An inbound request ID is echoed back and written into every log line for the
// request, and this middleware runs ahead of authorization. Bounding length and
// charset stops an anonymous caller from using the log as a dumping ground.
const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;

function inboundRequestId(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length > MAX_REQUEST_ID_LENGTH || !SAFE_REQUEST_ID.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = inboundRequestId(c.req.header('x-request-id')) ?? randomUUID();

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
