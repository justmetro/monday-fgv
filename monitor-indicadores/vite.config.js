import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
const r = (p) => path.resolve(__dirname, p);
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@generated': r('src/generated'), '@components': r('src/components'), '@lib': r('src/lib'), '@api': r('src/api') } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 3000 },
});
