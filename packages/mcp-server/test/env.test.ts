import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mcpEnv } from '../src/env.js';

// Configuration is the one thing that differs between a laptop and the
// application host, so it is the one thing local runs cannot exercise by
// accident. These cover the production arrangement specifically.

const KEYS = ['DATABASE_URL', 'DATABASE_URL_FILE', 'COOKBOOK_MCP_USER_EMAIL', 'MCP_LOG_LEVEL'];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('database configuration', () => {
  it('accepts a plain connection string', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/cookbook';
    process.env.COOKBOOK_MCP_USER_EMAIL = 'cook@example.test';

    expect(() => mcpEnv()).not.toThrow();
  });

  // The production arrangement: docker-compose.production.yml sets DATABASE_URL
  // to the empty string and supplies the credential through a mounted file, so
  // the password stays server-managed. Rejecting an empty DATABASE_URL here
  // would refuse to start in production while working everywhere else - which
  // is exactly what happened the first time this was deployed.
  it('accepts an empty DATABASE_URL when the credential comes from a file', () => {
    process.env.DATABASE_URL = '';
    process.env.DATABASE_URL_FILE = '/run/secrets/database_url';
    process.env.COOKBOOK_MCP_USER_EMAIL = 'cook@example.test';

    expect(() => mcpEnv()).not.toThrow();
  });

  it('treats a blank DATABASE_URL_FILE as absent too', () => {
    process.env.DATABASE_URL = '';
    process.env.DATABASE_URL_FILE = '   ';
    process.env.COOKBOOK_MCP_USER_EMAIL = 'cook@example.test';

    expect(() => mcpEnv()).toThrow(/DATABASE_URL_FILE/);
  });

  it('refuses to start with no database configured at all', () => {
    process.env.COOKBOOK_MCP_USER_EMAIL = 'cook@example.test';

    expect(() => mcpEnv()).toThrow(/set DATABASE_URL/);
  });
});

describe('the acting household member', () => {
  it('says what to set when it is missing, rather than reporting a schema type', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/cookbook';

    expect(() => mcpEnv()).toThrow(/set COOKBOOK_MCP_USER_EMAIL/);
  });

  it('rejects something that is not an address', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/cookbook';
    process.env.COOKBOOK_MCP_USER_EMAIL = 'not-an-address';

    expect(() => mcpEnv()).toThrow(/email address/);
  });

  it('returns the configured member and log level', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/cookbook';
    process.env.COOKBOOK_MCP_USER_EMAIL = 'cook@example.test';
    process.env.MCP_LOG_LEVEL = 'debug';

    expect(mcpEnv()).toEqual({ userEmail: 'cook@example.test', logLevel: 'debug' });
  });

  it('defaults the log level to info', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/cookbook';
    process.env.COOKBOOK_MCP_USER_EMAIL = 'cook@example.test';

    expect(mcpEnv().logLevel).toBe('info');
  });
});
