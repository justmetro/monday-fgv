import type { Changes } from '@generated/server/projetos';
import { type Projeto, toDate } from '@generated/lib/format';
import { normNome } from '@generated/lib/nomes';

export const STATUS_KEYS = ['statusPlanejamento', 'statusSgi', 'prioridade', 'radarMonitoramento', 'alocaoDeEquipe', 'dimensionamentoConcludo'] as const;
export const DATE_KEYS = ['incioPlanejamento', 'conclusoDoPlanejamento', 'conclusoRegistroSgi', 'conclusoDoDimensionamento', 'dataValidaoSgi'] as const;
export const NUM_KEYS = ['valorDoContrato', 'equipeOr', 'equipePlan', 'oradoInsumos', 'planejadoInsumos', 'oradoTotal', 'planejadoTotal'] as const;
export const DD_KEYS = ['eixo', 'uf', 'tipoPlanejamento', 'gerente1'] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];
export type DateKey = (typeof DATE_KEYS)[number];
export type NumKey = (typeof NUM_KEYS)[number];
export type DdKey = (typeof DD_KEYS)[number];

export const LABEL: Record<StatusKey | DateKey | NumKey | DdKey | 'gerente' | 'alocaoGerente', string> = {
  alocaoGerente: 'Alocação Gerente',
  gerente: 'Gerente (relação)',
  statusPlanejamento: 'Status Planejamento', statusSgi: 'Status SGI', prioridade: 'Prioridade',
  radarMonitoramento: 'Radar Monitoramento', alocaoDeEquipe: 'Alocação de Equipe', dimensionamentoConcludo: 'Dimensionamento concluído?',
  incioPlanejamento: 'Início Planejamento', conclusoDoPlanejamento: 'Conclusão do Planejamento',
  conclusoRegistroSgi: 'Conclusão Registro SGI', conclusoDoDimensionamento: 'Conclusão do Dimensionamento', dataValidaoSgi: 'Data Validação SGI',
  valorDoContrato: 'Valor do Contrato', equipeOr: 'Equipe Orç', equipePlan: 'Equipe Plan', oradoInsumos: 'Orçado Insumos',
  planejadoInsumos: 'Planejado Insumos', oradoTotal: 'Orçado Total', planejadoTotal: 'Planejado Total',
  eixo: 'Eixo', uf: 'UF', tipoPlanejamento: 'Tipo Planejamento', gerente1: 'Gerente',
};

export interface Draft {
  status: Record<StatusKey, string>;
  dates: Record<DateKey, string>;
  nums: Record<NumKey, string>;
  dds: Record<DdKey, string[]>;
  /** "Gerente" relation (items of the Mapa de Gerentes). */
  rel: { id: string; name: string }[];
  /** When the relation changes, also align the "Gerente" dropdown (checked by default). */
  syncDd: boolean;
}

export function relAlterada(p: Projeto, d: Draft): boolean {
  const atual = (p.gerente?.linkedItems ?? []).map((i) => String(i.id));
  const novo = d.rel.map((r) => r.id);
  return !(atual.length === novo.length && atual.every((x) => novo.includes(x)));
}

/** Dropdown values matching the chosen relation names (existing label by normalized name, else the name). */
export function ddAlvoDaRelacao(d: Draft, ddOpts: string[]): string[] {
  return d.rel.map((r) => ddOpts.find((o) => normNome(o) === normNome(r.name)) ?? r.name.trim()).filter(Boolean);
}

export function ddDivergeDaRelacao(d: Draft, ddOpts: string[]): boolean {
  const alvo = ddAlvoDaRelacao(d, ddOpts).map(normNome);
  const atual = d.dds.gerente1.map(normNome);
  return !(alvo.length === atual.length && alvo.every((x) => atual.includes(x)));
}

function isoDay(v: unknown): string {
  const d = toDate(v);
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const mapKeys = <K extends string, V>(keys: readonly K[], fn: (k: K) => V) =>
  Object.fromEntries(keys.map((k) => [k, fn(k)])) as Record<K, V>;

export function draftFrom(p: Projeto): Draft {
  return {
    status: mapKeys(STATUS_KEYS, (k) => p[k] ?? ''),
    dates: mapKeys(DATE_KEYS, (k) => isoDay(p[k])),
    nums: mapKeys(NUM_KEYS, (k) => (p[k] === null || p[k] === undefined ? '' : String(p[k]))),
    dds: mapKeys(DD_KEYS, (k) => [...(p[k] ?? [])]),
    rel: (p.gerente?.linkedItems ?? []).map((i) => ({ id: String(i.id), name: i.name ?? '' })),
    syncDd: true,
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Only the fields that differ from the current item, already in write format. */
export function diffDraft(p: Projeto, d: Draft, ddGerenteOpts: string[] = []): { changes: Changes; invalid: string[] } {
  const base = draftFrom(p);
  const changes: Changes = {};
  const invalid: string[] = [];
  for (const k of STATUS_KEYS) if (d.status[k] !== base.status[k]) changes[k] = d.status[k] || null;
  for (const k of DATE_KEYS) if (d.dates[k] !== base.dates[k]) changes[k] = d.dates[k] || null;
  for (const k of NUM_KEYS) {
    const raw = d.nums[k].trim().replace(',', '.');
    if (raw === base.nums[k]) continue;
    if (raw === '') { changes[k] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) invalid.push(LABEL[k]);
    else if (n !== p[k]) changes[k] = n;
  }
  for (const k of DD_KEYS) if (!sameSet(d.dds[k], base.dds[k])) changes[k] = d.dds[k];
  if (relAlterada(p, d)) {
    changes.gerente = d.rel.length ? { linkedItems: d.rel.map((r) => ({ id: r.id })) } : null;
    if (d.syncDd && ddDivergeDaRelacao(d, ddGerenteOpts)) {
      const alvo = ddAlvoDaRelacao(d, ddGerenteOpts);
      if (!sameSet(alvo, base.dds.gerente1)) changes.gerente1 = alvo;
      else delete changes.gerente1;
    }
  }
  return { changes, invalid };
}

export function precisaConfirmar(c: Changes): boolean {
  return c.statusPlanejamento !== undefined || c.gerente !== undefined || NUM_KEYS.some((k) => c[k] !== undefined);
}

export function camposAlterados(c: Changes): string[] {
  return (Object.keys(c) as (keyof Changes)[]).filter((k) => c[k] !== undefined).map((k) => LABEL[k]);
}

/** Optimistic local copy with the edited (non-calculated) values applied. */
export function aplicarLocal(p: Projeto, c: Changes): Projeto {
  const next: Projeto = { ...p };
  for (const k of STATUS_KEYS) if (c[k] !== undefined) next[k] = c[k] ?? null;
  for (const k of NUM_KEYS) if (c[k] !== undefined) next[k] = c[k] ?? null;
  for (const k of DD_KEYS) if (c[k] !== undefined) next[k] = c[k] ?? null;
  for (const k of DATE_KEYS) {
    const v = c[k];
    if (v !== undefined) next[k] = v ? new Date(`${v}T00:00:00.000Z`) : null;
  }
  return next;
}
