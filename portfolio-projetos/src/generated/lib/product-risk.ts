import type { ProductDoc, ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';
import { k, type OpsModel, type OpsScope } from './ops';

export type RiskLevel = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';
export type RiskTask = { kind: "atividade" | "subatividade"; name: string; status: string | null; inicio: string | null; fim: string | null; late: boolean; done: boolean };
export type ProductRisk = {
  product: ProductDoc;
  index: number;
  level: RiskLevel;
  special: boolean;
  tasks: RiskTask[];
  plan: { pts: number; margin: number | null; lastEnd: string | null; note: string };
  late: { pts: number; pct: number; count: number; note: string };
  pace: { pts: number; gap: number | null; current: number | null; required: number | null; note: string };
};

const DAY = 86400000;
const dt = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s.slice(0, 10) + 'T00:00:00Z').getTime() : null);
const diffDays = (a: number, b: number) => Math.round((a - b) / DAY);

export const levelOf = (i: number): RiskLevel => (i >= 70 ? 'Crítico' : i >= 45 ? 'Alto' : i >= 20 ? 'Médio' : 'Baixo');

function planPts(margin: number) {
  if (margin < 0) return 35;
  if (margin <= 2) return 25;
  if (margin <= 7) return 15;
  if (margin <= 14) return 5;
  return 0;
}
function latePts(pct: number) {
  if (pct > 50) return 35;
  if (pct >= 30) return 25;
  if (pct >= 15) return 15;
  if (pct >= 5) return 5;
  return 0;
}
function pacePts(gap: number) {
  if (gap > 80) return 30;
  if (gap >= 50) return 20;
  if (gap >= 25) return 10;
  return 0;
}

