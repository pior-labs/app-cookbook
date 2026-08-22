import { serve } from '@hono/node-server';
import { createApp, service } from './app.js';
import { auth } from './auth.js';
import { appEnv } from './env.js';
import { createRequireAuth } from './middleware/auth.js';

const env = appEnv();

const app = createApp({
  requireAuth: createRequireAuth(async (headers) => {
    const session = await auth.api.getSession({ headers });
    return session?.user ?? null;
  }),
  authHandler: (request) => auth.handler(request),
});

const port = env.apiPort;

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`${service.name} listening on http://0.0.0.0:${port}`);
