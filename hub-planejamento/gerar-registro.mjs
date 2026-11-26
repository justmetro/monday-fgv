// Gera server/registry.ts com todos os módulos de src/generated/server que exportam createServerFn.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'src/generated/server';
const mods = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && /export const \w+\s*=\s*createServerFn\(/.test(readFileSync(`${dir}/${f}`, 'utf8')));
const lines = mods.map((f, i) => `import * as m${i} from '@generated/server/${f.replace(/\.tsx?$/, '')}';`);
lines.push(`export const MODULES: Record<string, Record<string, unknown>> = {`);
mods.forEach((f, i) => lines.push(`  ${JSON.stringify(f.replace(/\.tsx?$/, ''))}: m${i},`));
lines.push('};');
writeFileSync('server/registry.ts', lines.join('\n') + '\n');
console.log(`registry: ${mods.length} módulos`);
