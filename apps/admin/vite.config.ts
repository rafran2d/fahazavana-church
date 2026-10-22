/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // En dev, /api est relayé vers l'API NestJS : pas de souci de CORS ni d'URL à configurer
      proxy: { '/api': { target: env.VITE_API_PROXY ?? 'http://localhost:3000', changeOrigin: true } },
    },
    test: { environment: 'node' },
  };
});
