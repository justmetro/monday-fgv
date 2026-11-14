// Capacidade operacional: carga de atividades abertas por responsável (cronogramas dos projetos).
import type { ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';
import { k, type OpsModel, type OpsScope } from './ops';

const nrm = (s: string | null) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const isInProgress = (s: string | null) => /progress|andamento|execu|fazendo/.test(nrm(s));
const DAY = 86400000;
const t = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? Date.parse(s.slice(0, 10) + 'T00:00:00Z') : null);

export type AllocTask = { kind: 'Atividade' | 'Subatividade'; name: string; projectBoardId: string; status: string | null; start: number | null; end: number | null; prog: boolean; late: boolean; drill: ScheduleItemDoc | null };
export type Person = { name: string; tasks: AllocTask[]; total: number; prog: number; late: number; byProject: Map<string, AllocTask[]> };

/** Atividades (e opcionalmente subatividades) em aberto: sem concluídas, excluídas, canceladas ou despriorizadas. */
export function buildAllocation(m: OpsModel, s: OpsScope, withSubs: boolean): Person[] {
  const today = t(m.today) ?? Date.now();
  const parent = new Map(s.schedule.map((x) => [k(x.projectBoardId, x.itemId), x]));
  const open = (x: ScheduleItemDoc | ScheduleSubitemDoc) => !m.isDone(x) && !m.isExcluded(x) && !/cancel|despriori|conclu|finaliz/.test(nrm(x.status));
  const tasks: { who: string[]; task: AllocTask }[] = [];
  const add = (x: ScheduleItemDoc | ScheduleSubitemDoc, sub: boolean) => {
    if (!open(x) || x.responsaveis.length === 0) return;
    const start = t(x.inicioPlanejado ?? x.fimPlanejado), end = t(x.fimPlanejado ?? x.inicioPlanejado);
    const drill = sub ? parent.get(k(x.projectBoardId, (x as ScheduleSubitemDoc).parentItemId)) ?? null : (x as ScheduleItemDoc);
    tasks.push({ who: x.responsaveis, task: { kind: sub ? 'Subatividade' : 'Atividade', name: x.name, projectBoardId: x.projectBoardId, status: x.status, start, end, prog: isInProgress(x.status), late: end != null && end < today, drill } });
  };
  s.schedule.forEach((x) => add(x, false));
  if (withSubs) s.subitems.forEach((x) => add(x, true));

  const by = new Map<string, Person>();
  tasks.forEach(({ who, task }) => who.forEach((w) => {
    const name = w.trim(); if (!name) return;
    const p: Person = by.get(name) ?? { name, tasks: [], total: 0, prog: 0, late: 0, byProject: new Map<string, AllocTask[]>() };
    p.tasks.push(task); p.total++; if (task.prog) p.prog++; if (task.late) p.late++;
    p.byProject.set(task.projectBoardId, [...(p.byProject.get(task.projectBoardId) ?? []), task]);
    by.set(name, p);
  }));
  return [...by.values()].sort((a, b) => b.total - a.total);
}

/** Segunda-feira (UTC) da semana de uma data. */
export const weekStart = (ms: number) => { const d = new Date(ms); const wd = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd); };

/** Semanas a partir da atual: quantas atividades planejadas de cada pessoa cruzam cada semana. */
export function weeklyLoad(people: Person[], todayIso: string, weeks = 12) {
  const w0 = weekStart(t(todayIso) ?? Date.now());
  const cols = Array.from({ length: weeks }, (_, i) => w0 + i * 7 * DAY);
  const rows = people.map((p) => ({
    name: p.name,
    counts: cols.map((ws) => p.tasks.filter((x) => x.start != null && x.end != null && x.start < ws + 7 * DAY && x.end >= ws).length),
  }));
  return { cols, rows };
}

export const unique = (l: (ScheduleItemDoc | null)[]) => [...new Map(l.filter((x): x is ScheduleItemDoc => !!x).map((x) => [k(x.projectBoardId, x.itemId), x])).values()];
