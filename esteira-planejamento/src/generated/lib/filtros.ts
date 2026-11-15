import type { Projeto } from '@generated/lib/format';

import { SEM_PONTO_FOCAL, normNome } from '@generated/lib/nomes';

import { GROUP_ESTEIRA } from '@generated/lib/grupos';

const STATUS_CANCELADOS = ['Sem planejamento [ANTIGOS]', 'Despriorizado'];
const TIPOS_CANCELADOS = ['antigo sem planejamento', 'planejamento antigo'];

/** "Cancelados": Status Planejamento Sem planejamento [ANTIGOS] / Despriorizado, or Tipo Planejamento Antigo Sem Planejamento / Planejamento antigo. */
export function cancelado(p: Projeto): boolean {
  if (p.statusPlanejamento && STATUS_CANCELADOS.includes(p.statusPlanejamento)) return true;
  return (p.tipoPlanejamento ?? []).some((t) => TIPOS_CANCELADOS.includes(normNome(t)));
}

const HIST_EM_EXECUCAO = ['execucao', 'em execucao', 'encerramento', 'em planejamento'];

/** Mirror "Status Histórico de Projetos" = Execução / Em execução / Encerramento / Em Planejamento. */
export function historicoEmExecucao(p: Projeto): boolean {
  return (p.statusHistricoDeProjetos?.displayValue ?? '').split(',').map(normNome).some((s) => HIST_EM_EXECUCAO.includes(s));
}

/**
 * Cancelled for Alocação de Gerentes and Carga por gerente: Despriorizado always; "antigos" (Sem planejamento
 * [ANTIGOS] / Tipo antigo) only when the Histórico mirror is NOT in execution — old projects still running count.
 */
export function canceladoAloc(p: Projeto): boolean {
  if (!cancelado(p)) return false;
  if (p.statusPlanejamento === 'Despriorizado') return true;
  return !historicoEmExecucao(p);
}

export interface FiltrosState {
  /** Global: show projects with Status Planejamento "Finalizado (Plan + SGI)" (hidden by default). */
  includeFinalizados: boolean;
  /** Visão geral only: show Status Planejamento hidden by default. */
  includeNovo30: boolean;
  includeNovo45: boolean;
  includePausado: boolean;
  eixo: string[];
  uf: string[];
  gerente: string[];
  tipoPlanejamento: string[];
  prioridade: string[];
  pontoFocal: string[];
  meus: boolean;
  search: string;
  /** Quick filter: manager's Fim de atuação in less than N days (0 = off). Needs the Mapa. */
  fimAtuacao: 0 | 15 | 30 | 45 | 60;
}

export const FILTROS_INICIAIS: FiltrosState = {
  includeFinalizados: false,
  includeNovo30: false,
  includeNovo45: false,
  includePausado: false,
  eixo: [], uf: [], gerente: [], tipoPlanejamento: [], prioridade: [], pontoFocal: [],
  meus: false,
  search: '',
  fimAtuacao: 0,
};

/** Pre-normalized fields per item so filtering is a cheap pass over memory. */
export interface Indice {
  p: Projeto;
  texto: string[];
  gerentes: string[];
  pf: string[];
}

export function indexar(base: Projeto[]): Indice[] {
  return base.map((p) => ({
    p,
    texto: [normNome(p.name), normNome(p.cdigoProjeto)].filter(Boolean),
    gerentes: [...(p.gerente1 ?? []), ...(p.gerente?.linkedItems ?? []).map((i) => i.name ?? '')].map(normNome).filter(Boolean),
    pf: (p.pontoFocal ?? []).map((x) => String(x.id)),
  }));
}

const anyOf = (vals: string[] | null | undefined, sel: Set<string>) => (vals ?? []).some((v) => sel.has(v));
const oneOf = (v: string | null | undefined, sel: Set<string>) => !!v && sel.has(v);

