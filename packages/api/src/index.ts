import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import postgres from 'postgres';
import { auth } from './auth.js';
import { requireAuth, type AuthVariables } from './auth-middleware.js';
import { appEnv, databaseConnection } from './env.js';

const env = appEnv();
const app = new Hono<{ Variables: AuthVariables }>();
const service = {
  name: 'Pior Labs Cookbook API',
  slug: 'cookbook',
  phase: 'Phase 1 — Core Cookbook',
  version: '0.1.0',
} as const;

app.get('/health', (c) => c.json({ status: 'ok', service: service.slug }));
app.get('/api/health', (c) => c.json({ status: 'ok', service: service.slug }));
app.get('/api', (c) => c.json(service));
app.get('/api/readiness', async (c) => {
  const connection = databaseConnection();
  const client = postgres(connection.url, { ...connection.options, max: 1 });

  try {
    await client`select 1`;
    return c.json({ status: 'ready', service: service.slug, database: 'connected' });
  } catch (error) {
    console.error('Database readiness check failed', error);
    return c.json({ status: 'not_ready', service: service.slug, database: 'unavailable' }, 503);
  } finally {
    await client.end();
  }
});

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

app.use('/api/*', requireAuth);

app.get('/api/hello', (c) =>
  c.json({
    message: 'Cookbook API is authenticated.',
    user: {
      id: c.get('userId'),
      email: c.get('userEmail'),
      name: c.get('userName'),
    },
  }),
);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((error, c) => {
  console.error('Unhandled API error', error);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = env.apiPort;

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`${service.name} listening on http://0.0.0.0:${port}`);
