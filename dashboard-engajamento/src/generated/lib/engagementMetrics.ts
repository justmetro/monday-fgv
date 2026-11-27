// Cálculo completo de métricas de engajamento, scores periódicos e tratamento de afastamentos
import { weekWindowOf, toISODate, formatBR, shortDate, parseDateFlexible, type TimeGranularity } from './dates';
import { weekInPeriod, type PeriodOption } from './periods';
import { isWeekExcludedByAbsence, getActiveAbsenceOnDate, type AbsenceInfo } from './absenceRules';
import type { StoredProjectItem } from '@generated/models';
import { buildKnownTeamNames, matchTeamToActiveProject, splitTeams } from './projectMatcher';

// Cor padrão azul-marinho
export const BRAND_NAVY_COLOR = '#002B49';

export interface EngagementRecord {
  name: string;
  email: string;
  team: string;
  department: string;
  lastAccess: Date | null;
  refDate: Date;
  group?: string; // Grupo (semana) da linha na Base
  checkedDays?: string[]; // Checks da semana gravados na Base
}

/** Grupo da Base com o intervalo guardado (vem do servidor). */
export interface WeekGroupInput {
  group: string;
  weekStart: string;
  weekEnd: string;
  refDate: string;
}

/** Uma semana avaliada = um grupo existente na Base. */
interface WeekRef {
  key: string; // Identificador da semana (data da análise em AAAA-MM-DD)
  group: string;
  ref: Date; // Data da análise do grupo
  start: Date; // Segunda 00:00 do intervalo guardado
  end: Date; // Domingo 23:59 do intervalo guardado
}

const normGroupKey = (g: string | undefined) =>
  (g ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

function recordGroupKey(r: EngagementRecord): string {
  const g = normGroupKey(r.group);
  return g || `ref:${toISODate(r.refDate)}`; // Linha sem grupo (legado): agrupa pela data da análise
}

const dayStart = (iso: string) => {
  const d = parseDateFlexible(iso);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0) : null;
};
const dayEnd = (iso: string) => {
  const d = parseDateFlexible(iso);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) : null;
};

/** Monta as semanas a partir dos grupos da Base; grupos sem intervalo guardado usam a semana da data da análise. */
function buildWeekRefs(records: EngagementRecord[], weekGroups: WeekGroupInput[]): Map<string, WeekRef> {
  const out = new Map<string, WeekRef>();
  const usedKeys = new Set<string>();
  const makeKey = (iso: string, group: string) => {
    const k = usedKeys.has(iso) ? `${iso}|${group}` : iso;
    usedKeys.add(k);
    return k;
  };
  weekGroups.forEach((g) => {
    const gk = normGroupKey(g.group);
    const ref = parseDateFlexible(g.refDate);
    const start = dayStart(g.weekStart);
    const end = dayEnd(g.weekEnd);
    if (!gk || !ref || !start || !end || out.has(gk)) return;
    const r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    out.set(gk, { key: makeKey(toISODate(r), g.group), group: g.group, ref: r, start, end });
  });
  // Grupos presentes nas linhas mas sem cadastro vindo do servidor (ex.: dados em cache antigos)
  const pending = new Map<string, { group: string; ref: Date }>();
  records.forEach((r) => {
    const gk = recordGroupKey(r);
    if (out.has(gk)) return;
    const ref = new Date(r.refDate.getFullYear(), r.refDate.getMonth(), r.refDate.getDate());
    const cur = pending.get(gk);
    if (!cur || ref > cur.ref) pending.set(gk, { group: (r.group ?? '').trim(), ref });
  });
  pending.forEach((p, gk) => {
    const { start, end } = weekWindowOf(p.ref);
    out.set(gk, { key: makeKey(toISODate(p.ref), p.group), group: p.group, ref: p.ref, start, end });
  });
  return out;
}

/** Semana ativa: ao menos um check gravado na semana ou último acesso dentro do intervalo do grupo. */
function isEngagedIn(rec: EngagementRecord | undefined, w: WeekRef): boolean {
  if (!rec) return false;
  if ((rec.checkedDays?.length ?? 0) > 0) return true;
  return !!rec.lastAccess && rec.lastAccess >= w.start && rec.lastAccess <= w.end;
}

