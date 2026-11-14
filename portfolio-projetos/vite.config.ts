import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';
import { serverFnIds } from './serverfn-ids.mjs';
const r = (p: string) => path.resolve(__dirname, p);
const empty = r('src/shims/client/empty.ts');
const ids: Plugin = { name: 'server-fn-ids', enforce: 'pre', transform(code, id) { return id.includes('/generated/server/') ? serverFnIds(code, id) : null; } };
export default defineConfig({
  base: './',
  plugins: [ids, TanStackRouterVite({ routesDirectory: r('src/generated/routes'), generatedRouteTree: r('src/routeTree.gen.ts'), autoCodeSplitting: false }), react()],
  resolve: {
    alias: [
      { find: '@tanstack/react-start', replacement: r('src/shims/client/react-start.ts') },
      { find: /^@vibe\/db(\/server)?$/, replacement: empty },
      { find: /^@api\/(current-user\.server|api-client\.server|ai-service)$/, replacement: empty },
      { find: /^@shims\/server\/.*$/, replacement: empty },
      { find: '@generated', replacement: r('src/generated') },
      { find: '@components', replacement: r('src/components') },
      { find: '@lib', replacement: r('src/lib') },
      { find: '@shims', replacement: r('src/shims') },
    ],
  },
  build: { outDir: 'dist/public', chunkSizeWarningLimit: 4000 },
});
