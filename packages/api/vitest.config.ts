import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // `@cookbook/domain` resolves to its build output at runtime, so tests
      // would otherwise need the package built first. Pointing at the source
      // keeps a plain `pnpm test` working from a clean checkout and removes any
      // chance of testing against a stale `dist`.
      '@cookbook/domain': fileURLToPath(new URL('../domain/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    // One disposable database is shared by the suite, and each test resets it,
    // so files must not run concurrently against it.
    fileParallelism: false,
    // Structured request logs are useful when a test fails and noise when it
    // passes.
    silent: 'passed-only',
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
