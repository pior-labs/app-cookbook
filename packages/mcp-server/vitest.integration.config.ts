import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Real MCP transport and real domain services against the same disposable
// database harness used by the API. No production credentials/data are mutated.
export default defineConfig({
  root: fileURLToPath(new URL('../api', import.meta.url)),
  resolve: {
    alias: {
      '@cookbook/domain': fileURLToPath(new URL('../domain/src/index.ts', import.meta.url)),
      '@cookbook/api/services': fileURLToPath(
        new URL('../api/src/services/index.ts', import.meta.url),
      ),
      '@cookbook/api/db': fileURLToPath(new URL('../api/src/db/index.ts', import.meta.url)),
      '@modelcontextprotocol/sdk': fileURLToPath(
        new URL('./node_modules/@modelcontextprotocol/sdk/dist/esm', import.meta.url),
      ),
    },
  },
  test: {
    include: ['../mcp-server/test/**/*.integration.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    silent: 'passed-only',
  },
});
