import { defineConfig, devices } from '@playwright/test';

// The small critical-path browser suite from technical design section 14.
// Everything below it - domain rules, API behaviour, and screen state - is
// already covered by faster tests; these exist to prove the pieces are wired
// together in a real browser against a real database.

// Their own ports, so a run never fights a development server for one.
const API_PORT = process.env.E2E_API_PORT ?? '3102';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '5273';
const baseURL = `http://127.0.0.1:${WEB_PORT}`;

// Repository root: both servers are workspace commands.
const root = new URL('../../', import.meta.url).pathname;

export default defineConfig({
  testDir: './tests',
  // One database is shared by the run, so the suite is deliberately serial.
  // It is a handful of tests; parallelism would cost more in flakiness than it
  // saves in seconds.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: [
    {
      command: 'pnpm --filter @cookbook/api e2e:server',
      cwd: root,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { E2E_API_PORT: API_PORT },
      reuseExistingServer: false,
      stdout: 'pipe',
      timeout: 120_000,
    },
    {
      // The dev server rather than a preview of the build: it is the same
      // bundle the app runs on locally, and it proxies `/api` to the harness
      // exactly as it proxies to the development API.
      command: 'pnpm --filter @cookbook/web dev',
      cwd: root,
      url: baseURL,
      env: { WEB_PORT, API_PORT },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
