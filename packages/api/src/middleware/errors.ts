import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ApiError } from '../errors.js';

// The only place an exception becomes a response body. Expected failures carry
// their own code and message; anything else is logged with the request ID and
// answered with a generic 500 so internals never leak (section 7.1).

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(
    { error: { code: 'not_found', message: 'This endpoint does not exist.', fields: {} } },
    404,
  );

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof ApiError) {
    return c.json(error.toBody(), error.status as ContentfulStatusCode);
  }

  if (error instanceof HTTPException) {
    return c.json(
      { error: { code: 'request_error', message: error.message, fields: {} } },
      error.status,
    );
  }

  console.error(
    JSON.stringify({
      requestId: c.get('requestId' as never) ?? null,
      method: c.req.method,
      route: c.req.routePath,
      message: 'Unhandled API error',
    }),
    error,
  );

  return c.json(
    { error: { code: 'internal_error', message: 'Something went wrong.', fields: {} } },
    500,
  );
};
