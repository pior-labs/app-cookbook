import { readFileSync } from 'node:fs';
import { z } from 'zod';

// Kept separate from stdio configuration: docker-exec clients must still work
// in an HTTP-enabled container without opening another listener or needing its
// credential. A file keeps the production credential out of Compose output.
export function httpEnv() {
  const parsed = z.object({
    MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    MCP_HTTP_PUBLIC_URL: z.url().default('https://cookbook.szarans.ca'),
    MCP_HTTP_TOKEN_FILE: z.string().trim().min(1),
  }).parse(process.env);
  const url = new URL(parsed.MCP_HTTP_PUBLIC_URL);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) {
    throw new Error('MCP_HTTP_PUBLIC_URL must be an HTTPS origin (HTTP is allowed only on loopback).');
  }
  const token = readFileSync(parsed.MCP_HTTP_TOKEN_FILE, 'utf8').trim();
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) {
    throw new Error('MCP_HTTP_TOKEN_FILE must contain a random base64url credential of at least 32 characters.');
  }
  return { port: parsed.MCP_HTTP_PORT, publicUrl: url, token };
}
