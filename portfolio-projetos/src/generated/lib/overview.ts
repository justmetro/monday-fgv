// Semáforo por área e projeto (Visão geral do Painel gerencial), com base nas inconsistências do Checklist.
import type { ProjectDoc } from '@generated/models';
import type { Model } from './metrics';
import { groupIdOf, parseConfig } from './fields';
import type { GlobalFilter, OpsModel, OpsScope } from './ops';
import { buildChecklist, type CheckArea } from './checklist';

export type Light = 'ok' | 'warn' | 'bad' | 'none';
export type AreaLight = { light: Light; text: string; count?: number };
export type ProjectRow = { p: ProjectDoc; ind: AreaLight; sched: AreaLight; prod: AreaLight; risk: AreaLight; total: { n: number; d: number; pct: number | null } };

/** Regra do farol: 0 inconsistências = Em dia · até 10% das verificações = Atenção · acima de 10% = Crítico. */
export const LIGHT_RULE = 'Farol pela proporção de inconsistências do Checklist sobre as verificações feitas no grupo: nenhuma = Em dia · até 10% = Atenção · acima de 10% = Crítico.';
const lightOf = (n: number, d: number): Light => (n === 0 ? 'ok' : n / Math.max(1, d) <= 0.1 ? 'warn' : 'bad');
const off = (txt: string): AreaLight => ({ light: 'none', text: txt });

export function overviewRows(projects: ProjectDoc[], model: Model | null, ops: OpsModel | null, _scope: OpsScope | null, _f: GlobalFilter): ProjectRow[] {
  const ids = new Set(projects.map((p) => p.boardId));
  const checks = buildChecklist(model, ops, (id) => ids.has(id));
  /** Inconsistências, verificações e checagens com pendência de um projeto nas áreas indicadas. */
  const tally = (b: string, areas: CheckArea[]) => {
    const list = checks.filter((c) => areas.includes(c.area));
    const n = list.reduce((a, c) => a + c.cases.filter((x) => x.projectBoardId === b).length, 0);
    const d = list.reduce((a, c) => a + (c.totalBy.get(b) ?? 0), 0);
    const failing = list.filter((c) => c.cases.some((x) => x.projectBoardId === b)).length;
    return { n, d, failing, of: list.length };
  };
  const lamp = (t: ReturnType<typeof tally>, emptyText: string): AreaLight =>
    t.d === 0 ? off(emptyText) : { light: lightOf(t.n, t.d), count: t.n, text: t.n ? `${t.n} item(ns) com inconsistência · distribuídos em ${t.failing} de ${t.of} regras do Checklist` : `Nenhuma inconsistência em ${t.of} checagens` };

  const ALL: CheckArea[] = ["Cronograma", "Riscos", "Produtos", "Indicadores", "Medições"];
  const rows = projects.map((p) => {
    const cfg = parseConfig(p.config);
    const b = p.boardId;
    const ind = p.noIndicators ? off('Sem indicador elaborado') : !model ? off('Carregando…') : lamp(tally(b, ['Indicadores', 'Medições']), 'Sem indicadores');
    const area = (g: 'sched' | 'prod' | 'risk', a: CheckArea, empty: string): AreaLight =>
      !groupIdOf(cfg, g) ? off('Não configurado') : !ops ? off('Carregando…') : lamp(tally(b, [a]), empty);
    return { p, ind, sched: area('sched', 'Cronograma', 'Sem atividades'), prod: area('prod', 'Produtos', 'Sem produtos'), risk: area("risk", "Riscos", "Sem riscos"),
      total: (() => { const t = tally(b, ALL); return { n: t.n, d: t.d, pct: t.d ? (t.n / t.d) * 100 : null }; })() };
  });
  // Maior percentual de inconsistências primeiro; sem avaliação no fim.
  return rows.sort((a, b) => (b.total.pct ?? -1) - (a.total.pct ?? -1));
}