/** Same rules the server used to apply: every filter is AND; values inside a filter are OR. */
/**
 * `antigosEmExecucao` (Carga por gerente): old projects (cancelled elsewhere) whose Histórico mirror is still in
 * execution are kept — same rule as Alocação (canceladoAloc); every other filter still applies.
 */
export function filtrar(idx: Indice[], f: FiltrosState, termo: string, meId: string | null, op: { antigosEmExecucao?: boolean } = {}) {
  const s = {
    eixo: new Set(f.eixo), uf: new Set(f.uf), tipo: new Set(f.tipoPlanejamento), prio: new Set(f.prioridade),
    pf: new Set(f.pontoFocal),
    ger: new Set(f.gerente.map(normNome).filter(Boolean)),
  };
  const q = normNome(termo);
  const escopo = idx.filter(({ p, texto, gerentes, pf }) => {
    const g = p.group?.id;
    if (g !== GROUP_ESTEIRA) return false; // Histórico is always out
    // "Cancelados" are never shown (any group).
    if (op.antigosEmExecucao ? canceladoAloc(p) : cancelado(p)) return false;
    if (!f.includeFinalizados && p.statusPlanejamento === 'Finalizado (Plan + SGI)') return false;
    if (s.eixo.size && !anyOf(p.eixo, s.eixo)) return false;
    if (s.uf.size && !anyOf(p.uf, s.uf)) return false;
    if (s.tipo.size && !anyOf(p.tipoPlanejamento, s.tipo)) return false;
    if (s.prio.size && !oneOf(p.prioridade, s.prio)) return false;
    if (s.ger.size && !gerentes.some((n) => s.ger.has(n))) return false;
    if (s.pf.size && !((s.pf.has(SEM_PONTO_FOCAL) && pf.length === 0) || pf.some((id) => s.pf.has(id)))) return false;
    if (q && !texto.some((t) => t.includes(q))) return false;
    return true;
  });
  const meus = meId ? escopo.filter((x) => x.pf.includes(meId)) : [];
  return {
    items: (f.meus && meId ? meus : escopo).map((x) => x.p),
    meusCount: meId ? meus.length : null,
  };
}

const ordenar = (v: Iterable<string>) => [...v].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** Filter options derived from the loaded base (Esteira + Histórico). */
export function opcoesDe(base: Projeto[]) {
  const sets = { eixo: new Set<string>(), uf: new Set<string>(), tipo: new Set<string>(), prio: new Set<string>() };
  const ddGer = new Set<string>();
  const relGer = new Set<string>();
  const pessoas = new Map<string, string>();
  const add = (set: Set<string>, v: string | null | undefined) => { if (v?.trim()) set.add(v); };
  for (const p of base) {
    for (const v of p.eixo ?? []) add(sets.eixo, v);
    for (const v of p.uf ?? []) add(sets.uf, v);
    for (const v of p.tipoPlanejamento ?? []) add(sets.tipo, v);
    add(sets.prio, p.prioridade);
    for (const v of p.gerente1 ?? []) add(ddGer, v);
    for (const li of p.gerente?.linkedItems ?? []) add(relGer, li.name?.trim());
    for (const x of p.pontoFocal ?? []) if (x?.id !== undefined) pessoas.set(String(x.id), x.name?.trim() || `Usuário ${x.id}`);
  }
  // Union of dropdown labels and relation names, deduplicated by normalized name (dropdown wins).
  const gerentes = new Map<string, string>();
  for (const nome of [...ordenar(ddGer), ...ordenar(relGer)]) {
    const k = normNome(nome);
    if (k && !gerentes.has(k)) gerentes.set(k, nome.trim());
  }
  return {
    eixo: ordenar(sets.eixo),
    uf: ordenar(sets.uf),
    gerente: ordenar(gerentes.values()),
    tipoPlanejamento: ordenar(sets.tipo),
    prioridade: ordenar(sets.prio),
    pontoFocal: [...pessoas.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  };
}

export type Opcoes = ReturnType<typeof opcoesDe>;
