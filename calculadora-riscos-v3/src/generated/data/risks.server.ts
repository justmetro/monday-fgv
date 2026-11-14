import { readProjectRiskItems } from '@generated/lib/fields';

export type RiskFilters = {
  aplicabilidade?: string;
  categoria?: string;
  grupo?: string;
  search?: string;
};

/** Carrega TODOS os riscos de um projeto no 09.4 e aplica os filtros no navegador. */
export async function loadProjectRisks(projectId: string, f: RiskFilters = {}) {
  const term = f.search?.toLowerCase();
  const items = (await readProjectRiskItems(projectId))
    .filter((i: any) => !f.aplicabilidade || i.aplicabilidade === f.aplicabilidade)
    .filter((i: any) => !f.categoria || (i.categoria ?? []).includes(f.categoria))
    .filter((i: any) => !f.grupo || (i.gruposDeOrigem ?? []).includes(f.grupo))
    .filter((i: any) => !term || i.name.toLowerCase().includes(term))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'));
  return { items, truncated: false };
}

export function parseGrau(v: string | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Converte falhas do monday em mensagens que o cliente sabe interpretar. */
export function toWriteError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (/permiss|unauthori|not authorized|forbidden|403|read.?only|viewer|guest|UserUnauthorized/i.test(msg)) {
    return new Error('SEM_PERMISSAO: o usuário não tem permissão de edição no quadro 09.4.');
  }
  return new Error('FALHA_GRAVACAO: não foi possível gravar no quadro 09.4.');
}
