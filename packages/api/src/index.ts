import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));
app.get('/api/health', (c) => c.json({ ok: true }));
app.get('/api/hello', (c) => c.json({ message: 'Pior Labs web app template' }));

const port = Number(process.env.API_PORT ?? 3000);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`API listening on :${port}`);
