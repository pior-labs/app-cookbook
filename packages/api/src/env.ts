import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

export function databaseUrl(): string {
  const file = process.env.DATABASE_URL_FILE?.trim();
  if (file) {
    const value = readFileSync(file, 'utf8').trim();
    if (!value) throw new Error(`Database URL file is empty: ${file}`);
    return value;
  }

  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('Set DATABASE_URL or DATABASE_URL_FILE');
  }

  return value;
}

export function authConfig() {
  return {
    issuer: required('CENTRAL_AUTH_ISSUER'),
    clientId: required('CENTRAL_AUTH_CLIENT_ID'),
    clientSecret: required('CENTRAL_AUTH_CLIENT_SECRET'),
    publicBaseUrl: required('PUBLIC_BASE_URL'),
  };
}
