import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { serverFnIds } from './serverfn-ids.mjs';
const r = (p) => path.resolve(p);
const alias = {
  '@tanstack/react-start': r('src/shims/server/react-start.ts'),
  '@vibe/db/server': r('src/shims/server/db.ts'), '@vibe/db': r('src/shims/server/db.ts'),
  '@api/current-user.server': r('src/shims/server/current-user.ts'),
  '@api/api-client.server': r('src/shims/server/api-client.ts'),
  '@api/ai-service': r('src/shims/server/ai-service.ts'),
};
const ids = { name: 'ids', setup(b) {
  b.onLoad({ filter: /generated\/server\/.*\.tsx?$/ }, async (a) => ({ contents: serverFnIds(fs.readFileSync(a.path, 'utf8'), a.path), loader: a.path.endsWith('x') ? 'tsx' : 'ts', resolveDir: path.dirname(a.path) }));
  b.onResolve({ filter: /^@(generated|shims|lib)\// }, (a) => {
    const [, root, rest] = a.path.match(/^@(generated|shims|lib)\/(.*)$/);
    const base = r(`src/${root}/${rest}`);
    for (const ext of ['', '.ts', '.tsx', '/index.ts']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext };
    return null;
  });
} };
await build({
  entryPoints: ['src/server/index.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node22',
  outfile: 'dist/server.mjs', alias, plugins: [ids], jsx: 'automatic',
  external: ['mongodb', '@mondaycom/apps-sdk', 'express', 'jsonwebtoken'],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pick = (n) => pkg.dependencies[n];
fs.writeFileSync('dist/package.json', JSON.stringify({ name: 'portfolio-projetos-server', version: '1.0.0', type: 'module', main: 'server.mjs', engines: { node: '>=24.22.1' },
  scripts: { start: 'node server.mjs' }, dependencies: { mongodb: pick('mongodb'), '@mondaycom/apps-sdk': pick('@mondaycom/apps-sdk'), express: pick('express'), jsonwebtoken: pick('jsonwebtoken') } }, null, 1));
console.log('servidor ok');
