import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseConnection } from '../env.js';
import * as relations from './relations.js';
import * as schema from './schema.js';

const connection = databaseConnection();
const client = postgres(connection.url, connection.options);

// The relational query API needs both the tables and their relations in the
// schema object passed to drizzle.
const fullSchema = { ...schema, ...relations };

export const db = drizzle(client, { schema: fullSchema });
export { schema };

export function closeDatabase(): Promise<void> {
  return client.end();
}
