import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      { find: '@generated', replacement: r('src/generated') },
      { find: '@tanstack/react-start', replacement: r('src/shims/react-start-client.ts') },
      { find: /^@components\/ui\/.*$/, replacement: r('src/shims/ui/index.tsx') },
      { find: '@lib/utils', replacement: r('src/shims/lib/utils.ts') },
      { find: '@/router', replacement: r('src/shims/router.tsx') },
      { find: '@/context/MondayContextProvider', replacement: r('src/shims/MondayContextProvider.tsx') },
    ],
  },
  build: { outDir: 'deploy/public', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
