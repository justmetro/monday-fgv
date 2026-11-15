import { type Projeto, toDate, today, daysBetween } from '@generated/lib/format';
import { canceladoAloc } from '@generated/lib/filtros';
import { etapasDe } from '@generated/lib/farol';
import { isInativo } from '@generated/lib/board-options';
import { normNome } from '@generated/lib/nomes';
import type { GerenteMapa } from '@generated/hooks/useMapaGerentes';


import { GROUP_ESTEIRA as GRUPO_ESTEIRA } from '@generated/lib/grupos';

/** Active = in the Esteira group and not in an inactive Status Planejamento. */
export function isAtivoNaEsteira(p: Projeto): boolean {
  return p.group?.id === GRUPO_ESTEIRA && !isInativo(p.statusPlanejamento);
}

function virtual(nome: string): GerenteMapa {
  return {
    id: `nome:${normNome(nome)}`, nome, nomeNorm: normNome(nome), cadastrado: false,
    perfil: [], pmi: [], qualificacao: [], statusQualificacao: null, atividadeAtual: null,
    email: null, local: null, fimAtuacao: null, desempenho: null, complexidade: null,
    totalProjetosMapa: null, itemIds: [], projetoIds: [], alocacoes: [],
  };
}

export type Via = 'relacao' | 'nome';

/**
 * Manager names of a project with the same precedence as the Carga tab: "Gerente" relation first
 * (linked Mapa item names), "Gerente" dropdown as fallback. Deduplicated by normalized name.
 */
export function nomesGerentesDe(p: Projeto): { key: string; nome: string }[] {
  const rel = (p.gerente?.linkedItems ?? []).map((li) => li.name ?? '').filter((n) => normNome(n));
  const fonte = rel.length ? rel : (p.gerente1 ?? []).filter((n) => normNome(n));
  const vistos = new Map<string, string>();
  for (const n of fonte) {
    const k = normNome(n);
    if (!vistos.has(k)) vistos.set(k, n.trim());
  }
  return [...vistos.entries()].map(([key, nome]) => ({ key, nome }));
}

/**
 * Links each 02.01 project to managers: "Gerente" relation first (matched by Mapa item id,
 * then by linked item name); if empty, the "Gerente" dropdown matched by normalized name.
 * Names that don't exist in the Mapa become "não cadastrado" managers.
 */
export function vincular(itemsBrutos: Projeto[], gerentes: GerenteMapa[]) {
  const items = itemsBrutos.filter((p) => !canceladoAloc(p));
  const porItem = new Map<string, GerenteMapa>();
  const porNome = new Map<string, GerenteMapa>();
  for (const g of gerentes) {
    for (const id of g.itemIds) porItem.set(id, g);
    porNome.set(g.nomeNorm, g);
  }
  const virtuais = new Map<string, GerenteMapa>();
  const achar = (nome: string) => {
    const k = normNome(nome);
    if (!k) return null;
    const g = porNome.get(k) ?? virtuais.get(k);
    if (g) return g;
    const v = virtual(nome.trim());
    virtuais.set(k, v);
    return v;
  };

  const doProjeto = new Map<string, { gerentes: GerenteMapa[]; via: Via }>();
  const semGerente: Projeto[] = [];
  for (const p of items) {
    const rel = p.gerente?.linkedItems ?? [];
    let gs: GerenteMapa[] = [];
    let via: Via = 'relacao';
    if (rel.length) {
      gs = rel
        .map((li) => porItem.get(String(li.id)) ?? (li.name ? achar(li.name) : null))
        .filter((g): g is GerenteMapa => !!g);
    }
    if (!gs.length) {
      via = 'nome';
      gs = (p.gerente1 ?? []).map((n) => achar(n)).filter((g): g is GerenteMapa => !!g);
    }
    const unicos = [...new Map(gs.map((g) => [g.id, g])).values()];
    if (unicos.length) doProjeto.set(p.id, { gerentes: unicos, via });
    else semGerente.push(p);
  }
  return { doProjeto, semGerente, virtuais: [...virtuais.values()] };
}

export function diasParaFim(fim: string | null): number | null {
  const d = toDate(fim);
  return d ? daysBetween(today(), d) : null;
}

/** "Fim de atuação em menos de N dias": only today or future dates (0 ≤ dias < N). */
export function dentroDoFim(dias: number | null, n: number): boolean {
  return dias !== null && dias >= 0 && dias < n;
}

