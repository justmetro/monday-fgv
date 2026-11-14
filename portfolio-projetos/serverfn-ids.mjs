// Dá a cada createServerFn um id estável "arquivo:nome", igual no cliente e no servidor.
import path from 'node:path';
export function serverFnIds(code, file) {
  const base = path.basename(file).replace(/\.(ts|tsx)$/, '');
  return code.replace(/export const (\w+) = createServerFn\(/g, (_m, name) => `export const ${name} = createServerFn('${base}:${name}', `);
}