/** Índice de Risco (0-100) dos produtos em aberto, cruzando atividades e subatividades vinculadas. */
export function productRisks(m: OpsModel, s: OpsScope): ProductRisk[] {
  const today = dt(m.today) ?? Date.now();
  const byProd = new Map<string, { item: ScheduleItemDoc | ScheduleSubitemDoc; kind: RiskTask['kind'] }[]>();
  const add = (x: ScheduleItemDoc | ScheduleSubitemDoc, kind: RiskTask['kind']) => {
    if (m.isExcluded(x)) return;
    x.produtoIds.forEach((id) => { const kk = k(x.projectBoardId, id); byProd.set(kk, [...(byProd.get(kk) ?? []), { item: x, kind }]); });
  };
  m.ds.schedule.forEach((x) => add(x, 'atividade'));
  m.ds.subitems.forEach((x) => add(x, 'subatividade'));

  return s.products.filter((p) => !m.isDelivered(p)).map((p) => {
    const linked = byProd.get(k(p.projectBoardId, p.itemId)) ?? [];
    const tasks: RiskTask[] = linked.map(({ item, kind }) => {
      const done = m.isDone(item);
      const late = !done && (kind === 'atividade' && (item as ScheduleItemDoc).saude ? m.health(item as ScheduleItemDoc) === 'bad' : !!item.flagAtrasada);
      return { kind, name: item.name, status: item.status, inicio: item.inicioPlanejado, fim: item.fimPlanejado, late, done };
    });
    // Prazo: fim de "Planejado Início - Entrega"; sem ela, usa "Entrega Planejada".
    const due = dt(p.planEntrega ?? p.entregaPlanejada);
    const daysToDue = due != null ? diffDays(due, today) : null;

    if (tasks.length === 0 && daysToDue != null && daysToDue <= 30) {
      return {
        product: p, index: 100, level: 'Crítico', special: true, tasks,
        plan: { pts: 35, margin: null, lastEnd: null, note: 'Sem cronograma vinculado' },
        late: { pts: 35, pct: 0, count: 0, note: 'Sem cronograma vinculado' },
        pace: { pts: 30, gap: null, current: null, required: null, note: `Entrega em ${daysToDue} dia(s) sem cronograma` },
      } satisfies ProductRisk;
    }

    // 1. Planejamento incompatível
    const ends = linked.map(({ item }) => dt(item.fimPlanejado)).filter((x): x is number => x != null);
    const lastEnd = ends.length ? Math.max(...ends) : null;
    const margin = due != null && lastEnd != null ? diffDays(due, lastEnd) : null;
    const plan = margin == null
      ? { pts: 0, margin, lastEnd: null, note: due == null ? 'Sem entrega planejada' : 'Atividades sem data de término' }
      : { pts: planPts(margin), margin, lastEnd: new Date(lastEnd!).toISOString().slice(0, 10), note: `${margin >= 0 ? '+' : ''}${margin} dia(s) de margem` };

    // 2. Tarefas atrasadas
    const lateCount = tasks.filter((t) => t.late).length;
    const pct = tasks.length ? (lateCount / tasks.length) * 100 : 0;
    const late = { pts: latePts(pct), pct, count: lateCount, note: tasks.length ? `${lateCount} de ${tasks.length} atrasada(s)` : 'Sem tarefas' };

    // 3. Gap de ritmo: conclusões/dia desde o início × conclusões/dia necessárias até a entrega
    const doneN = tasks.filter((t) => t.done).length;
    const remaining = tasks.length - doneN;
    const starts = linked.map(({ item }) => dt(item.inicioPlanejado)).filter((x): x is number => x != null);
    const start = starts.length ? Math.min(...starts) : null;
    let pace: ProductRisk['pace'];
    if (remaining === 0) pace = { pts: 0, gap: 0, current: null, required: 0, note: tasks.length ? 'Todas concluídas' : 'Sem tarefas' };
    else if (daysToDue == null) pace = { pts: 0, gap: null, current: null, required: null, note: 'Sem entrega planejada' };
    else {
      const elapsed = start != null ? Math.max(1, diffDays(today, start)) : null;
      const current = elapsed != null && start! <= today ? doneN / elapsed : 0;
      const required = daysToDue <= 0 ? Infinity : remaining / daysToDue;
      const gap = required === Infinity ? 100 : Math.max(0, ((required - current) / required) * 100);
      // Texto descritivo, em tarefas por semana (mais fácil de ler que por dia).
      const wk = (v: number) => (v * 7).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      const ritmo = start == null || start > today
        ? 'nenhuma atividade começou ainda (ritmo atual 0)'
        : `ritmo atual de ${wk(current)}/semana (${doneN} concluída(s) em ${elapsed} dia(s) desde o início)`;
      const note = daysToDue <= 0
        ? `Entrega vencida há ${-daysToDue} dia(s) com ${remaining} de ${tasks.length} tarefa(s) pendente(s): não há mais prazo para recuperar o ritmo.`
        : gap <= 0
          ? `Faltam ${remaining} tarefa(s) em ${daysToDue} dia(s) (precisa ${wk(required)}/semana); ${ritmo} é suficiente.`
          : `Faltam ${remaining} tarefa(s) em ${daysToDue} dia(s), o que exige ${wk(required)}/semana; ${ritmo} está ${Math.round(gap)}% abaixo do necessário.`;
      pace = { pts: pacePts(gap), gap, current, required: required === Infinity ? null : required, note };
    }

    const index = Math.min(100, plan.pts + late.pts + pace.pts);
    return { product: p, index, level: levelOf(index), special: false, tasks, plan, late, pace } satisfies ProductRisk;
  }).sort((a, b) => b.index - a.index);
}

/** Período do cronograma do produto: menor início e maior término das tarefas vinculadas. */
export function scheduleSpan(r: ProductRisk): { from: string | null; to: string | null } {
  const ds = (l: (string | null)[]) => l.filter((x): x is string => !!x && /^\d{4}-\d{2}-\d{2}/.test(x)).map((x) => x.slice(0, 10)).sort();
  const starts = ds(r.tasks.map((t) => t.inicio ?? t.fim));
  const ends = ds(r.tasks.map((t) => t.fim ?? t.inicio));
  return { from: starts[0] ?? null, to: ends[ends.length - 1] ?? null };
}

/** Alguma tarefa do produto ocorre (início–término) dentro do mês informado (AAAA-MM). */
export function inMonth(r: ProductRisk, ym: string): boolean {
  const first = `${ym}-01`; const last = `${ym}-31`;
  return r.tasks.some((t) => {
    const a = (t.inicio ?? t.fim)?.slice(0, 10); const b = (t.fim ?? t.inicio)?.slice(0, 10);
    return !!a && !!b && a <= last && b >= first;
  });
}
