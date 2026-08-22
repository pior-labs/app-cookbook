import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const nodeEnv = process.env.NODE_ENV;
const overrideWithLocalConfig = nodeEnv !== 'production' && nodeEnv !== 'test';

// Local app configuration must beat unrelated shell variables during
// development. Production keeps the normal process/secrets-first precedence,
// and tests keep it too so the harness can point the process at its own
// disposable database without `.env.local` overriding it.
config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  override: overrideWithLocalConfig,
});
config({
  path: fileURLToPath(new URL('../../../.env.local', import.meta.url)),
  override: overrideWithLocalConfig,
});
config();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredEnvOrFile(name: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;

  const filePath = process.env[`${name}_FILE`]?.trim();
  if (!filePath) throw new Error(`Set ${name} or ${name}_FILE`);

  const fileValue = readFileSync(filePath, 'utf8').trim();
  if (!fileValue) throw new Error(`${name}_FILE is empty: ${filePath}`);
  return fileValue;
}

function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function databaseUrl(): string {
  return requiredEnvOrFile('DATABASE_URL');
}

export function databaseConnection() {
  const parsedUrl = new URL(databaseUrl());
  const socketHost = parsedUrl.searchParams.get('host');
  parsedUrl.searchParams.delete('host');

  return {
    url: parsedUrl.toString(),
    options: socketHost ? { host: socketHost } : {},
  };
}

export function appEnv() {
  const betterAuthUrl = process.env.BETTER_AUTH_URL?.trim() || 'http://localhost:5175';

  return {
    apiPort: Number(process.env.API_PORT ?? 3002),
    betterAuthSecret: requiredEnv('BETTER_AUTH_SECRET'),
    betterAuthUrl,
    betterAuthTrustedOrigins: parseOrigins(
      process.env.BETTER_AUTH_TRUSTED_ORIGINS || betterAuthUrl,
    ),
    centralAuth: {
      providerId: 'auth-pior',
      discoveryUrl: requiredEnv('CENTRAL_AUTH_DISCOVERY_URL'),
      issuer: requiredEnv('CENTRAL_AUTH_ISSUER'),
      clientId: requiredEnv('CENTRAL_AUTH_CLIENT_ID'),
      clientSecret: requiredEnv('CENTRAL_AUTH_CLIENT_SECRET'),
    },
  } as const;
}