/** Projects with at least one linked manager whose Fim de atuação falls in the next N days. */
export function filtrarPorFimAtuacao(items: Projeto[], gerentes: GerenteMapa[], n: number): Projeto[] {
  const { doProjeto } = vincular(items, gerentes);
  return items.filter((p) => (doProjeto.get(p.id)?.gerentes ?? []).some((g) => dentroDoFim(diasParaFim(g.fimAtuacao), n)));
}

export interface LinhaCarga {
  g: GerenteMapa;
  projetos: Projeto[];
  ativos: Projeto[];
  atrasadas: number;
  vencendo: number;
  valorAtivos: number;
  fimDias: number | null;
}

/** Only Atividade Atual = GERENTE (case/accent-insensitive) counts as a manager. */
export function isGerente(g: { atividadeAtual: string | null }): boolean {
  return normNome(g.atividadeAtual) === 'gerente';
}

/**
 * Single rule for the "Gerentes disponíveis" KPI and the "Só disponíveis" filter:
 * registered in the Mapa + Atividade Atual = GERENTE + 0 active projects in the esteira.
 */
export function isDisponivel(l: LinhaCarga): boolean {
  return l.g.cadastrado && isGerente(l.g) && l.ativos.length === 0;
}

export function montarCarga(itemsBrutos: Projeto[], gerentes: GerenteMapa[], filtroGerente: string[], mostrarNaoGerentes = false) {
  const items = itemsBrutos.filter((p) => !canceladoAloc(p));
  const { doProjeto, semGerente, virtuais } = vincular(items, gerentes);
  const todos = [...gerentes, ...virtuais];
  const porG = new Map<string, Projeto[]>(todos.map((g) => [g.id, []]));
  for (const p of items) for (const g of doProjeto.get(p.id)?.gerentes ?? []) porG.get(g.id)?.push(p);

  const sel = new Set(filtroGerente.map(normNome));
  const todasLinhas: LinhaCarga[] = todos
    .filter((g) => (sel.size ? sel.has(g.nomeNorm) : g.cadastrado || (porG.get(g.id)?.length ?? 0) > 0))
    .map((g) => {
      const projetos = porG.get(g.id) ?? [];
      const ativos = projetos.filter(isAtivoNaEsteira);
      let atrasadas = 0;
      let vencendo = 0;
      for (const p of ativos) for (const e of etapasDe(p)) {
        if (e.farol === 'atrasado') atrasadas++;
        if (e.farol === 'vence') vencendo++;
      }
      return {
        g, projetos, ativos, atrasadas, vencendo,
        valorAtivos: ativos.reduce((a, p) => a + (p.valorDoContrato ?? 0), 0),
        fimDias: diasParaFim(g.fimAtuacao),
      };
    });

  // Non-GERENTE people (or not registered) stay listed while they hold an ACTIVE project, so no
  // project disappears; the others only show with "Mostrar não gerentes" (or an explicit filter).
  const visivelPadrao = (l: LinhaCarga) => sel.size > 0 || (l.g.cadastrado && isGerente(l.g)) || l.ativos.length > 0;
  const linhas = todasLinhas.filter((l) => mostrarNaoGerentes || visivelPadrao(l));
  const naoGerentesOcultos = todasLinhas.filter((l) => !visivelPadrao(l)).length;

  // KPIs consider managers only (registered, Atividade Atual = GERENTE), independent of the toggle.
  const soGerentes = todasLinhas.filter((l) => l.g.cadastrado && isGerente(l.g));
  const comEsteira = soGerentes.filter((l) => l.ativos.length > 0);
  const kpis = {
    comEsteira: comEsteira.length,
    fim60: soGerentes.filter((l) => l.fimDias !== null && l.fimDias >= 0 && l.fimDias <= 60).length,
    disponiveis: todasLinhas.filter(isDisponivel).length,
  };
  return { linhas, todasLinhas, visivelPadrao, semGerente, kpis, doProjeto, naoGerentesOcultos };
}

/** "Gerente inativo": not registered in the Mapa or Atividade Atual ≠ GERENTE. */
export function isGerenteInativo(l: LinhaCarga): boolean {
  return !(l.g.cadastrado && isGerente(l.g));
}
