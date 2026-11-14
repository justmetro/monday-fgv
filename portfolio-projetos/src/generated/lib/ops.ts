// Modelo dos grupos operacionais: relações por ID (nunca por nome), pendências e filtros comuns.
import type { ProductDoc, ProjectDoc, RiskDoc, ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';
import { EMPTY_PRODUCT_STATUS, EMPTY_RISK_STATUS, EMPTY_SCHEDULE_STATUS, norm, parseConfig, type ProjectConfig } from './fields';
import { EMPTY_META, metaOk, type MetaFilter } from './history';

export type OpsDataset = { projects: ProjectDoc[]; schedule: ScheduleItemDoc[]; subitems: ScheduleSubitemDoc[]; products: ProductDoc[]; risks: RiskDoc[]; loadedAt: string };
export type OpsIssue = { entity: 'atividade' | 'subatividade'; projectBoardId: string; itemId: string; name: string; detail: string };
export const k = (b: string, i: string) => `${b}:${i}`;

export type OpsModel = ReturnType<typeof buildOpsModel>;

export function buildOpsModel(ds: OpsDataset) {
  const projectBy = new Map(ds.projects.map((p) => [p.boardId, p]));
  const cfgBy = new Map<string, ProjectConfig | null>(ds.projects.map((p) => [p.boardId, parseConfig(p.config)]));
  const prodBy = new Map(ds.products.map((p) => [k(p.projectBoardId, p.itemId), p]));
  const subsOf = new Map<string, ScheduleSubitemDoc[]>();
  ds.subitems.forEach((s) => { const kk = k(s.projectBoardId, s.parentItemId); subsOf.set(kk, [...(subsOf.get(kk) ?? []), s]); });
  const issues: OpsIssue[] = [];
  const check = (x: ScheduleItemDoc | ScheduleSubitemDoc, entity: OpsIssue['entity']) => {
    if (x.unmapped.includes('produto')) return;
    const hasProdGroup = !!cfgBy.get(x.projectBoardId)?.productGroupId;
    if (x.produtoIds.length === 0) issues.push({ entity, projectBoardId: x.projectBoardId, itemId: x.itemId, name: x.name, detail: `${entity === 'atividade' ? 'Atividade' : 'Subatividade'} sem produto vinculado.` });
    else if (hasProdGroup) x.produtoIds.filter((id) => !prodBy.has(k(x.projectBoardId, id))).forEach((id) => issues.push({ entity, projectBoardId: x.projectBoardId, itemId: x.itemId, name: x.name, detail: `Vinculada ao item ${id}, que não foi importado como produto.` }));
  };
  ds.schedule.forEach((x) => check(x, 'atividade'));
  ds.subitems.forEach((x) => check(x, 'subatividade'));

  const sst = (b: string) => cfgBy.get(b)?.scheduleStatus ?? EMPTY_SCHEDULE_STATUS;
  const pst = (b: string) => cfgBy.get(b)?.productStatus ?? EMPTY_PRODUCT_STATUS;
  const rst = (b: string) => cfgBy.get(b)?.riskStatus ?? EMPTY_RISK_STATUS;
  const isDone = (x: { projectBoardId: string; status: string | null }) => !!x.status && sst(x.projectBoardId).concluded.includes(x.status);
  const isExcluded = (x: { projectBoardId: string; status: string | null }) => !!x.status && sst(x.projectBoardId).excluded.includes(x.status);
  const health = (x: ScheduleItemDoc): 'ok' | 'warn' | 'bad' | 'none' => {
    const s = sst(x.projectBoardId);
    if (!x.saude) return 'none';
    if (s.healthBad.includes(x.saude)) return 'bad';
    if (s.healthWarn.includes(x.saude)) return 'warn';
    if (s.healthOk.includes(x.saude)) return 'ok';
    return 'none';
  };
  const isDelivered = (p: ProductDoc) => !!p.entregaReal || (!!p.status && pst(p.projectBoardId).delivered.includes(p.status));
  const isPaid = (p: ProductDoc) => !!p.statusPagamento && pst(p.projectBoardId).paid.includes(p.statusPagamento);
  /** Posição 0..n-1 do rótulo na escala configurada (-1 = fora da escala). */
  const rank = (b: string, kind: 'levels' | 'probability' | 'impact', v: string | null) => (v ? rst(b)[kind].indexOf(v) : -1);
  const scaleOf = (b: string, kind: 'levels' | 'probability' | 'impact') => rst(b)[kind];
  const productsOf = (x: { projectBoardId: string; produtoIds: string[] }) => x.produtoIds.map((id) => prodBy.get(k(x.projectBoardId, id))).filter((p): p is ProductDoc => !!p);
  return { ds, projectBy, cfgBy, prodBy, subsOf, issues, isDone, isExcluded, health, isDelivered, isPaid, rank, scaleOf, productsOf, today: new Date().toISOString().slice(0, 10) };
}

// ——— Filtros globais (projeto, workspace, Histórico, período) ———
export type GlobalFilter = { projects: string[]; workspace: string; meta: MetaFilter; from: string; to: string };
export const EMPTY_GLOBAL: GlobalFilter = { projects: [], workspace: '', meta: EMPTY_META, from: '', to: '' };

export function projectFilter(projects: ProjectDoc[], f: GlobalFilter) {
  const by = new Map(projects.map((p) => [p.boardId, p]));
  return (b: string) => {
    const p = by.get(b);
    return (f.projects.length === 0 || f.projects.includes(b)) && (!f.workspace || p?.workspaceName === f.workspace) && metaOk(p, f.meta);
  };
}

/** IDs de projeto para o painel de indicadores ([] = todos; sentinela quando nenhum passa). */
export function allowedIds(projects: ProjectDoc[], f: GlobalFilter): string[] {
  if (!f.workspace && f.projects.length === 0) return [];
  const ok = projectFilter(projects, { ...f, meta: EMPTY_META });
  const ids = projects.filter((p) => ok(p.boardId)).map((p) => p.boardId);
  return ids.length ? ids : ['__nenhum__'];
}

/** Período: item precisa ter data de referência dentro do intervalo (sem data sai quando há período). */
export function inPeriod(d: string | null | undefined, f: { from: string; to: string }) {
  if (!f.from && !f.to) return true;
  if (!d) return false;
  const x = d.slice(0, 10);
  return (!f.from || x >= f.from) && (!f.to || x <= f.to);
}

export function textMatch(q: string, ...vals: (string | null | undefined | string[])[]) {
  const n = norm(q);
  if (!n) return true;
  return vals.some((v) => (Array.isArray(v) ? v.some((s) => norm(s).includes(n)) : !!v && norm(v).includes(n)));
}

export const uniq = (a: (string | null | undefined)[]) => [...new Set(a.filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
export const splitList = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function scopeOps(m: OpsModel, f: GlobalFilter) {
  const ok = projectFilter(m.ds.projects, f);
  return {
    projects: m.ds.projects.filter((p) => ok(p.boardId)),
    schedule: m.ds.schedule.filter((x) => ok(x.projectBoardId) && inPeriod(x.fimPlanejado ?? x.inicioPlanejado, f)),
    subitems: m.ds.subitems.filter((x) => ok(x.projectBoardId) && inPeriod(x.fimPlanejado ?? x.inicioPlanejado, f)),
    products: m.ds.products.filter((x) => ok(x.projectBoardId) && inPeriod(x.entregaPlanejada ?? x.entregaReal, f)),
    risks: m.ds.risks.filter((x) => ok(x.projectBoardId) && inPeriod(x.ultimaAtualizacao, f)),
  };
}
export type OpsScope = ReturnType<typeof scopeOps>;
