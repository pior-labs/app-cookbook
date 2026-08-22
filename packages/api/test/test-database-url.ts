import { databaseUrl } from '../src/env.js';

// Integration tests run against a disposable database on the configured
// PostgreSQL server, never the development database (technical design
// section 14.2). The name carries a per-run suffix so two suites running at
// once (a second terminal, a background agent) cannot drop each other's
// database mid-test. `TEST_DATABASE_URL` overrides the whole thing when a
// specific target is wanted; concurrent runs then share it by definition.

function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

function developmentDatabaseName(): string {
  return databaseNameOf(databaseUrl()) || 'cookbook';
}

function computeTestDatabaseUrl(): string {
  const override = process.env.TEST_DATABASE_URL?.trim();
  const resolved =
    override ??
    withDatabaseName(
      databaseUrl(),
      `${developmentDatabaseName()}_test_${process.pid.toString(36)}${Date.now()
        .toString(36)
        .slice(-4)}`,
    );

  // The global setup drops and recreates whatever this resolves to. A
  // hand-supplied `TEST_DATABASE_URL` that happens to name the database in
  // `DATABASE_URL` would therefore destroy real data, so refuse outright rather
  // than trusting the operator to have noticed.
  if (databaseNameOf(resolved) === developmentDatabaseName()) {
    throw new Error(
      `Refusing to run tests against "${developmentDatabaseName()}": the test database must ` +
        'not be the database named by DATABASE_URL. Unset or change TEST_DATABASE_URL.',
    );
  }

  return resolved;
}

// Memoized so the name is decided once per process. Only the global setup file
// calls this; test workers receive the resolved URL through Vitest's injected
// context.
let cached: string | undefined;

export function testDatabaseUrl(): string {
  cached ??= computeTestDatabaseUrl();
  return cached;
}

export function testDatabaseName(): string {
  return databaseNameOf(testDatabaseUrl());
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
