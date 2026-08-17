import type { MiddlewareHandler } from 'hono';
import { auth } from './auth.js';

export interface AuthVariables {
  userId: number;
  userEmail: string;
  userName: string;
}

export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('userId', userId);
  c.set('userEmail', session.user.email);
  c.set('userName', session.user.name);

  await next();
};
