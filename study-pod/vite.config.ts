import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA lives in src/web; the build output (dist/) is served by the Worker's assets binding.
export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: { outDir: '../../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