export interface PersonPeriodScore {
  totalPeriodWeeks: number; // Semanas do período em que a pessoa estava ativa (linha "Ativado" na Base)
  periodWeeksInBase: number; // Semanas do período na Base (ativa ou não)
  excludedWeeks: number; // Semanas retiradas por afastamento
  evaluatedWeeks: number; // totalPeriodWeeks - excludedWeeks
  engagedWeeks: number; // Semanas em que a pessoa esteve engajada
  scorePercent: number | null; // null se evaluatedWeeks === 0
  scoreText: string;
  isAllAbsence: boolean;
  activeAbsenceOnRef: AbsenceInfo | null;
}

export interface PersonWeek {
  key: string;
  name: string;
  email: string;
  teams: string[];
  departments: string[];
  activeProjects: string[]; // Projetos ativos aos quais a pessoa está vinculada (sem duplicações)
  managers: string[]; // Gerentes dos projetos ativos (sem duplicações)
  lastAccess: Date | null; // Maior último acesso conhecido da pessoa em toda a base
  engaged: boolean; // Para o critério semanal
  daysWithoutAccess: number | null; // Dias entre o último acesso conhecido e o fim da semana (null = nunca acessou)
  inactive: boolean; // Não engajado e mais de 30 dias sem acesso (ou nunca acessou)
  accessAfterRef: boolean;
  activeAbsence: AbsenceInfo | null; // Afastamento ativo na data da semana analisada
  periodScore: PersonPeriodScore; // Score para o período selecionado
  overallWeeksEngaged: number; // Semanas ativas no histórico
  overallWeeksEvaluated: number; // Semanas atualizadas/avaliadas no histórico
  overallScorePercent: number | null; // Score geral histórico da base (semanas ativas / semanas atualizadas)
  // Contribuição desta pessoa para a nota de cada projeto ativo (respeita a data de início de cada projeto)
  projectWeeks: Record<string, { analyses: number; presences: number }>;
}

export interface GroupStat {
  name: string;
  totalPeople: number;
  total: number;
  engaged: number;
  rate: number;
  averageScore: number | null; // Score percentual (0 a 100)
  scoreText: string;
  projectInfo?: {
    status?: string;
    managers?: string[];
    axis?: string;
    startDate?: string | null;
    totalAnalyses?: number;
    activePresences?: number;
  };
}

export interface WeekSummary {
  weekKey: string;
  groupName: string; // Nome do grupo da Base (ex.: "Semana 2")
  label: string;
  periodName: string;
  refDate: Date;
  windowStart: Date;
  windowEnd: Date;
  granularity: TimeGranularity;
  people: PersonWeek[];
  total: number;
  engaged: number;
  notEngaged: number;
  rate: number;
  accessAfterRef: number;
  departments: GroupStat[];
  projects: GroupStat[]; // Projetos ATIVOS vinculados
  managers: GroupStat[]; // Engajamento por Gerente de projetos ativos
  averageProjectsScore: number | null; // Score geral dos projetos (média simples dos scores individuais dos projetos)
  evaluatedPeriodInfo?: {
    periodName: string;
    label: string;
    weeksCount: number;
  };
}

/** Desengajado: mais de 7 dias sem acesso. Inativo: mais de 30 dias (ou nunca acessou). */
export const INACTIVE_DAYS = 30;
function accessGap(engaged: boolean, last: Date | null, end: Date): { daysWithoutAccess: number | null; inactive: boolean } {
  if (!last) return { daysWithoutAccess: null, inactive: !engaged };
  const days = Math.max(0, Math.floor((end.getTime() - last.getTime()) / 86400000));
  return { daysWithoutAccess: days, inactive: !engaged && days > INACTIVE_DAYS };
}

