import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpEnv } from '../src/http-env.js';

const dir = mkdtempSync(join(tmpdir(), 'cookbook-mcp-'));
const file = join(dir, 'token');
const token = 'test-credential-at-least-32-characters-long';
beforeEach(() => {
  writeFileSync(file, `${token}\n`);
  vi.stubEnv('MCP_HTTP_TOKEN_FILE', file);
  vi.stubEnv('MCP_HTTP_PUBLIC_URL', 'https://cookbook.szarans.ca');
  vi.stubEnv('MCP_HTTP_PORT', '3001');
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => rmSync(dir, { recursive: true }));

describe('HTTP startup configuration', () => {
  it('loads a mounted credential and canonical origin', () => {
    expect(httpEnv()).toEqual({ token, port: 3001, publicUrl: new URL('https://cookbook.szarans.ca') });
  });
  it('refuses a missing or weak credential', () => {
    writeFileSync(file, 'weak');
    expect(() => httpEnv()).toThrow(/credential/);
    vi.stubEnv('MCP_HTTP_TOKEN_FILE', join(dir, 'missing'));
    expect(() => httpEnv()).toThrow();
  });
  it.each(['http://cookbook.szarans.ca', 'https://user:pass@example.com', 'https://example.com/mcp', 'https://example.com/?token=abc'])('rejects unsafe public origins (%s)', (origin) => {
    vi.stubEnv('MCP_HTTP_PUBLIC_URL', origin);
    expect(() => httpEnv()).toThrow(/origin/);
  });
  it('allows loopback HTTP for development', () => {
    vi.stubEnv('MCP_HTTP_PUBLIC_URL', 'http://127.0.0.1:3001');
    expect(httpEnv().publicUrl.protocol).toBe('http:');
  });
});
