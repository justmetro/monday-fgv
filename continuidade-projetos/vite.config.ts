import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const r = (p: string) => path.resolve(__dirname, p);
const SERVER_DIR = r('src/generated/server') + path.sep;

function serverStubs(): Plugin {
  return {
    name: 'server-fn-stubs',
    enforce: 'pre',
    load(id) {
      const file = path.normalize(id.split('?')[0]);
      if (!file.startsWith(SERVER_DIR) || !/\.tsx?$/.test(file)) return null;
      const mod = path.basename(file).replace(/\.tsx?$/, '');
      const src = readFileSync(file, 'utf8');
      const names = [...src.matchAll(/export const (\w+)\s*=\s*createServerFn\(/g)].map((m) => m[1]);
      return [
        `import { serverFnStub } from '@tanstack/react-start';`,
        ...names.map((n) => `export const ${n} = serverFnStub(${JSON.stringify(`${mod}:${n}`)});`),
        names.length ? '' : 'export {};',
      ].join('\n');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serverStubs(), react(), tailwind()],
  resolve: {
    alias: [
      { find: '@tanstack/react-start', replacement: r('src/shims/react-start-client.ts') },
      { find: '@tanstack/react-router', replacement: r('src/shims/react-router.ts') },
      { find: '@vibe/db', replacement: r('src/shims/vibe-db.ts') },
      { find: '@generated', replacement: r('src/generated') },
      { find: '@components', replacement: r('src/components') },
      { find: '@lib', replacement: r('src/lib') },
      { find: '@/context/MondayContextProvider', replacement: r('src/shims/MondayContextProvider.tsx') },
      { find: /^@\/(.*)$/, replacement: r('src') + '/$1' },
    ],
  },
  build: { outDir: 'deploy/public', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
