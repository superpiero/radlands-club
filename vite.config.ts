import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/client',
  publicDir: '../../public',
  plugins: [react()],
  build: { outDir: '../../dist/client', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
  test: { root: '.', include: ['tests/**/*.test.ts'], testTimeout: 120000 },
} as any);
