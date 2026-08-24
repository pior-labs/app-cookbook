import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '');

  return {
    envDir: '../..',
    plugins: [react(), tailwindcss()],
    resolve: {
      // Cross-cutting modules (`@/components`, `@/lib`) import by alias, the
      // way the rest of the Pior Labs web apps do. Imports inside one feature
      // folder stay relative.
      alias: {
        '@': path.resolve(currentDir, './src'),
      },
    },
    server: {
      // Explicit IPv4 loopback rather than the `localhost` default. On hosts
      // that resolve `localhost` to `::1` first - GitHub's runners among them -
      // the dev server would bind IPv6 only, and everything that reaches it by
      // address (the browser suite, the API proxy below) would be refused.
      host: '127.0.0.1',
      port: Number(env.WEB_PORT || '5173'),
      strictPort: true,
      proxy: {
        '/api': `http://127.0.0.1:${env.API_PORT || '3002'}`,
      },
    },
  };
});
