import { defineConfig } from 'vitest/config';

export default defineConfig({
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
