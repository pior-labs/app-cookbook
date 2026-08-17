import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const overrideWithLocalConfig = process.env.NODE_ENV !== 'production';

config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  override: overrideWithLocalConfig,
});
config({
  path: fileURLToPath(new URL('../../.env.local', import.meta.url)),
  override: overrideWithLocalConfig,
});
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for drizzle-kit commands');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
});
