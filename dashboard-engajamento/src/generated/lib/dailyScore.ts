// Score geral ("Score do usuário"): semanas com pelo menos um check ÷ semanas da Base com período definido,
// a partir da entrada da pessoa (Criado em, ou a primeira semana em que ela aparece na Base).
// Fora do score: semanas pendentes (nem chegam aqui), semanas da base antiga, semanas sem nenhum check na Base
// e semanas em que a pessoa estava afastada.
import type { AbsenceDoc, StoredEngagementRow } from '@generated/models';
import { personKey } from './engagementMetrics';
import { WEEKDAYS, isWeekdayKey, normText, type WeekdayKey } from './weekdays';

export interface WeekGroupInfo {
  group: string;
  weekStart: string; // AAAA-MM-DD
  weekEnd: string; // AAAA-MM-DD
}

export interface UserWeek {
  group: string;
  weekStart: string;
  weekEnd: string;
  days: { key: WeekdayKey; short: string; checked: boolean }[];
  accessed: boolean;
  away: boolean;
  counted: boolean; // entra no score geral
}

export interface UserScore {
  weeksAccessed: number;
  weeksTotal: number;
  percent: number | null; // null quando não há semana válida
  allAway: boolean; // todas as semanas válidas eram de afastamento
  weeks: UserWeek[];
  entryDate: string | null;
  entrySource: 'criado_em' | 'primeira_semana' | null;
  lastAccess: string | null;
}

export interface UserScoreIndex {
  byPerson: Map<string, UserScore>;
}

const isoOnly = (s: string | null | undefined) => {
  const m = (s ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? (m[1] as string) : '';
};

const absenceCounts = (a: AbsenceDoc) => !a.removido && (a.fluxo !== 'projetos' || a.status === 'validado');

export function buildUserScores(
  rows: StoredEngagementRow[],
  weekGroups: WeekGroupInfo[],
  absences: AbsenceDoc[],
  legacyGroups: string[]
): UserScoreIndex {
  const legacy = new Set(legacyGroups.map(normText));
  const weekByKey = new Map(weekGroups.filter((w) => w.weekStart && w.weekEnd).map((w) => [normText(w.group), w]));
  const anyCheck = new Set<string>();
  const perPerson = new Map<string, { email: string; created: string; last: string; groups: Map<string, Set<WeekdayKey>> }>();

  rows.forEach((r) => {
    const g = normText(r.group);
    if (!g || !weekByKey.has(g)) return;
    if ((r.checkedDays ?? []).length > 0) anyCheck.add(g);
    const key = personKey(r.name, r.email);
    if (!key) return;
    const p = perPerson.get(key) ?? { email: '', created: '', last: '', groups: new Map<string, Set<WeekdayKey>>() };
    if (r.email) p.email = r.email.trim().toLowerCase();
    const c = isoOnly(r.createdAt);
    if (c && (!p.created || c < p.created)) p.created = c;
    const la = isoOnly(r.lastAccess);
    if (la && la > p.last) p.last = la;
    const set = p.groups.get(g) ?? new Set<WeekdayKey>();
    (r.checkedDays ?? []).forEach((d) => { if (isWeekdayKey(d)) set.add(d); });
    p.groups.set(g, set);
    perPerson.set(key, p);
  });

  const abs = absences.filter(absenceCounts);
  const byPerson = new Map<string, UserScore>();
  perPerson.forEach((p, key) => {
    const firstWeek = Array.from(p.groups.keys()).map((g) => weekByKey.get(g)?.weekStart ?? '').filter(Boolean).sort()[0] ?? null;
    const entryDate = p.created || firstWeek;
    const entrySource: UserScore['entrySource'] = p.created ? 'criado_em' : firstWeek ? 'primeira_semana' : null;
    const mine = p.email ? abs.filter((a) => (a.email ?? '').trim().toLowerCase() === p.email) : [];
    let weeksAccessed = 0;
    let weeksTotal = 0;
    let validInScope = 0;
    const weeks: UserWeek[] = [];
    weekByKey.forEach((w, g) => {
      if (!p.groups.has(g)) return; // pessoa não estava ativa nesta semana: a semana não existe para ela
      if (entryDate && w.weekEnd < entryDate) return;
      const checked = p.groups.get(g) ?? new Set<WeekdayKey>();
      const away = mine.some((a) => a.inicio <= w.weekEnd && (!a.volta || a.volta > w.weekStart));
      const counted = !legacy.has(g) && anyCheck.has(g);
      const accessed = checked.size > 0;
      if (counted) {
        validInScope++;
        if (!away) { weeksTotal++; if (accessed) weeksAccessed++; }
      }
      weeks.push({
        group: w.group, weekStart: w.weekStart, weekEnd: w.weekEnd, accessed, away, counted,
        days: WEEKDAYS.map((d) => ({ key: d.key, short: d.short, checked: checked.has(d.key) })),
      });
    });
    weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.group.localeCompare(b.group));
    byPerson.set(key, {
      weeksAccessed, weeksTotal,
      percent: weeksTotal > 0 ? Math.round((weeksAccessed / weeksTotal) * 100) : null,
      allAway: validInScope > 0 && weeksTotal === 0,
      weeks, entryDate, entrySource, lastAccess: p.last || null,
    });
  });
  return { byPerson };
}

/**
 * Mesmo score do usuário (mesmas regras), mas só com as semanas do período escolhido.
 * `groups` = nomes dos grupos (semanas) que caem no período; null = todas as semanas.
 */
export function userScoreInGroups(index: UserScoreIndex, key: string, groups: Set<string> | null): UserScore {
  const base = userScoreFor(index, key);
  if (!groups) return base;
  const weeks = base.weeks.filter((w) => groups.has(normText(w.group)));
  const valid = weeks.filter((w) => w.counted);
  const scored = valid.filter((w) => !w.away);
  const weeksAccessed = scored.filter((w) => w.accessed).length;
  const weeksTotal = scored.length;
  return {
    ...base,
    weeks,
    weeksAccessed,
    weeksTotal,
    percent: weeksTotal > 0 ? Math.round((weeksAccessed / weeksTotal) * 100) : null,
    allAway: valid.length > 0 && weeksTotal === 0,
  };
}

export function userScoreFor(index: UserScoreIndex, key: string): UserScore {
  return index.byPerson.get(key) ?? {
    weeksAccessed: 0, weeksTotal: 0, percent: null, allAway: false, weeks: [], entryDate: null, entrySource: null, lastAccess: null,
  };
}
