import { type Projeto, codigoDe } from '@generated/lib/format';
import { isInativo } from '@generated/lib/board-options';
import { SGI_ORDEM } from '@generated/lib/status';

/** Key used for projects with the "Status SGI" column empty. */
export const SEM_STATUS_SGI = '__sem_status_sgi__';

export const rotuloSgi = (k: string) => (k === SEM_STATUS_SGI ? 'Sem status' : k);

/** Status SGI key of a project (empty → SEM_STATUS_SGI). */
export const chaveSgi = (p: Projeto) => p.statusSgi?.trim() || SEM_STATUS_SGI;

/**
 * Card / group order: process order, then labels that exist on the board or in the data but are
 * not in the known list, then "Sem status" (only when some project has it).
 */
export function ordemSgi(items: Projeto[], opcoesQuadro: string[]): string[] {
  const extras = new Set<string>();
  for (const o of opcoesQuadro) if (o && !SGI_ORDEM.includes(o)) extras.add(o);
  let semStatus = false;
  for (const p of items) {
    const k = chaveSgi(p);
    if (k === SEM_STATUS_SGI) semStatus = true;
    else if (!SGI_ORDEM.includes(k)) extras.add(k);
  }
  return [...SGI_ORDEM, ...extras, ...(semStatus ? [SEM_STATUS_SGI] : [])];
}

/** Active projects first (inactive = Finalizado/Pausado/Despriorizado/Sem planejamento), then by code. */
export function ordenarAtivosPorCodigo(a: Projeto, b: Projeto): number {
  const ia = isInativo(a.statusPlanejamento) ? 1 : 0;
  const ib = isInativo(b.statusPlanejamento) ? 1 : 0;
  if (ia !== ib) return ia - ib;
  const ca = codigoDe(a);
  const cb = codigoDe(b);
  if (ca && cb && ca !== cb) return ca.localeCompare(cb, 'pt-BR', { numeric: true });
  if (!ca !== !cb) return ca ? -1 : 1;
  return a.name.localeCompare(b.name, 'pt-BR');
}
