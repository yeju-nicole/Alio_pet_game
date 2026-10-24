import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  build: {
    outDir: path.resolve(here, '../dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(here, 'index.html'),
        admin: path.resolve(here, 'admin.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules') && /\.(js|jsx|mjs)$/.test(id)) return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
});
