import { saveSubitemsPart } from '@generated/server/importer';
import type { ProjectConfig } from '@generated/lib/fields';

/** Lê/grava os subelementos do Cronograma em partes (uma requisição curta por fatia de atividades). */
export async function runSubitemParts(boardId: string, config: ProjectConfig | null, onProgress?: (done: number, total: number) => void) {
  let offset: number | null = 0;
  let last = { ok: true, summary: '' };
  let guard = 0;
  while (offset !== null && guard++ < 500) {
    const r: Awaited<ReturnType<typeof saveSubitemsPart>> = await saveSubitemsPart({ data: { boardId, config: config ?? undefined, offset } });
    last = { ok: r.ok, summary: r.summary };
    if (!r.ok) return last;
    if (r.next !== null) onProgress?.(r.next, r.total);
    offset = r.next;
  }
  return last;
}