export function personKey(name: string, email: string): string {
  const e = (email || '').trim().toLowerCase();
  if (e.includes('@')) return e;
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Agrupa estatísticas por departamento ou gerente calculando a média simples dos scores das pessoas
function groupStatsByPersonAverage(
  people: PersonWeek[],
  pick: (p: PersonWeek) => string[],
  emptyLabel?: string
): GroupStat[] {
  const map = new Map<string, Set<PersonWeek>>();

  people.forEach((p) => {
    const rawGroups = pick(p);
    const groups = rawGroups.length > 0 ? rawGroups : emptyLabel ? [emptyLabel] : [];
    new Set(groups).forEach((g) => {
      if (!map.has(g)) map.set(g, new Set());
      map.get(g)?.add(p);
    });
  });

  return Array.from(map.entries())
    .map(([name, personSet]) => {
      const list = Array.from(personSet);
      const totalPeople = list.length;

      const validScores = list
        .map((p) => p.periodScore.scorePercent)
        .filter((s): s is number => s !== null && s !== undefined);

      let averageScore: number | null = null;
      let scoreText = 'Sem dados no período';

      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, v) => acc + v, 0);
        averageScore = Math.round(sum / validScores.length);
        scoreText = `${averageScore}% (${totalPeople} ${totalPeople === 1 ? 'pessoa' : 'pessoas'})`;
      } else if (totalPeople > 0) {
        if (allAllAway(list)) scoreText = `Afastados (${totalPeople})`;
      }

      return {
        name,
        totalPeople,
        total: totalPeople,
        engaged: validScores.length,
        rate: averageScore ?? 0,
        averageScore,
        scoreText,
      };
    })
    .sort((a, b) => {
      if (b.averageScore !== null && a.averageScore !== null) {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      } else if (b.averageScore !== null) {
        return 1;
      } else if (a.averageScore !== null) {
        return -1;
      }
      return b.totalPeople - a.totalPeople || a.name.localeCompare(b.name);
    });
}

function allAllAway(list: PersonWeek[]): boolean {
  return list.length > 0 && list.every((p) => p.periodScore.isAllAbsence);
}

/**
 * Contribuição de UMA pessoa para a nota de cada projeto ativo dela:
 * semanas avaliadas (denominador) e semanas engajadas (numerador), respeitando a data de início
 * de cada projeto e excluindo semanas de afastamento.
 */
function computePersonProjectWeeks(
  periodWeeks: WeekRef[],
  projectsByWeek: Set<string>[], // projetos da pessoa em cada semana (pela Equipe daquela semana)
  projectMetaMap: Map<string, StoredProjectItem>,
  recordsMap: Map<string, EngagementRecord>,
  absences: AbsenceInfo[]
): Record<string, { analyses: number; presences: number }> {
  const out: Record<string, { analyses: number; presences: number }> = {};
  const allProjects = new Set<string>();
  projectsByWeek.forEach((set) => set.forEach((n) => allProjects.add(n)));
  allProjects.forEach((projectName) => {
    const meta = projectMetaMap.get(projectName);
    const projectStartDate = meta?.startDate ? parseDateFlexible(meta.startDate) : null;
    let analyses = 0;
    let presences = 0;
    periodWeeks.forEach((w, i) => {
      if (!projectsByWeek[i]?.has(projectName)) return; // nesta semana a pessoa não estava neste projeto
      if (projectStartDate) {
        const endOfDay = new Date(w.ref.getFullYear(), w.ref.getMonth(), w.ref.getDate(), 23, 59, 59, 999);
        if (endOfDay.getTime() < projectStartDate.getTime()) return;
      }
      if (!recordsMap.has(w.key)) return; // pessoa não estava ativa nesta semana
      if (isWeekExcludedByAbsence(w.ref, absences).excluded) return;
      analyses++;
      if (isEngagedIn(recordsMap.get(w.key), w)) presences++;
    });
    out[projectName] = { analyses, presences };
  });
  return out;
}

/**
 * Nota de cada projeto = semanas engajadas ÷ semanas avaliadas, somando SÓ as pessoas recebidas
 * (assim, com filtro de departamento, cada projeto é calculado apenas com as pessoas daquele departamento).
 */
