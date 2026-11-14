import { EMPTY_META, metaOk, type MetaFilter } from '@generated/lib/history';
import type { IndicatorDoc, MeasurementDoc, ProjectDoc } from '@generated/models';
import { parseConfig, type StatusConfig } from './fields';

export type Dataset = { projects: ProjectDoc[]; indicators: IndicatorDoc[]; measurements: MeasurementDoc[]; loadedAt: string };
export type Issue = { kind: 'sem-vinculo' | 'ref-ausente' | 'divergencia'; projectBoardId: string; itemId: string; name: string; detail: string; entity: 'medicao' | 'indicador' };

export const k = (boardId: string, itemId: string) => `${boardId}:${itemId}`;
const EMPTY_STATUS: StatusConfig = { concluded: [], excluded: [], reached: [], notReached: [] };

export type Model = ReturnType<typeof buildModel>;

/** Resolve relações por (boardId,itemId), sem aproximação por nome. */
export function buildModel(ds: Dataset) {
  const projectBy = new Map(ds.projects.map((p) => [p.boardId, p]));
  const statusBy = new Map(ds.projects.map((p) => [p.boardId, parseConfig(p.config)?.status ?? EMPTY_STATUS]));
  const indBy = new Map(ds.indicators.map((i) => [k(i.projectBoardId, i.itemId), i]));
  const medBy = new Map(ds.measurements.map((m) => [k(m.projectBoardId, m.itemId), m]));
  const medsOfInd = new Map<string, MeasurementDoc[]>();
  const issues: Issue[] = [];

  for (const m of ds.measurements) {
    if (m.indicadorIds.length === 0) {
      issues.push({ kind: 'sem-vinculo', entity: 'medicao', projectBoardId: m.projectBoardId, itemId: m.itemId, name: m.name, detail: 'Medição sem Indicador Vinculado.' });
    }
    for (const iid of m.indicadorIds) {
      const key = k(m.projectBoardId, iid);
      const ind = indBy.get(key);
      if (!ind) {
        issues.push({ kind: 'ref-ausente', entity: 'medicao', projectBoardId: m.projectBoardId, itemId: m.itemId, name: m.name, detail: `Vinculada ao item ${iid}, que não foi importado como indicador.` });
        continue;
      }
      const arr = medsOfInd.get(key) ?? [];
      arr.push(m);
      medsOfInd.set(key, arr);
      if (!ind.unmapped.includes('medicao') && !ind.medicaoIds.includes(m.itemId)) {
        issues.push({ kind: 'divergencia', entity: 'medicao', projectBoardId: m.projectBoardId, itemId: m.itemId, name: m.name, detail: `Aponta para "${ind.name}", mas o indicador não lista esta medição na conexão Medição.` });
      }
    }
  }
  for (const i of ds.indicators) {
    for (const mid of i.medicaoIds) {
      const m = medBy.get(k(i.projectBoardId, mid));
      if (!m) issues.push({ kind: 'ref-ausente', entity: 'indicador', projectBoardId: i.projectBoardId, itemId: i.itemId, name: i.name, detail: `Conexão Medição aponta para o item ${mid}, que não foi importado.` });
      else if (!m.unmapped.includes('indicadorVinculado') && !m.indicadorIds.includes(i.itemId))
        issues.push({ kind: 'divergencia', entity: 'indicador', projectBoardId: i.projectBoardId, itemId: i.itemId, name: i.name, detail: `Lista "${m.name}" na conexão Medição, mas a medição não aponta para este indicador.` });
    }
  }

  const indicatorsOf = (m: MeasurementDoc) => m.indicadorIds.map((id) => indBy.get(k(m.projectBoardId, id))).filter((x): x is IndicatorDoc => !!x);
  const st = (m: MeasurementDoc) => statusBy.get(m.projectBoardId) ?? EMPTY_STATUS;
  const isConcluded = (m: MeasurementDoc) => !!m.statusMedicao && st(m).concluded.includes(m.statusMedicao);
  const isExcluded = (m: MeasurementDoc) => !!m.statusMedicao && st(m).excluded.includes(m.statusMedicao);
  const today = new Date().toISOString().slice(0, 10);
  const isLate = (m: MeasurementDoc) => !!m.prazo && m.prazo < today && !isConcluded(m) && !isExcluded(m);
  const metaClass = (m: MeasurementDoc): 'reached' | 'notReached' | 'none' => {
    if (!m.statusMeta) return 'none';
    if (st(m).reached.includes(m.statusMeta)) return 'reached';
    if (st(m).notReached.includes(m.statusMeta)) return 'notReached';
    return 'none';
  };
  /** Classe usada nas métricas: medição em atraso conta como meta não batida; concluída usa o Status da Meta. */
  const goalClass = (m: MeasurementDoc): 'reached' | 'notReached' | 'none' => {
    if (isLate(m)) return 'notReached';
    if (!isConcluded(m)) return 'none';
    return metaClass(m);
  };
  return { ds, projectBy, indBy, medBy, medsOfInd, issues, indicatorsOf, isConcluded, isExcluded, isLate, metaClass, goalClass, today };
}

const nrm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Despriorizadas e Canceladas são desconsideradas em todas as visualizações. */
export const isDiscarded = (s: string | null) => !!s && /cancel|despriori/.test(nrm(s));
/** Não iniciado / previsto / em planejamento → cinza nos gráficos. */
export const isNotStarted = (s: string | null) => !s || /nao inici|previst|planejam/.test(nrm(s));

