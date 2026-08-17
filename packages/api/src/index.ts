import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import postgres from 'postgres';
import { databaseUrl } from './env.js';

const app = new Hono();
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
  const client = postgres(databaseUrl(), { max: 1 });

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

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((error, c) => {
  console.error('Unhandled API error', error);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = Number(process.env.API_PORT ?? 3000);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`${service.name} listening on :${port}`);