function groupStatsForProjects(people: PersonWeek[], projectMetaMap: Map<string, StoredProjectItem>): GroupStat[] {
  const projectPeopleMap = new Map<string, Set<PersonWeek>>();
  people.forEach((p) => {
    p.activeProjects.forEach((projName) => {
      if (!projectPeopleMap.has(projName)) projectPeopleMap.set(projName, new Set());
      projectPeopleMap.get(projName)?.add(p);
    });
  });

  return Array.from(projectPeopleMap.entries())
    .map(([projectName, personSet]) => {
      const list = Array.from(personSet);
      const totalPeople = list.length;
      const meta = projectMetaMap.get(projectName);

      let totalOpportunityAnalyses = 0;
      let totalActivePresences = 0;
      const personScores: number[] = [];
      list.forEach((p) => {
        const c = p.projectWeeks[projectName];
        totalOpportunityAnalyses += c?.analyses ?? 0;
        totalActivePresences += c?.presences ?? 0;
        if (c && c.analyses > 0) personScores.push((c.presences / c.analyses) * 100);
      });

      let averageScore: number | null = null;
      let scoreText = 'Sem dados no período';

      if (totalOpportunityAnalyses > 0) {
        // Média simples dos scores das pessoas (cada uma conta uma vez, só com as semanas ativas dela)
        averageScore = Math.round(personScores.reduce((a, v) => a + v, 0) / personScores.length);
        scoreText = `${averageScore}% (${totalActivePresences} de ${totalOpportunityAnalyses} análises · ${totalPeople} ${
          totalPeople === 1 ? 'pessoa' : 'pessoas'
        })`;
      } else if (totalPeople > 0) {
        scoreText = `Sem análises no período (${totalPeople} ${totalPeople === 1 ? 'pessoa' : 'pessoas'})`;
      }

      return {
        name: projectName,
        totalPeople,
        total: totalPeople,
        engaged: totalActivePresences,
        rate: averageScore ?? 0,
        averageScore,
        scoreText,
        projectInfo: meta
          ? {
              status: meta.status,
              managers: meta.managers,
              axis: meta.axis,
              startDate: meta.startDate,
              totalAnalyses: totalOpportunityAnalyses,
              activePresences: totalActivePresences,
            }
          : undefined,
      };
    })
    .sort((a, b) => {
      if (b.averageScore !== null && a.averageScore !== null) {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      } else if (b.averageScore !== null) {
        return 1;
      } else if (a.averageScore !== null) {
        return -1;
      }
      return b.totalPeople - a.totalPeople || a.name.localeCompare(b.name);
    });
}

function summarize(
  base: Omit<
    WeekSummary,
    | 'total'
    | 'engaged'
    | 'notEngaged'
    | 'rate'
    | 'accessAfterRef'
    | 'departments'
    | 'projects'
    | 'managers'
    | 'averageProjectsScore'
  >,
  activeProjectsList: StoredProjectItem[],
  options?: { onlyWithProject?: boolean; onlyWithManager?: boolean }
): WeekSummary {
  let people = base.people;

  if (options?.onlyWithProject) {
    people = people.filter((p) => p.activeProjects.length > 0);
  } else if (options?.onlyWithManager) {
    people = people.filter((p) => p.managers.length > 0);
  }

  const activeWeeklyPeople = people.filter((p) => !p.activeAbsence);
  const engaged = activeWeeklyPeople.filter((p) => p.engaged).length;
  const notEngaged = activeWeeklyPeople.length - engaged;

  const projectMap = new Map<string, StoredProjectItem>();
  activeProjectsList.forEach((p) => projectMap.set(p.name, p));

  const projectsStats = groupStatsForProjects(people, projectMap);

  // Score geral dos projetos = média simples dos scores individuais dos projetos com dados válidos
  const validProjectScores = projectsStats
    .map((p) => p.averageScore)
    .filter((s): s is number => s !== null && s !== undefined);

  const averageProjectsScore =
    validProjectScores.length > 0
      ? Math.round(validProjectScores.reduce((acc, v) => acc + v, 0) / validProjectScores.length)
      : null;

  return {
    ...base,
    total: people.length,
    engaged,
    notEngaged,
    rate: activeWeeklyPeople.length > 0 ? Math.round((engaged / activeWeeklyPeople.length) * 100) : 0,
    accessAfterRef: people.filter((p) => p.accessAfterRef).length,
    departments: groupStatsByPersonAverage(people, (p) => p.departments, 'Sem departamento'),
    projects: projectsStats,
    managers: groupStatsByPersonAverage(people, (p) => p.managers),
    averageProjectsScore,
  };
}

