import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '');

  return {
    envDir: '../..',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5175,
      proxy: {
        '/api': `http://localhost:${env.API_PORT || '3002'}`,
      },
    },
  };
});
