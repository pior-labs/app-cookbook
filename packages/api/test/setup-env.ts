import { inject } from 'vitest';

// Runs in every test worker before any application module is imported, so the
// database singleton in `src/db/index.ts` connects to the disposable database
// this run created rather than the developer's local one. The name is decided
// by the global setup and injected here, because each worker is its own
// process.
process.env.DATABASE_URL = inject('testDatabaseUrl');
delete process.env.DATABASE_URL_FILE;