export function applyFilter(
  week: WeekSummary,
  dept: string,
  project: string,
  manager: string,
  onlyWithProjects: boolean,
  activeProjectsList: StoredProjectItem[]
): WeekSummary {
  let people = week.people;

  if (onlyWithProjects || project !== 'all') {
    if (project !== 'all') {
      people = people.filter((p) => p.activeProjects.includes(project));
    } else {
      people = people.filter((p) => p.activeProjects.length > 0);
    }
  }

  if (manager !== 'all') {
    people = people.filter((p) => p.managers.includes(manager));
  }

  if (dept !== 'all') {
    const targetDept = dept;
    people = people.filter((p) => {
      const depts = p.departments.length > 0 ? p.departments : ['Sem departamento'];
      return depts.includes(targetDept);
    });
  }

  // Recalcula resumos preservando as estatísticas
  const projectMap = new Map<string, StoredProjectItem>();
  activeProjectsList.forEach((p) => projectMap.set(p.name, p));

  const activeWeeklyPeople = people.filter((p) => !p.activeAbsence);
  const engaged = activeWeeklyPeople.filter((p) => p.engaged).length;
  const notEngaged = activeWeeklyPeople.length - engaged;

  // Notas dos projetos: calculadas só com as pessoas do recorte de departamento/gerente
  // (o filtro de projeto não reduz os membros dos demais projetos exibidos)
  let projectPeople = week.people;
  if (manager !== 'all') projectPeople = projectPeople.filter((p) => p.managers.includes(manager));
  if (dept !== 'all') {
    projectPeople = projectPeople.filter((p) => (p.departments.length > 0 ? p.departments : ['Sem departamento']).includes(dept));
  }
  const activeProjNames = new Set(people.flatMap((p) => p.activeProjects));
  const filteredProjects = groupStatsForProjects(projectPeople, projectMap).filter((pr) => activeProjNames.has(pr.name));

  // Score geral = média simples das notas dos projetos; com um projeto escolhido, é a nota dele
  const scoredProjects = project !== 'all' ? filteredProjects.filter((pr) => pr.name === project) : filteredProjects;
  const validProjScores = scoredProjects
    .map((p) => p.averageScore)
    .filter((s): s is number => s !== null && s !== undefined);

  const averageProjectsScore =
    validProjScores.length > 0
      ? Math.round(validProjScores.reduce((acc, v) => acc + v, 0) / validProjScores.length)
      : null;

  return {
    weekKey: week.weekKey,
    groupName: week.groupName,
    label: week.label,
    periodName: week.periodName,
    refDate: week.refDate,
    windowStart: week.windowStart,
    windowEnd: week.windowEnd,
    granularity: week.granularity,
    people,
    total: people.length,
    engaged,
    notEngaged,
    rate: activeWeeklyPeople.length > 0 ? Math.round((engaged / activeWeeklyPeople.length) * 100) : 0,
    accessAfterRef: people.filter((p) => p.accessAfterRef).length,
    departments: groupStatsByPersonAverage(people, (p) => p.departments, 'Sem departamento'),
    projects: filteredProjects,
    managers: groupStatsByPersonAverage(people, (p) => p.managers),
    averageProjectsScore,
    evaluatedPeriodInfo: week.evaluatedPeriodInfo,
  };
}

export function splitMultiValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Calcula o Score periódico de uma pessoa considerando as semanas do período avaliado e afastamentos.
 */
