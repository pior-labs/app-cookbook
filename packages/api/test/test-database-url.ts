import { databaseUrl } from '../src/env.js';

// Integration tests run against a disposable database on the configured
// PostgreSQL server, never the development database (technical design
// section 14.2). `TEST_DATABASE_URL` overrides the derived name when a
// different target is needed.

function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

export function developmentDatabaseName(): string {
  return new URL(databaseUrl()).pathname.replace(/^\//, '') || 'cookbook';
}

export function testDatabaseName(): string {
  const override = process.env.TEST_DATABASE_URL?.trim();
  if (override) {
    return new URL(override).pathname.replace(/^\//, '');
  }

  return `${developmentDatabaseName()}_test`;
}

export function testDatabaseUrl(): string {
  const override = process.env.TEST_DATABASE_URL?.trim();
  return override || withDatabaseName(databaseUrl(), testDatabaseName());
}

// `create database` and `drop database` cannot run against the database being
// created or dropped, so administration connects to the server's default one.
export function adminDatabaseUrl(): string {
  return withDatabaseName(testDatabaseUrl(), 'postgres');
}

export function connectionOptions(url: string) {
  const parsed = new URL(url);
  const socketHost = parsed.searchParams.get('host');
  parsed.searchParams.delete('host');

  return { url: parsed.toString(), options: socketHost ? { host: socketHost } : {} };
}