/** Projetos com ≥ 70% das medições avaliadas de um tipo (KR/KPI) com meta alcançada. */
export function projectGoalRate(m: Model, s: { evaluated: MeasurementDoc[]; reached: MeasurementDoc[] }, kind: 'KR' | 'KPI', kindOf: (x: MeasurementDoc) => string) {
  const by = new Map<string, { ev: number; ok: number }>();
  s.evaluated.filter((x) => kindOf(x) === kind).forEach((x) => {
    const r = by.get(x.projectBoardId) ?? { ev: 0, ok: 0 };
    r.ev++; if (m.goalClass(x) === 'reached') r.ok++;
    by.set(x.projectBoardId, r);
  });
  const rows = [...by.entries()].map(([id, r]) => ({ id, ...r, pct: (r.ok / r.ev) * 100 }));
  return { total: rows.length, hit: rows.filter((r) => r.pct >= 70), rows };
}

export type Filters = { projects: string[]; tipo: string; objetivo: string; statusMedicao: string; statusMeta: string; from: string; to: string; meta: MetaFilter };
export const EMPTY_FILTERS: Filters = { projects: [], tipo: '', objetivo: '', statusMedicao: '', statusMeta: '', from: '', to: '', meta: EMPTY_META };

const splitDrop = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
export const objetivosOf = (i: IndicatorDoc) => splitDrop(i.objetivo);

export function applyFilters(m: Model, f: Filters) {
  const projOk = (b: string) => (f.projects.length === 0 || f.projects.includes(b)) && metaOk(m.projectBy.get(b), f.meta);
  const indOk = (i: IndicatorDoc) => projOk(i.projectBoardId) && (!f.tipo || (i.tipo ?? 'Sem tipo') === f.tipo) && (!f.objetivo || objetivosOf(i).includes(f.objetivo));
  const indFilterOn = !!(f.tipo || f.objetivo);
  const medFilterOn = !!(f.statusMedicao || f.statusMeta || f.from || f.to);
  const meds = m.ds.measurements.filter((x) => {
    if (!projOk(x.projectBoardId)) return false;
    if (isDiscarded(x.statusMedicao)) return false;
    if (indFilterOn && !m.indicatorsOf(x).some(indOk)) return false;
    if (f.statusMedicao && (x.statusMedicao ?? 'Sem status') !== f.statusMedicao) return false;
    if (f.statusMeta && (x.statusMeta ?? 'Sem status') !== f.statusMeta) return false;
    if (f.from || f.to) {
      if (!x.prazo) return false;
      if (f.from && x.prazo < f.from) return false;
      if (f.to && x.prazo > f.to) return false;
    }
    return true;
  });
  let inds: IndicatorDoc[];
  if (medFilterOn) {
    const keys = new Set(meds.flatMap((x) => x.indicadorIds.map((id) => k(x.projectBoardId, id))));
    inds = m.ds.indicators.filter((i) => keys.has(k(i.projectBoardId, i.itemId)) && indOk(i));
  } else inds = m.ds.indicators.filter(indOk);
  const projSet = new Set([...inds.map((i) => i.projectBoardId), ...meds.map((x) => x.projectBoardId)]);
  if (!medFilterOn && !indFilterOn) m.ds.projects.forEach((p) => projOk(p.boardId) && projSet.add(p.boardId));
  const projs = m.ds.projects.filter((p) => projSet.has(p.boardId));
  const concluded = meds.filter(m.isConcluded);
  const late = meds.filter(m.isLate);
  const evaluated = meds.filter((x) => m.goalClass(x) !== 'none');
  const reached = evaluated.filter((x) => m.goalClass(x) === 'reached');
  const notReached = evaluated.filter((x) => m.goalClass(x) === 'notReached');
  const visibleBoards = new Set(projs.map((p) => p.boardId));
  const medKeys = new Set(meds.map((x) => k(x.projectBoardId, x.itemId)));
  const indKeys = new Set(inds.map((x) => k(x.projectBoardId, x.itemId)));
  const issues = m.issues.filter((is) => visibleBoards.has(is.projectBoardId) && (is.entity === 'medicao' ? medKeys.has(k(is.projectBoardId, is.itemId)) : indKeys.has(k(is.projectBoardId, is.itemId))));
  const semPrazo = meds.filter((x) => !x.prazo);
  const semBase = meds.filter((x) => m.isConcluded(x) && x.baseDadosUrls.length === 0 && !x.baseDadosText && !x.unmapped.includes('baseDados'));
  // Projetos com medições vencidas (prazo ≤ hoje): no prazo = nenhuma vencida sem conclusão.
  const dueBy = new Map<string, { due: number; late: number }>();
  meds.forEach((x) => {
    // Denominador: todo projeto com medição vencida (prazo até hoje), concluída ou não.
    // Despriorizadas/canceladas já foram removidas do recorte.
    if (!x.prazo || x.prazo.slice(0, 10) > m.today) return;
    const r = dueBy.get(x.projectBoardId) ?? { due: 0, late: 0 };
    r.due++; if (!m.isConcluded(x) && x.prazo.slice(0, 10) < m.today) r.late++;
    dueBy.set(x.projectBoardId, r);
  });
  const onTime = { total: dueBy.size, ids: [...dueBy.entries()].filter(([, r]) => r.late === 0).map(([id]) => id), by: dueBy };
  // Projetos inseridos (ativos) respeitando só o filtro de projeto — inclui os "sem indicador elaborado".
  const inserted = m.ds.projects.filter((p) => projOk(p.boardId));
  return { inserted, meds, inds, projs, concluded, late, evaluated, reached, notReached, issues, semPrazo, semBase, onTime };
}

export type Slice = ReturnType<typeof applyFilters>;

export function countBy<T>(list: T[], key: (x: T) => string) {
  const map = new Map<string, T[]>();
  list.forEach((x) => { const kk = key(x); map.set(kk, [...(map.get(kk) ?? []), x]); });
  return [...map.entries()].map(([name, items]) => ({ name, value: items.length, items })).sort((a, b) => b.value - a.value);
}
