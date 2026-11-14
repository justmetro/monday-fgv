import { getDataVersion } from '@generated/server/importer';

/** Versão atual dos dados, compartilhada entre os painéis da mesma tela (consulta curta, 30 s). */
let last: { at: number; p: Promise<string | null> } | null = null;
export function dataVersion(force = false): Promise<string | null> {
  if (!force && last && Date.now() - last.at < 30_000) return last.p;
  const p = getDataVersion({ data: {} }).then((r) => r?.version ?? null).catch((e) => { console.error('[cache] versão', e); return null; });
  last = { at: Date.now(), p };
  return p;
}
