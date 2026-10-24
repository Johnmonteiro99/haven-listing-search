import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { resolveApiBaseUrl } from './src/api/config';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    resolveApiBaseUrl(loadEnv(mode, '.', 'VITE_').VITE_API_BASE_URL, true);
  }
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:8000' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
