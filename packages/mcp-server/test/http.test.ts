import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { request } from 'node:http';
import { createHttpListener } from '../src/http.js';
import { createLogger } from '../src/logger.js';

const token = 'a-random-test-credential-with-at-least-32-characters';
const publicUrl = new URL('http://127.0.0.1');
const http = createHttpListener(
  { id: 1, name: 'Cook', email: 'cook@example.test' },
  createLogger('error'),
  { publicUrl, token },
);
let url: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => http.listener.listen(0, '127.0.0.1', resolve));
  publicUrl.port = String((http.listener.address() as AddressInfo).port);
  url = `${publicUrl.origin}/mcp`;
});
afterAll(async () => { await http.stop(); });

function connect() {
  const client = new Client({ name: 'desktop-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { client, transport };
}

describe('private HTTP MCP access', () => {
  it('connects independent real SDK clients and exposes the existing tools and acting member', async () => {
    await Promise.all([1, 2].map(async () => {
      const { client, transport } = connect();
      try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        expect(tools.some((tool) => tool.name === 'search_recipes')).toBe(true);
        expect(tools.some((tool) => tool.name === 'create_recipe')).toBe(true);
        expect(client.getInstructions()).toContain('acting as Cook');
        // A complete tool exchange without PostgreSQL or a live provider.
        const result = await client.callTool({ name: 'scale_recipe', arguments: {} });
        expect(result.isError).toBe(true);
      } finally {
        await client.close();
      }
    }));
  });

  it.each([undefined, 'Bearer wrong', `Basic ${token}`])('rejects missing or incorrect credentials (%s)', async (authorization) => {
    const result = await fetch(url, { method: 'POST', headers: authorization ? { authorization } : {} });
    expect(result.status).toBe(401);
    expect(result.headers.get('www-authenticate')).toContain('Bearer');
    expect(await result.text()).not.toContain(token);
  });

  it('rejects foreign browser origins even with a valid credential', async () => {
    const result = await fetch(url, { method: 'POST', headers: {
      authorization: `Bearer ${token}`, origin: 'https://untrusted.example',
    } });
    expect(result.status).toBe(403);
  });

  it('rejects a rebinding Host instead of trusting forwarded headers', async () => {
    // Node's fetch rewrites Host, so use the raw HTTP client to actually send
    // the rebinding header over the wire.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(url, { method: 'POST', headers: {
        authorization: `Bearer ${token}`, host: 'untrusted.example',
        'x-forwarded-host': publicUrl.host,
      } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      req.once('error', reject);
      req.end();
    });
    expect(status).toBe(403);
  });

  it('has no session or server-pushed stream to keep alive', async () => {
    const result = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    expect(result.status).toBe(405);
    expect(result.headers.get('allow')).toBe('POST');
  });

  it('keeps liveness data-free and declines unknown routes', async () => {
    const result = await fetch(`${publicUrl.origin}/health`);
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('');
    expect((await fetch(`${publicUrl.origin}/unknown`)).status).toBe(404);
  });
});
