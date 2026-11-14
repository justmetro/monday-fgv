import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';

const r = (p) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      { find: '@generated', replacement: r('src/generated') },
      { find: '@api/BoardSDK', replacement: r('src/shims/BoardSDK.js') },
      { find: '@lib/utils', replacement: r('src/shims/utils.js') },
      { find: /^@components\/ui\/(.*)$/, replacement: r('src/shims/ui') + '/$1.jsx' },
    ],
  },
  build: { outDir: 'deploy/public', emptyOutDir: true, chunkSizeWarningLimit: 6000 },
});
