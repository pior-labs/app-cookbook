import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../errors.js';
import type { AppEnv } from './context.js';

// Deny-by-default authorization for `/api/*` (technical design section 6). The
// local user ID, email, and display name reach handlers only from the verified
// session; created-by, deleted-by, and per-user records are never accepted from
// a request body.

export type { AuthVariables } from './context.js';

export interface SessionUser {
  id: string | number;
  email: string;
  name: string;
}

// The seam between the HTTP boundary and Better Auth. Production passes the
// real session lookup; tests pass a stub so route authorization is exercised
// without a live OAuth provider.
export type SessionResolver = (headers: Headers) => Promise<SessionUser | null>;

function unauthorized(): ApiError {
  return new ApiError(401, 'unauthorized', 'Sign in to continue.');
}

export function createRequireAuth(resolveSession: SessionResolver): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = await resolveSession(c.req.raw.headers);

    if (!user) {
      throw unauthorized();
    }

    const userId = Number(user.id);
    if (!Number.isSafeInteger(userId)) {
      throw unauthorized();
    }

    c.set('userId', userId);
    c.set('userEmail', user.email);
    c.set('userName', user.name);

    await next();
  };
}
