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

// Whatever resolves through here is dropped and recreated, so a URL that
// happens to name the database in `DATABASE_URL` would destroy real data.
// Refuse outright rather than trusting the operator to have noticed.
function assertDisposable(url: string, source: string): string {
  if (databaseNameOf(url) === developmentDatabaseName()) {
    throw new Error(
      `Refusing to run tests against "${developmentDatabaseName()}": the test database must ` +
        `not be the database named by DATABASE_URL. Unset or change ${source}.`,
    );
  }

  return url;
}

// A disposable database with a name the caller chooses, for a harness that
// needs a stable target rather than a per-run one. The end-to-end server uses
// it so a failed run can still be inspected afterwards.
export function namedDatabaseUrl(name: string, override?: string): string {
  const chosen = override?.trim();

  return assertDisposable(
    chosen || withDatabaseName(databaseUrl(), name),
    chosen ? 'the override' : 'the database name',
  );
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

  return assertDisposable(resolved, 'TEST_DATABASE_URL');
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
