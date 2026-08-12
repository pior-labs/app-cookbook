import { readFileSync } from 'node:fs';

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