function calculatePersonScore(
  personEmail: string,
  recordsByWeek: Map<string, EngagementRecord>,
  periodWeeks: WeekRef[],
  userAbsences: AbsenceInfo[]
): PersonPeriodScore {
  const periodWeeksInBase = periodWeeks.length;
  // Só contam as semanas em que a pessoa estava ativa (tem linha "Ativado" na Base)
  const periodWeeksDates = periodWeeks.filter((w) => recordsByWeek.has(w.key));
  const absences = userAbsences.filter(
    (a) => a.email.toLowerCase().trim() === personEmail.toLowerCase().trim()
  );

  if (periodWeeksDates.length === 0) {
    return {
      totalPeriodWeeks: 0,
      periodWeeksInBase,
      excludedWeeks: 0,
      evaluatedWeeks: 0,
      engagedWeeks: 0,
      scorePercent: null,
      scoreText: 'Sem dados no período',
      isAllAbsence: false,
      activeAbsenceOnRef: null,
    };
  }

  let excludedCount = 0;
  let engagedCount = 0;

  periodWeeksDates.forEach((w) => {
    // 1. Semana excluída por afastamento
    if (isWeekExcludedByAbsence(w.ref, absences).excluded) {
      excludedCount++;
      return;
    }
    // 2. Semana ativa: ao menos um acesso (check) dentro do intervalo guardado do grupo
    if (isEngagedIn(recordsByWeek.get(w.key), w)) engagedCount++;
  });

  const evaluatedWeeks = periodWeeksDates.length - excludedCount;

  if (evaluatedWeeks === 0) {
    return {
      totalPeriodWeeks: periodWeeksDates.length,
      periodWeeksInBase,
      excludedWeeks: excludedCount,
      evaluatedWeeks: 0,
      engagedWeeks: 0,
      scorePercent: null,
      scoreText: 'Afastado no período',
      isAllAbsence: true,
      activeAbsenceOnRef: null,
    };
  }

  const scorePercent = Math.round((engagedCount / evaluatedWeeks) * 100);
  const wk = evaluatedWeeks === 1 ? 'semana ativa' : 'semanas ativas';
  let scoreText = `${scorePercent}% (${engagedCount} de ${evaluatedWeeks} ${wk})`;
  if (excludedCount > 0) {
    scoreText = `${scorePercent}% (${engagedCount} de ${evaluatedWeeks} ${wk}, ${excludedCount} ${
      excludedCount === 1 ? 'semana' : 'semanas'
    } de afastamento)`;
  }

  return {
    totalPeriodWeeks: periodWeeksDates.length,
    periodWeeksInBase,
    excludedWeeks: excludedCount,
    evaluatedWeeks,
    engagedWeeks: engagedCount,
    scorePercent,
    scoreText,
    isAllAbsence: false,
    activeAbsenceOnRef: null,
  };
}

/**
 * Agrupa por período e calcula todas as métricas analíticas e scores
 */
