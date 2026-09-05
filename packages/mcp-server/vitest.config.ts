import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Workspace dependencies resolve to their build output at runtime, so tests
// would otherwise need `@cookbook/domain` and `@cookbook/api` built first. CI
// runs `pnpm test` before `pnpm build`, so pointing at the sources is what keeps
// the suite working from a clean checkout - and it removes any chance of testing
// against a stale `dist`. The API package's own test configuration does the same
// for the domain package.
export default defineConfig({
  resolve: {
    alias: {
      '@cookbook/domain': fileURLToPath(new URL('../domain/src/index.ts', import.meta.url)),
      '@cookbook/api/services': fileURLToPath(
        new URL('../api/src/services/index.ts', import.meta.url),
      ),
      '@cookbook/api/db': fileURLToPath(new URL('../api/src/db/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
