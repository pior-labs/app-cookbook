import { testDatabaseUrl } from './test-database-url.js';

// Runs in every test worker before any application module is imported, so the
// database singleton in `src/db/index.ts` connects to the disposable test
// database rather than the developer's local one.
process.env.DATABASE_URL = testDatabaseUrl();
delete process.env.DATABASE_URL_FILE;