export function buildWeeks(
  records: EngagementRecord[],
  activeProjectsList: StoredProjectItem[] = [],
  _granularity: TimeGranularity = 'weekly',
  deParaTable: Record<string, string> = {},
  allAbsences: AbsenceInfo[] = [],
  weekGroups: WeekGroupInput[] = [],
  period: PeriodOption | null = null
): WeekSummary[] {
  // Sem período escolhido, o resultado é sempre semanal (uma visão por semana da Base).
  // Com período escolhido, o resultado é UMA visão com as semanas cujo sábado cai no período.
  const granularity: TimeGranularity = period ? period.granularity : 'weekly';
  const knownTeams = buildKnownTeamNames(activeProjectsList, deParaTable);
  const projectMetaMap = new Map<string, StoredProjectItem>();
  activeProjectsList.forEach((p) => projectMetaMap.set(p.name, p));

  // Semanas = grupos existentes na Base (nunca datas distintas nem números fixos)
  const weekByGroup = buildWeekRefs(records, weekGroups);
  const allWeekRefs = Array.from(new Set(weekByGroup.values())).sort((a, b) => a.ref.getTime() - b.ref.getTime());

  const personMaxLastAccess = new Map<string, Date>();
  const personRecordsByWeek = new Map<string, Map<string, EngagementRecord>>();
  const personBaseMeta = new Map<string, { name: string; email: string }>();
  // Equipe, departamento, projetos e gerentes de cada pessoa EM CADA SEMANA (o que o CSV daquela semana indicou)
  interface WeekAttrs { teams: Set<string>; depts: Set<string>; projs: Set<string>; mgrs: Set<string> }
  const weekAttrs = new Map<string, Map<string, WeekAttrs>>();
  const refByKey = new Map<string, WeekRef>();
  allWeekRefs.forEach((w) => refByKey.set(w.key, w));
  const EMPTY_ATTRS: WeekAttrs = { teams: new Set(), depts: new Set(), projs: new Set(), mgrs: new Set() };
  /** Atributos da semana; se a pessoa não tem linha nela, usa a semana mais próxima (antes, senão depois) só para exibir. */
  const attrsAt = (pKey: string, w: WeekRef): WeekAttrs => {
    const byWeek = weekAttrs.get(pKey);
    if (!byWeek) return EMPTY_ATTRS;
    const exact = byWeek.get(w.key);
    if (exact) return exact;
    let before: { t: number; a: WeekAttrs } | null = null;
    let after: { t: number; a: WeekAttrs } | null = null;
    byWeek.forEach((a, k) => {
      const wr = refByKey.get(k);
      if (!wr) return;
      const t = wr.ref.getTime();
      if (t <= w.ref.getTime()) { if (!before || t > before.t) before = { t, a }; }
      else if (!after || t < after.t) after = { t, a };
    });
    const b = before as { t: number; a: WeekAttrs } | null;
    const f = after as { t: number; a: WeekAttrs } | null;
    return b?.a ?? f?.a ?? EMPTY_ATTRS;
  };

  records.forEach((r) => {
    const weekRef = weekByGroup.get(recordGroupKey(r));
    if (!weekRef) return;
    const rk = weekRef.key;

    const key = personKey(r.name, r.email);
    if (!key) return;

    if (r.lastAccess) {
      const currMax = personMaxLastAccess.get(key);
      if (!currMax || r.lastAccess > currMax) {
        personMaxLastAccess.set(key, r.lastAccess);
      }
    }

    if (!personRecordsByWeek.has(key)) personRecordsByWeek.set(key, new Map());
    personRecordsByWeek.get(key)?.set(rk, r);

    if (!personBaseMeta.has(key)) {
      personBaseMeta.set(key, {
        name: r.name?.trim() || r.email || 'Sem nome',
        email: r.email?.trim() || '',
      });
    }

    // Só a linha desta semana alimenta a equipe/departamento desta semana (nada é copiado entre semanas)
    if (!weekAttrs.has(key)) weekAttrs.set(key, new Map());
    const byWeek = weekAttrs.get(key)!;
    if (!byWeek.has(rk)) byWeek.set(rk, { teams: new Set(), depts: new Set(), projs: new Set(), mgrs: new Set() });
    const attrs = byWeek.get(rk)!;
    const rawTeams = splitTeams(r.team, knownTeams);
    rawTeams.forEach((t) => attrs.teams.add(t));
    splitMultiValues(r.department).forEach((d) => attrs.depts.add(d));

    rawTeams.forEach((t) => {
      const match = matchTeamToActiveProject(t, activeProjectsList, deParaTable);
      if (match.project) {
        attrs.projs.add(match.project.name);
        (match.project.managers || []).forEach((m) => {
          if (m.trim()) attrs.mgrs.add(m.trim());
        });
      }
    });
  });

  const weeks: WeekSummary[] = [];

  // Semanas do período escolhido (pelo sábado). A última delas serve de referência para afastamentos.
  const inPeriod = period ? allWeekRefs.filter((w) => weekInPeriod(toISODate(w.end), period)) : [];
  const targetRefs = period ? inPeriod.slice(-1) : allWeekRefs;

  // Período sem nenhuma semana analisada: visão vazia (tudo zerado), sem erro
  if (period && inPeriod.length === 0) {
    const label = `${period.longLabel} · ${period.rangeText}`;
    return [
      summarize(
        {
          weekKey: `period:${period.key}`,
          groupName: '',
          label,
          periodName: period.longLabel,
          refDate: period.end,
          windowStart: period.start,
          windowEnd: period.end,
          granularity,
          people: [],
          evaluatedPeriodInfo: { periodName: period.longLabel, label, weeksCount: 0 },
        },
        activeProjectsList
      ),
    ];
  }

  targetRefs.forEach((weekRef) => {
    const ref = weekRef.ref;
    const rk = weekRef.key;
    let start: Date;
    let end: Date;
    let label: string;
    let periodName: string;
    let periodWeeksDates: WeekRef[] = [];

    if (period) {
      start = period.start;
      end = period.end;
      label = `${period.longLabel} · ${period.rangeText}`;
      periodName = period.longLabel;
      periodWeeksDates = inPeriod;
    } else {
      start = weekRef.start;
      end = weekRef.end;
      label = `${weekRef.group || 'Semana'} · referência ${formatBR(ref)} · acessos de ${shortDate(start)} a ${shortDate(end)}`;
      periodName = weekRef.group || `Semana de ${formatBR(ref)}`;
      periodWeeksDates = [weekRef];
    }

    const peopleList: PersonWeek[] = [];

    personBaseMeta.forEach((meta, pKey) => {
      const maxLastAccess = personMaxLastAccess.get(pKey) ?? null;
      const recordsMap = personRecordsByWeek.get(pKey) ?? new Map();
      const currentWeekRecord = recordsMap.get(rk);
      // Semanas do período em que a pessoa estava ativa; sem nenhuma, ela não existe nesta visão
      const activeWeeksOfPerson = periodWeeksDates.filter((w) => recordsMap.has(w.key));
      if (activeWeeksOfPerson.length === 0) return;

      const personEmailNorm = meta.email.toLowerCase().trim();
      const personAbsences = personEmailNorm
        ? allAbsences.filter((a) => a.email.toLowerCase().trim() === personEmailNorm)
        : [];
      const activeAbsence = getActiveAbsenceOnDate(ref, personAbsences);

      // Score do período selecionado
      const periodScore = calculatePersonScore(meta.email, recordsMap, periodWeeksDates, allAbsences);
      periodScore.activeAbsenceOnRef = activeAbsence;

      // Score na Base: semanas ativas / grupos da Base até esta referência
      const upToRefWeeks = allWeekRefs.filter((w) => w.ref.getTime() <= ref.getTime());
      const overallScore = calculatePersonScore(meta.email, recordsMap, upToRefWeeks, allAbsences);

      // Engajamento no critério semanal: ao menos um acesso no intervalo do grupo
      const endOfWeek = weekRef.end;
      const engagedWeekly = isEngagedIn(currentWeekRecord, weekRef);

      // Atributos de cada semana do período: a pessoa pode estar em projetos diferentes em semanas diferentes
      const attrsList = activeWeeksOfPerson.map((w) => attrsAt(pKey, w));
      const unionOf = (pick: (a: WeekAttrs) => Set<string>) =>
        Array.from(new Set(attrsList.flatMap((a) => Array.from(pick(a)))));
      const personProjs = unionOf((a) => a.projs);

      peopleList.push({
        key: pKey,
        name: meta.name,
        email: meta.email,
        teams: unionOf((a) => a.teams),
        departments: unionOf((a) => a.depts),
        activeProjects: personProjs,
        managers: unionOf((a) => a.mgrs),
        lastAccess: maxLastAccess,
        engaged: engagedWeekly,
        ...accessGap(engagedWeekly, currentWeekRecord?.lastAccess ?? maxLastAccess, endOfWeek),
        accessAfterRef: !!maxLastAccess && maxLastAccess > endOfWeek,
        activeAbsence,
        periodScore,
        overallWeeksEngaged: overallScore.engagedWeeks,
        overallWeeksEvaluated: overallScore.evaluatedWeeks,
        overallScorePercent: overallScore.scorePercent,
        projectWeeks: computePersonProjectWeeks(
          activeWeeksOfPerson,
          attrsList.map((a) => a.projs),
          projectMetaMap,
          recordsMap,
          personAbsences
        ),
      });
    });

    peopleList.sort((a, b) => a.name.localeCompare(b.name));

    weeks.push(
      summarize(
        {
          weekKey: period ? `period:${period.key}` : rk,
          groupName: period ? '' : weekRef.group,
          label,
          periodName,
          refDate: ref,
          windowStart: start,
          windowEnd: end,
          granularity,
          people: peopleList,
          evaluatedPeriodInfo:
            period
              ? {
                  periodName,
                  label,
                  weeksCount: periodWeeksDates.length,
                }
              : undefined,
        },
        activeProjectsList
      )
    );
  });

  return weeks.sort((a, b) => a.refDate.getTime() - b.refDate.getTime());
}
