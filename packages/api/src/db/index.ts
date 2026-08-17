import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseConnection } from '../env.js';
import * as schema from './schema.js';

const connection = databaseConnection();
const client = postgres(connection.url, connection.options);

export const db = drizzle(client, { schema });
export { schema };

export function closeDatabase(): Promise<void> {
  return client.end();
}
