import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/cookbook_test';
process.env.BETTER_AUTH_SECRET = 'test-only-cookbook-session-secret';
process.env.CENTRAL_AUTH_DISCOVERY_URL =
  'https://auth.szarans.ca/api/auth/.well-known/openid-configuration';
process.env.CENTRAL_AUTH_ISSUER = 'https://auth.szarans.ca/api/auth';
process.env.CENTRAL_AUTH_CLIENT_ID = 'cookbook';
process.env.CENTRAL_AUTH_CLIENT_SECRET = 'test-only-client-secret';

test('uses a Cookbook-specific cookie namespace', async () => {
  const { auth } = await import('../dist/auth.js');
  const context = await auth.$context;

  assert.equal(context.authCookies.sessionToken.name, 'cookbook.session_token');
  assert.equal(context.createAuthCookie('oauth_state').name, 'cookbook.oauth_state');
});
