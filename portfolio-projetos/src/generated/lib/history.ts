import type { ProjectDoc } from '@generated/models';

/** Códigos ano/número em qualquer posição do nome; "2026 / 027" → "2026/027". Zeros à esquerda preservados. */
export function extractCodes(name: string | null | undefined): string[] {
  if (!name) return [];
  const out: string[] = [];
  for (const m of name.matchAll(/(?<!\d)((?:19|20)\d{2})\s*\/\s*(\d{1,4})(?!\d)/g)) {
    const c = `${m[1]}/${m[2]}`;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

export const isDuplicateName = (name: string | null | undefined) => !!name && /duplicata\s+de/i.test(name);

/** Mesmo ano e mesmo número sem considerar zeros à esquerda, mas grafia diferente (ex.: 2026/27 × 2026/027). */
export function isNearCode(a: string, b: string) {
  if (a === b) return false;
  const [ya, na] = a.split('/');
  const [yb, nb] = b.split('/');
  return ya === yb && !!na && !!nb && Number(na) === Number(nb);
}

export type HItem = {
  id: string; name: string; url: string;
  /** Código efetivo: coluna própria (se mapeada e preenchida) ou extraído do nome. */
  codes: string[];
  colCode: string | null;
  nameCodes: string[];
  codeConflict: string | null;
  duplicate: boolean;
  status: string | null; statusColor: string | null;
  managers: string[]; axes: string[];
};

export type MatchCase = 'unique' | 'noCode' | 'notFound' | 'multiHistory' | 'multiProject' | 'multiCode' | 'duplicate' | 'conflict' | 'confirmed';

export const CASE_LABEL: Record<MatchCase, string> = {
  conflict: 'Divergência entre a coluna de código e o nome no Histórico',
  unique: 'Correspondência única encontrada',
  noCode: 'Sem código identificado',
  notFound: 'Código não encontrado no Histórico',
  multiHistory: 'Mais de um elemento do Histórico com o mesmo código',
  multiProject: 'Mais de um projeto importado com o mesmo código',
  multiCode: 'Mais de um código identificado no mesmo nome',
  duplicate: 'Possível duplicata',
  confirmed: 'Vínculo confirmado',
};
export const AMBIGUOUS: string[] = ['multiHistory', 'multiProject', 'multiCode', 'duplicate', 'conflict'];

export type MatchRow = { boardId: string; name: string; codes: string[]; kase: MatchCase; candidateIds: string[]; nearIds: string[] };

type P = Pick<ProjectDoc, 'boardId' | 'name' | 'hLink' | 'hItemId'>;

export function matchProjects(projs: P[], items: HItem[]): MatchRow[] {
  const byCode = new Map<string, HItem[]>();
  items.forEach((h) => h.codes.forEach((c) => byCode.set(c, [...(byCode.get(c) ?? []), h])));
  const projByCode = new Map<string, number>();
  projs.forEach((p) => { const c = extractCodes(p.name); if (c.length === 1) projByCode.set(c[0]!, (projByCode.get(c[0]!) ?? 0) + 1); });
  return projs.map((p) => {
    const codes = extractCodes(p.name);
    const base = { boardId: p.boardId, name: p.name, codes, candidateIds: [] as string[], nearIds: [] as string[] };
    if (p.hLink === 'confirmed' && p.hItemId) return { ...base, kase: 'confirmed' as const, candidateIds: [p.hItemId] };
    if (codes.length === 0) return { ...base, kase: 'noCode' as const };
    if (codes.length > 1) return { ...base, kase: 'multiCode' as const, candidateIds: codes.flatMap((c) => (byCode.get(c) ?? []).map((h) => h.id)) };
    const code = codes[0]!;
    const cands = byCode.get(code) ?? [];
    const nearIds = items.filter((h) => h.codes.some((c) => isNearCode(code, c))).map((h) => h.id);
    const r = { ...base, candidateIds: cands.map((h) => h.id), nearIds };
    if (cands.length === 0) return { ...r, kase: 'notFound' as const };
    if (cands.length > 1) return { ...r, kase: 'multiHistory' as const };
    if ((projByCode.get(code) ?? 0) > 1) return { ...r, kase: 'multiProject' as const };
    if (isDuplicateName(p.name) || cands[0]!.duplicate) return { ...r, kase: 'duplicate' as const };
    if (cands[0]!.codeConflict) return { ...r, kase: 'conflict' as const };
    return { ...r, kase: 'unique' as const };
  });
}

// ——— Filtros de metadados (Status do Projeto, Gerente, Eixo) ———
export const NO_LINK = '__nolink__';
export const NONE = '__none__';
export type MetaFilter = { status: string[]; manager: string[]; axis: string[] };
export const EMPTY_META: MetaFilter = { status: [], manager: [], axis: [] };
export const metaActive = (f: MetaFilter | undefined) => !!f && (f.status.length + f.manager.length + f.axis.length) > 0;

/** Dentro de cada filtro: qualquer um dos valores; entre filtros: interseção. Um projeto conta uma única vez. */
export function metaOk(p: ProjectDoc | undefined, f: MetaFilter | undefined): boolean {
  if (!metaActive(f) || !f) return true;
  const linked = p?.hLink === 'confirmed';
  const test = (sel: string[], vals: string[]) => sel.length === 0 || sel.some((s) => (s === NO_LINK ? !linked : s === NONE ? linked && vals.length === 0 : linked && vals.includes(s)));
  return test(f.status, p?.hStatus ? [p.hStatus] : []) && test(f.manager, p?.hManagers ?? []) && test(f.axis, p?.hAxes ?? []);
}

export function metaOptions(projs: ProjectDoc[]) {
  const u = (a: string[]) => [...new Set(a)].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  const l = projs.filter((p) => p.hLink === 'confirmed');
  return { status: u(l.flatMap((p) => (p.hStatus ? [p.hStatus] : []))), manager: u(l.flatMap((p) => p.hManagers ?? [])), axis: u(l.flatMap((p) => p.hAxes ?? [])) };
}

/** IDs permitidos pelo filtro de metadados ([] = todos; sentinela quando nenhum passa). */
export function metaAllowedIds(projs: ProjectDoc[], f: MetaFilter): string[] {
  if (!metaActive(f)) return [];
  const ids = projs.filter((p) => metaOk(p, f)).map((p) => p.boardId);
  return ids.length ? ids : ['__nenhum__'];
}
