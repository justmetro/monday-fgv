import { createServerFn } from '@tanstack/react-start';
import { respostaMonday } from '../../../server/monday';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import {
  snapshotMetaCollection,
  engagementChunksCollection,
  projectsDocCollection,
  pmoConfigCollection,
  boardIdsConfigCollection,
  teamProjectRowsCollection,
  absencesCollection,
  panelUploadRunsCollection,
  baseWeekStatusCollection,
  type AbsenceDoc,
  type AbsenceOrigin,
  type ImportDiscard,
  type ImportReport,
  type StoredEngagementRow,
  type StoredProjectItem,
} from '@generated/models';
import {
  NOT_A_PROJECT_FLAG,
  buildKnownTeamNames,
  matchTeamToActiveProject,
  normalizeName,
  splitTeams,
} from '@generated/lib/projectMatcher';
import { parseDateFlexible, toISODate } from '@generated/lib/dates';
import { isActivatedStatus, countDistinctPeople } from '@generated/lib/userStatus';
import { WEEKDAYS, isCheckedValue } from '@generated/lib/weekdays';
import {
  OWNER_EMAIL,
  PMO_CONFIG_DOC_ID,
  assertTokenOwner,
  normalizeEmail,
  readPmoEmails,
  resolveSession,
  type UserSessionInfo,
} from './session.server';
import { loadTeamMappingRows, rowsToTable, type TeamMappingRowView } from './teamMapping.server';
import { dbReadWithRetry } from './vibeDbRetry.server';
import { loadBaseRows, saveBaseRows, upsertInto } from './base.server';
import { loadPendingPeriodKeys, mirrorBoardWeeksIntoBase } from './weekPeriod.server';
import { canEdit, canRemove, canValidate, isProjetosDepartment } from '@generated/lib/vacationFlow';

export type { UserSessionInfo } from './session.server';
export type { TeamMappingRowView } from './teamMapping.server';

const META_DOC_ID = 'main_meta';
const PROJECTS_DOC_ID = 'main_projects';
const BOARD_IDS_DOC_ID = 'main_board_ids';

import { PROJECTS_STORE_VERSION, filterActiveProjects, isActiveProjectStatus } from '@generated/lib/activeProjects';

export interface EngagementSnapshotView {
  updatedAt: string;
  updatedBy: { id: string; name: string; email?: string };
  rowsCount: number;
  projectsCount: number;
  rows: StoredEngagementRow[];
  projects: StoredProjectItem[];
  deParaTable: Record<string, string>;
  deParaRows: TeamMappingRowView[]; // Vazio para quem não tem acesso de gestão
  importReport: ImportReport | null;
  absences: (AbsenceDoc & { id: string })[];
  scope: 'full' | 'manager';
  userProfileRecord?: StoredEngagementRow | null; // Registro da própria pessoa logada
  excludedByStatus: number; // Pessoas na base salva com Status do usuário diferente de "Ativado"
  legacyGroups: string[]; // Semanas importadas da base antiga (ficam fora do score geral)
  weekGroups: BaseWeekGroup[]; // Grupos (semanas) existentes na Base inteira — é o que conta como "semana atualizada"
  projectsInfo: ProjectsInfo; // Situação dos projetos salvos (para os avisos e o contador do de-para)
}

/** Situação dos projetos guardados na Base. */
export interface ProjectsInfo {
  savedCount: number; // Todos os projetos salvos (qualquer status)
  importedAt: string | null;
  needsReimport: boolean; // Salvos pela regra antiga: faltam os projetos "Em encerramento"
}

function projectsInfoOf(doc: { projects?: unknown[]; rulesVersion?: number; importedAt?: string } | undefined): ProjectsInfo {
  const savedCount = doc?.projects?.length ?? 0;
  return { savedCount, importedAt: doc?.importedAt ?? null, needsReimport: savedCount > 0 && doc?.rulesVersion !== PROJECTS_STORE_VERSION };
}

export interface BaseWeekGroup {
  group: string;
  weekStart: string; // AAAA-MM-DD (segunda), do intervalo guardado no grupo
  weekEnd: string; // AAAA-MM-DD (domingo)
  refDate: string; // Data da análise do grupo (a mais recente das linhas do grupo)
}

const normGroup = (g: string | undefined) => (g ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

/** Lista os grupos da Base (pelas linhas) com o intervalo guardado no grupo; sem intervalo, usa a semana da data da análise. */
async function loadWeekGroups(rows: StoredEngagementRow[]): Promise<BaseWeekGroup[]> {
  const statusDocs = await dbReadWithRetry('semanas', () => db.collection(baseWeekStatusCollection).limit(1000).get());
  const byGroup = new Map<string, { group: string; refDate: string }>();
  rows.forEach((r) => {
    const k = normGroup(r.group);
    if (!k) return;
    const ref = toISODate(parseDateFlexible(r.refDate));
    const cur = byGroup.get(k);
    if (!cur) byGroup.set(k, { group: (r.group ?? '').trim(), refDate: ref });
    else if (ref > cur.refDate) cur.refDate = ref;
  });
  return Array.from(byGroup.entries()).flatMap(([k, g]) => {
    const st = statusDocs.find((d) => normGroup(d.data.group) === k)?.data;
    let weekStart = st?.weekStart ?? '';
    let weekEnd = st?.weekEnd ?? '';
    if (!weekStart || !weekEnd) {
      const ref = parseDateFlexible(g.refDate);
      if (!ref) return [];
      // Domingo a sábado da data da análise
      const sun = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay());
      weekStart = toISODate(sun);
      weekEnd = toISODate(new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6));
    }
    return [{ group: g.group, weekStart, weekEnd, refDate: g.refDate || weekEnd }];
  });
}

/** Grupos (semanas) vindos de envios "base antiga": ficam fora do score geral. */
async function loadLegacyGroups(): Promise<string[]> {
  try {
    const docs = await db.collection(panelUploadRunsCollection).limit(1000).get();
    return Array.from(new Set(docs.filter((d) => d.data.kind === 'base_antiga').map((d) => d.data.groupName)));
  } catch (e) {
    console.error('Erro ao ler as semanas da base antiga:', e);
    return [];
  }
}

function requireManage(session: UserSessionInfo) {
  if (!session.canManage) throw new Error('Apenas o dono, Administradores e membros do PMO podem fazer isso.');
}

/** "Ver como gerente" só é aceito para dono, admin e PMO (ou quando é o próprio usuário). */
function assertViewAsAllowed(session: UserSessionInfo, viewAsManager: string | undefined) {
  const v = viewAsManager?.trim();
  if (!v || session.canManage) return;
  if (normalizeName(v) !== normalizeName(session.name)) {
    throw new Error('Você não tem permissão para ver como outro gerente.');
  }
}

const clientClaimSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
    name: z.string().optional(),
    isAdmin: z.boolean().optional(),
    emailSource: z.string().max(20).optional(), // 'contexto' | 'me' (só para o diagnóstico)
  })
  .optional();

export const getUserSession = createServerFn({ method: 'GET' })
  .validator(clientClaimSchema)
  .handler(async ({ data }): Promise<UserSessionInfo> => resolveSession(data));

// Lê a base salva com isolamento estrito no servidor
export const getStoredSnapshot = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      clientClaim: clientClaimSchema,
      viewAsManager: z.string().optional(), // Modo "Ver como gerente" para dono/admin/PMO
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    assertViewAsAllowed(session, data.viewAsManager);
    try {
      // Leituras com novas tentativas: na abertura sem "Editar App" o servidor costuma estar "frio"
      // e a primeira leitura pode falhar. Falha de leitura NÃO é "base inexistente".
      const metaDoc = await dbReadWithRetry('meta', () => db.collection(snapshotMetaCollection).doc(META_DOC_ID).get());
      if (!metaDoc?.data) return { hasData: false, snapshot: null };
      const meta = metaDoc.data;

      const projectsDoc = await dbReadWithRetry('projetos', () =>
        db.collection(projectsDocCollection).doc(PROJECTS_DOC_ID).get()
      );
      const allProjects = filterActiveProjects(projectsDoc?.data?.projects);

      // Lê estritamente os chunks válidos (0 .. chunkCount-1)
      const ids = Array.from({ length: meta.chunkCount ?? 0 }, (_, i) => `chunk_${i}`);
      const chunkDocs = await Promise.all(
        ids.map((id) => dbReadWithRetry(id, () => db.collection(engagementChunksCollection).doc(id).get()))
      );
      if (chunkDocs.some((c) => !c?.data)) throw new Error('Base salva incompleta no momento da leitura.');
      const rawRows: StoredEngagementRow[] = [];
      chunkDocs.forEach((c) => {
        if (c?.data?.rows) rawRows.push(...c.data.rows);
      });
      // Semanas sem período definido (importação pela API) ficam fora de todos os scores e painéis
      const pendingKeys = await loadPendingPeriodKeys();
      const periodRows = pendingKeys.size > 0 ? rawRows.filter((r) => !pendingKeys.has(normGroup(r.group))) : rawRows;
      // Regra de usuários ativos aplicada também à base já salva
      const allRows = periodRows.filter((r) => isActivatedStatus(r.userStatus));
      const excludedByStatus = countDistinctPeople(periodRows.filter((r) => !isActivatedStatus(r.userStatus)));

      const mappingRows = await dbReadWithRetry('de-para', () => loadTeamMappingRows());
      const fullTable = rowsToTable(mappingRows);

      // Carrega todos os afastamentos
      const absenceDocs = await dbReadWithRetry('afastamentos', () =>
        db.collection(absencesCollection).limit(1000).get()
      );
      const allAbsences = absenceDocs.map((d) => ({ ...d.data, id: d.id }));
      const legacyGroups = (await loadLegacyGroups()).filter((g) => !pendingKeys.has(normGroup(g)));
      const weekGroups = await loadWeekGroups(allRows);

      // Registro do perfil da própria pessoa logada
      const userEmailNorm = normalizeEmail(session.email);
      const userProfileRecord = userEmailNorm
        ? allRows.find((r) => normalizeEmail(r.email) === userEmailNorm) ?? null
        : null;

      // Se tem permissão de gestão e NÃO está no modo "Ver como gerente"
      if (session.canManage && !data.viewAsManager) {
        const snapshot: EngagementSnapshotView = {
          updatedAt: meta.updatedAt,
          updatedBy: meta.updatedBy,
          rowsCount: meta.rowsCount,
          projectsCount: meta.projectsCount,
          rows: allRows,
          projects: allProjects,
          deParaTable: fullTable,
          deParaRows: mappingRows,
          importReport: meta.importReport ?? null,
          absences: allAbsences,
          scope: 'full',
          userProfileRecord,
          excludedByStatus,
          legacyGroups,
          weekGroups,
          projectsInfo: projectsInfoOf(projectsDoc?.data),
        };
        return { hasData: true, snapshot };
      }

      // Painel do Gerente (usuário normal ou modo "Ver como gerente" para gestão)
      let targetManagerName = normalizeName(session.name);
      if (data.viewAsManager && session.canManage) {
        targetManagerName = normalizeName(data.viewAsManager);
      }

      const managed = targetManagerName
        ? allProjects.filter((p) => p.managers.some((m) => normalizeName(m) === targetManagerName))
        : [];
      const managedNames = new Set(managed.map((p) => p.name));
      const known = buildKnownTeamNames(allProjects, fullTable);

      const rows: StoredEngagementRow[] = [];
      const managedPeopleEmails = new Set<string>();

      allRows.forEach((r) => {
        const isSelf = userEmailNorm && normalizeEmail(r.email) === userEmailNorm;
        const kept = splitTeams(r.team, known).filter((t) => {
          const m = matchTeamToActiveProject(t, allProjects, fullTable);
          return m.project !== null && managedNames.has(m.project.name);
        });

        if (kept.length > 0) {
          rows.push({ ...r, team: kept.join(', ') });
          if (r.email) managedPeopleEmails.add(normalizeEmail(r.email));
        } else if (isSelf) {
          // Mantém o registro da própria pessoa para o Meu Perfil sem vazar para o painel de outros projetos
          rows.push(r);
        }
      });

      // Afastamentos relevantes para o gerente (pessoas dos projetos dele + ele mesmo)
      const allowedAbsenceEmails = new Set(managedPeopleEmails);
      if (userEmailNorm) allowedAbsenceEmails.add(userEmailNorm);

      const managerAbsences = allAbsences.filter((a) => allowedAbsenceEmails.has(normalizeEmail(a.email)));

      const table: Record<string, string> = {};
      Object.entries(fullTable).forEach(([k, v]) => {
        if (managedNames.has(v)) table[k] = v;
      });

      const snapshot: EngagementSnapshotView = {
        updatedAt: meta.updatedAt,
        updatedBy: { id: '', name: meta.updatedBy?.name ?? '' },
        rowsCount: rows.length,
        projectsCount: managed.length,
        rows,
        projects: managed,
        deParaTable: table,
        deParaRows: [],
        importReport: null,
        absences: managerAbsences,
        scope: 'manager',
        userProfileRecord,
        excludedByStatus: 0,
        legacyGroups,
        weekGroups,
        projectsInfo: projectsInfoOf(projectsDoc?.data),
      };
      return { hasData: true, snapshot };
    } catch (error) {
      // Lança para o app manter os últimos dados sincronizados em vez de mostrar "sem base"
      console.error('Erro ao ler a base salva:', (error as Error)?.message);
      throw new Error('Não foi possível ler a base salva agora.');
    }
  });

// ---------- Gestão de Afastamentos (Férias e Licença) ----------

// Contexto do cadastro: departamento da pessoa (Base) e se quem age é gerente de algum projeto dela
// (mesma fonte do Painel do Gerente: equipes da Base → projetos do Histórico → gerentes).
async function absenceContext(session: UserSessionInfo, targetEmail: string, viewAsManager?: string) {
  const [{ rows }, projectsDoc, mappingRows] = await Promise.all([
    loadBaseRows(),
    db.collection(projectsDocCollection).doc(PROJECTS_DOC_ID).get(),
    loadTeamMappingRows(),
  ]);
  const projects = filterActiveProjects(projectsDoc?.data?.projects);
  const table = rowsToTable(mappingRows);
  const known = buildKnownTeamNames(projects, table);
  const personRows = rows
    .filter((r) => normalizeEmail(r.email) === targetEmail && isActivatedStatus(r.userStatus))
    .sort((a, b) => (b.refDate ?? '').localeCompare(a.refDate ?? ''));
  const departamento = personRows.find((r) => r.department?.trim())?.department?.trim() ?? '';
  const managerNames = new Set<string>();
  personRows.forEach((r) =>
    splitTeams(r.team, known).forEach((t) => {
      const m = matchTeamToActiveProject(t, projects, table);
      m.project?.managers.forEach((x) => managerNames.add(normalizeName(x)));
    })
  );
  let effective = normalizeName(session.name);
  if (viewAsManager && session.canManage) effective = normalizeName(viewAsManager);
  const isManagerOfPerson = Boolean(effective) && managerNames.has(effective) && normalizeEmail(session.email) !== targetEmail;
  const inBase = rows.some((r) => normalizeEmail(r.email) === targetEmail);
  return { departamento, projetos: isProjetosDepartment(departamento), isManagerOfPerson, inBase };
}

const actorOf = (session: UserSessionInfo) => ({ id: session.id, name: session.name, email: session.email });

const ORIGIN_LABEL: Record<'geral' | 'gerente' | 'perfil', AbsenceOrigin> = {
  geral: 'Painel Geral',
  gerente: 'Painel do Gerente',
  perfil: 'Meu Perfil',
};
const originSchema = z.enum(['geral', 'gerente', 'perfil']);

/**
 * Quem pode agir, conferido a cada chamada no servidor:
 * - Painel Geral: só dono, admin ou PMO (qualquer pessoa da Base);
 * - Painel do Gerente: o gerente dos projetos da pessoa (ou a própria pessoa);
 * - Meu Perfil: só a própria pessoa.
 */
function authorizeAbsence(
  session: UserSessionInfo,
  origem: 'geral' | 'gerente' | 'perfil',
  viewAsManager: string | undefined,
  isSelf: boolean,
  isManagerOfPerson: boolean
): 'gestao' | 'self' | 'manager' {
  if (origem === 'geral') {
    if (!session.canManage || viewAsManager?.trim()) {
      throw new Error('Somente dono, admin ou PMO podem gerenciar afastamentos de qualquer pessoa no Painel Geral.');
    }
    return 'gestao';
  }
  if (isSelf) return 'self';
  if (origem === 'perfil') throw new Error('No Meu Perfil você só pode gerenciar o seu próprio afastamento.');
  if (!isManagerOfPerson) {
    throw new Error('No Painel do Gerente você só pode gerenciar afastamentos de pessoas dos seus projetos ativos.');
  }
  return 'manager';
}

export const saveAbsence = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().optional(), // se informado, atualiza
      email: z.string().email(),
      tipo: z.enum(['Férias', 'Licença']),
      inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      volta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      origem: originSchema,
      clientClaim: clientClaimSchema,
      viewAsManager: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    assertViewAsAllowed(session, data.viewAsManager);
    const userEmail = normalizeEmail(session.email);
    const targetEmail = normalizeEmail(data.email);

    if (!userEmail) throw new Error('Não foi possível identificar o usuário logado.');

    // Valida que a data de volta é posterior à de início
    if (data.volta) {
      const dInicio = parseDateFlexible(data.inicio);
      const dVolta = parseDateFlexible(data.volta);
      if (dInicio && dVolta && dVolta.getTime() <= dInicio.getTime()) {
        throw new Error('A data de volta ao trabalho deve ser posterior à data de início.');
      }
    }

    const isSelf = userEmail === targetEmail;
    const ctx = await absenceContext(session, targetEmail, data.viewAsManager);
    const role = authorizeAbsence(session, data.origem, data.viewAsManager, isSelf, ctx.isManagerOfPerson);
    const actor = { email: userEmail, isManagerOfPerson: ctx.isManagerOfPerson };
    const origin = ORIGIN_LABEL[data.origem];
    const now = new Date().toISOString();

    const existing = data.id ? await db.collection(absencesCollection).doc(data.id).get() : null;
    if (data.id && !existing) throw new Error('Período não encontrado.');
    if (existing && normalizeEmail(existing.data.email) !== targetEmail) {
      throw new Error('Este período pertence a outra pessoa.');
    }
    if (existing?.data.removido) throw new Error('Este período foi removido.');

    // ----- Edição -----
    if (existing && data.id) {
      if (role !== 'gestao' && existing.data.fluxo === 'projetos') {
        const allowed = canEdit(existing.data, actor);
        if (!allowed.ok) throw new Error(allowed.reason);
      }
      await db.collection(absencesCollection).doc(data.id).update({
        tipo: data.tipo, inicio: data.inicio, volta: data.volta || null,
        atualizadoEm: now, atualizadoPor: actorOf(session), atualizadoOrigem: origin,
      });
      return { success: true, id: data.id, status: existing.data.status };
    }

    // ----- Novo registro -----
    if (role === 'gestao' && !ctx.inBase) throw new Error('Esta pessoa não está na Base.');
    const base: AbsenceDoc = {
      email: targetEmail, tipo: data.tipo, inicio: data.inicio, volta: data.volta || null,
      criadoEm: now, criadoPor: actorOf(session), criadoOrigem: origin,
    };
    // Departamento Projetos: fluxo com validação. Gerente ou gestão cadastrando para a pessoa: já nasce validado.
    const payload: AbsenceDoc = ctx.projetos
      ? {
          ...base, fluxo: 'projetos', departamento: ctx.departamento,
          status: role === 'self' ? 'pendente' : 'validado',
          ...(role === 'self' ? {} : { validadoPor: actorOf(session), validadoEm: now }),
        }
      : base;
    const doc = await db.collection(absencesCollection).add(payload);
    return { success: true, id: doc.id, status: payload.status };
  });

/** Gerente valida as férias de uma pessoa dos seus projetos (somente departamento Projetos). */
export const validateAbsence = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), clientClaim: clientClaimSchema, viewAsManager: z.string().optional() }))
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    assertViewAsAllowed(session, data.viewAsManager);
    const userEmail = normalizeEmail(session.email);
    if (!userEmail) throw new Error('Não foi possível identificar o usuário logado.');
    const doc = await db.collection(absencesCollection).doc(data.id).get();
    if (!doc) throw new Error('Período não encontrado.');
    const ctx = await absenceContext(session, normalizeEmail(doc.data.email), data.viewAsManager);
    const allowed = canValidate(doc.data, { email: userEmail, isManagerOfPerson: ctx.isManagerOfPerson });
    if (!allowed.ok) throw new Error(allowed.reason);
    const now = new Date().toISOString();
    await db.collection(absencesCollection).doc(data.id).update({ status: 'validado', validadoPor: actorOf(session), validadoEm: now });
    return { success: true, validadoEm: now };
  });

export const deleteAbsence = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1),
      origem: originSchema,
      clientClaim: clientClaimSchema,
      viewAsManager: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    assertViewAsAllowed(session, data.viewAsManager);
    const userEmail = normalizeEmail(session.email);
    if (!userEmail) throw new Error('Não foi possível identificar o usuário logado.');

    const doc = await db.collection(absencesCollection).doc(data.id).get();
    if (!doc) return { success: true };

    const targetEmail = normalizeEmail(doc.data.email);
    const ctx = await absenceContext(session, targetEmail, data.viewAsManager);
    const role = authorizeAbsence(session, data.origem, data.viewAsManager, userEmail === targetEmail, ctx.isManagerOfPerson);

    // Departamento Projetos: o registro fica, marcado como removido (auditoria)
    if (doc.data.fluxo === 'projetos') {
      if (doc.data.removido) return { success: true };
      if (role !== 'gestao') {
        const allowed = canRemove(doc.data, { email: userEmail, isManagerOfPerson: ctx.isManagerOfPerson });
        if (!allowed.ok) throw new Error(allowed.reason);
      }
      await db.collection(absencesCollection).doc(data.id).update({
        removido: true, removidoPor: actorOf(session), removidoEm: new Date().toISOString(),
        removidoOrigem: ORIGIN_LABEL[data.origem],
      });
      return { success: true };
    }

    await db.collection(absencesCollection).doc(data.id).delete();
    return { success: true };
  });

// ---------- IDs dos Quadros para API ----------

export const getBoardIdsConfig = createServerFn({ method: 'GET' })
  .validator(clientClaimSchema)
  .handler(async ({ data }) => {
    const session = await resolveSession(data);
    requireManage(session);
    try {
      const doc = await db.collection(boardIdsConfigCollection).doc(BOARD_IDS_DOC_ID).get();
      return {
        engagementBoardId: doc?.data?.engagementBoardId ?? '',
        projectsBoardId: doc?.data?.projectsBoardId ?? '',
      };
    } catch (e) {
      console.error('Erro ao ler IDs dos quadros:', e);
      return { engagementBoardId: '', projectsBoardId: '' };
    }
  });

export const saveBoardIdsConfig = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      engagementBoardId: z.string().max(100),
      projectsBoardId: z.string().max(100),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);
    await db.collection(boardIdsConfigCollection).doc(BOARD_IDS_DOC_ID).set({
      engagementBoardId: data.engagementBoardId.trim(),
      projectsBoardId: data.projectsBoardId.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: session.name,
    });
    return { success: true };
  });

// ---------- Lista do PMO ----------

export const getPmoEmails = createServerFn({ method: 'GET' })
  .validator(clientClaimSchema)
  .handler(async ({ data }) => {
    const session = await resolveSession(data);
    requireManage(session);
    const list = await readPmoEmails();
    return { pmoEmails: Array.from(new Set([OWNER_EMAIL, ...list])), ownerEmail: OWNER_EMAIL };
  });

export const savePmoEmails = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      emails: z.array(z.string()).max(1000),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);
    const clean = data.emails.map(normalizeEmail).filter((e) => e.includes('@'));
    // O e-mail do dono nunca sai da lista do PMO
    const pmoEmails = Array.from(new Set([OWNER_EMAIL, ...clean]));
    await db.collection(pmoConfigCollection).doc(PMO_CONFIG_DOC_ID).set({
      updatedAt: new Date().toISOString(),
      updatedBy: { id: session.id, name: session.name },
      pmoEmails,
    });
    return { success: true, pmoEmails };
  });

// ---------- Tabela de-para ----------

function validTarget(projeto: string) {
  return projeto.trim().length > 0;
}

export const addTeamMapping = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      equipe: z.string().min(1).max(500),
      projeto: z.string().min(1).max(500),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);
    const equipe = data.equipe.trim();
    const projeto = data.projeto.trim() === NOT_A_PROJECT_FLAG ? NOT_A_PROJECT_FLAG : data.projeto.trim();
    if (!equipe || !validTarget(projeto)) throw new Error('Informe a equipe e o projeto.');

    // Se a equipe já existir (igualdade normalizada), atualiza a linha
    const rows = await loadTeamMappingRows();
    const existing = rows.find((r) => normalizeName(r.equipe) === normalizeName(equipe));
    const payload = { equipe, projeto, updatedAt: new Date().toISOString(), updatedBy: session.name };
    if (existing) {
      await db.collection(teamProjectRowsCollection).doc(existing.id).set(payload);
      return { success: true, id: existing.id };
    }
    const doc = await db.collection(teamProjectRowsCollection).add(payload);
    return { success: true, id: doc.id };
  });

export const updateTeamMapping = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1),
      equipe: z.string().min(1).max(500),
      projeto: z.string().min(1).max(500),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);
    await db.collection(teamProjectRowsCollection).doc(data.id).set({
      equipe: data.equipe.trim(),
      projeto: data.projeto.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: session.name,
    });
    return { success: true };
  });

export const deleteTeamMapping = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);
    await db.collection(teamProjectRowsCollection).doc(data.id).delete();
    return { success: true };
  });

// ---------- Importação e Persistência do Snapshot ----------

const engagementRowSchema = z.object({
  name: z.string().max(500),
  email: z.string().max(500),
  team: z.string().max(5000),
  department: z.string().max(2000),
  lastAccess: z.string().max(100),
  weekStart: z.string().max(100),
  refDate: z.string().max(100),
  userStatus: z.string().max(200),
  // Só a importação pela API traz o grupo (semana) e os checks por dia
  group: z.string().max(500).optional(),
  checkedDays: z.array(z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])).max(7).optional(),
  createdAt: z.string().max(100).optional(),
});

const projectRowSchema = z.object({
  name: z.string().max(1000),
  sgi: z.string().max(1000),
  sigla: z.string().max(500),
  status: z.string().max(200),
  managers: z.string().max(2000),
  axis: z.string().max(500),
  client: z.string().max(2000),
  startDate: z.string().max(100).optional().nullable(),
});

function countReasons(map: Map<string, number>): ImportDiscard[] {
  return Array.from(map.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

function splitList(raw: string): string[] {
  return raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

/** Todos os projetos do Histórico de Projetos, cada um com o seu status (o filtro de ativos é aplicado só na leitura). Subitens não entram. */
function buildSavedProjects(projects: z.infer<typeof projectRowSchema>[]): { saved: StoredProjectItem[]; reasons: Map<string, number> } {
  const reasons = new Map<string, number>();
  const bump = (k: string) => reasons.set(k, (reasons.get(k) ?? 0) + 1);
  const saved: StoredProjectItem[] = [];
  projects.forEach((p, idx) => {
    if (!p.name.trim()) return bump('Sem nome');
    const status = p.status.trim();
    const parsedStart = parseDateFlexible(p.startDate);
    saved.push({
      id: `p_${idx}`,
      name: p.name.trim(),
      sgi: p.sgi.trim(),
      sigla: p.sigla.trim(),
      status,
      managers: splitList(p.managers),
      axis: p.axis.trim(),
      client: splitList(p.client),
      startDate: parsedStart ? toISODate(parsedStart) : p.startDate?.trim() || null,
    });
  });
  return { saved, reasons };
}

async function persistSnapshotData(
  session: UserSessionInfo,
  engagement: z.infer<typeof engagementRowSchema>[],
  projects: z.infer<typeof projectRowSchema>[],
  sourceNames: { engagement: string; projects: string }
): Promise<ImportReport> {
  const rowReasons = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const rows: StoredEngagementRow[] = [];
  const excludedByStatus = engagement.filter((r) => !isActivatedStatus(r.userStatus));
  engagement.forEach((r) => {
    if (!isActivatedStatus(r.userStatus)) return bump(rowReasons, 'Status do usuário diferente de "Ativado"');
    if (!r.name.trim() && !r.email.trim()) return bump(rowReasons, 'Sem nome e sem e-mail');
    const ref = parseDateFlexible(r.refDate);
    const week = parseDateFlexible(r.weekStart);
    if (!ref && !week) return bump(rowReasons, 'Sem data válida (Date e Início da semana)');
    rows.push({
      name: r.name.trim(),
      email: r.email.trim(),
      team: r.team.trim(),
      department: r.department.trim(),
      lastAccess: r.lastAccess.trim() || null,
      refDate: ref ? toISODate(ref) : null,
      weekStart: week ? toISODate(week) : r.weekStart.trim() || null,
      userStatus: r.userStatus.trim(),
      ...(r.group?.trim() ? { group: r.group.trim() } : {}),
      ...(r.checkedDays && r.checkedDays.length > 0 ? { checkedDays: r.checkedDays } : {}),
      ...(parseDateFlexible(r.createdAt) ? { createdAt: toISODate(parseDateFlexible(r.createdAt)) } : {}),
    });
  });

  const { saved: savedProjects, reasons: projReasons } = buildSavedProjects(projects);

  // Junta na Base por pessoa + semana, em vez de substituir: nunca remove checks nem linhas já gravadas
  // (antes, esta importação regravava a Base inteira com o que estava no quadro e apagava os checks da Base).
  const existing = await loadBaseRows();
  const merged = upsertInto(existing.rows, rows, 'analysis');

  await db.collection(projectsDocCollection).doc(PROJECTS_DOC_ID).set({ projects: savedProjects, rulesVersion: PROJECTS_STORE_VERSION, importedAt: new Date().toISOString() });

  const importReport: ImportReport = {
    engagementFile: sourceNames.engagement,
    projectsFile: sourceNames.projects,
    rowsRead: engagement.length,
    rowsSaved: rows.length,
    rowsDiscarded: countReasons(rowReasons),
    projectsRead: projects.length,
    projectsSaved: savedProjects.length,
    projectsActive: savedProjects.filter((p) => isActiveProjectStatus(p.status)).length,
    projectsDiscarded: countReasons(projReasons),
    peopleExcludedByStatus: countDistinctPeople(excludedByStatus),
  };

  await saveBaseRows(merged.rows, session, importReport);

  return importReport;
}

export const importSnapshotFromFiles = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      engagementFile: z.string().max(300),
      projectsFile: z.string().max(300),
      engagement: z.array(engagementRowSchema).max(50000),
      projects: z.array(projectRowSchema).max(10000),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);

    const report = await persistSnapshotData(session, data.engagement, data.projects, {
      engagement: data.engagementFile,
      projects: data.projectsFile,
    });

    return { success: true, report };
  });

// ---------- Importação Direta via API GraphQL do monday.com com Token Pessoal ----------

interface MondayGraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
  error_message?: string;
  error_code?: string;
}

async function fetchMondayApi<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const maxRetries = 4;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    void token;
    const { status, json: corpo } = await respostaMonday(query, variables, { versao: '2024-10' });
    const response = { status, ok: status < 400, json: async () => corpo };

    if (response.status === 429) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw new Error('Limite de requisições da API do monday atingido. Tente novamente em alguns segundos.');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Token pessoal inválido ou sem permissão de leitura nos quadros.');
      }
      throw new Error(`Falha na API do monday (HTTP ${response.status}).`);
    }

    const json = (await response.json()) as MondayGraphQLResponse<T>;
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0]?.message || 'Erro retornado pela API do monday.');
    }
    if (!json.data) {
      throw new Error('Resposta vazia da API do monday.');
    }
    return json.data;
  }

  throw new Error('Não foi possível obter resposta da API do monday.');
}

// ---------- Importação pela API (em etapas curtas, para não estourar o tempo do servidor) ----------

const importIdsSchema = z.object({
  token: z.unknown().optional().transform(() => 'app' as string),
  engagementBoardId: z.string().min(1).max(100),
  projectsBoardId: z.string().min(1).max(100),
  clientClaim: clientClaimSchema,
});

interface ImportPageItem {
  name: string;
  group?: { title: string } | null;
  column_values: { id: string; text: string | null; value: string | null; label?: string | null }[];
}
interface ImportBoardMeta { id: string; name: string; columns: { id: string; title: string; type: string }[]; groups: { title: string }[] }

async function loadImportBoards(token: string, engBoardId: string, projBoardId: string) {
  const meta = await fetchMondayApi<{ boards: ImportBoardMeta[] }>(
    token,
    `query GetBoardsMeta($ids: [ID!]) { boards(ids: $ids) { id name columns { id title type } groups { title } } }`,
    { ids: [engBoardId, projBoardId] }
  );
  const engBoard = meta.boards.find((b) => String(b.id) === engBoardId);
  if (!engBoard) throw new Error(`Quadro de Análise de Engajamento (ID: ${engBoardId}) não foi encontrado ou o token não tem permissão para acessá-lo.`);
  const projBoard = meta.boards.find((b) => String(b.id) === projBoardId);
  if (!projBoard) throw new Error(`Quadro de Histórico de Projetos (ID: ${projBoardId}) não foi encontrado ou o token não tem permissão para acessá-lo.`);

  const engColMap = new Map<string, string>();
  engBoard.columns.forEach((c) => engColMap.set(normalizeName(c.title), c.id));
  const missingEng = ['E-mail', 'Equipe', 'Departamento', 'Ativo pela última vez', 'Início da semana', 'Date', 'Status do usuário'].filter((n) => !engColMap.has(normalizeName(n)));
  if (missingEng.length > 0) throw new Error(`Faltam colunas no quadro de Engajamento "${engBoard.name}": ${missingEng.join(', ')}.`);

  const projColMap = new Map<string, string>();
  projBoard.columns.forEach((c) => projColMap.set(normalizeName(c.title), c.id));
  const missingProj = ['Nome SGI', 'Sigla do projeto', 'Status do projeto', 'Gerente atual', 'Eixo de projeto', 'Cliente'].filter((n) => !projColMap.has(normalizeName(n)));
  if (missingProj.length > 0) throw new Error(`Faltam colunas no quadro de Projetos "${projBoard.name}": ${missingProj.join(', ')}.`);
  return { engBoard, projBoard, engColMap, projColMap };
}

const colText = (item: ImportPageItem, colId: string | undefined): string => {
  if (!colId) return '';
  const cv = item.column_values.find((c) => c.id === colId);
  // Para colunas de status, usa o rótulo completo (sem abreviação)
  return (cv?.label ?? cv?.text)?.trim() ?? '';
};

/** Uma página (até 500 itens) de um dos quadros, já convertida em linhas. O cliente repete até acabar o cursor. */
export const readImportPage = createServerFn({ method: 'POST' })
  .validator(importIdsSchema.extend({ which: z.enum(['eng', 'proj']), cursor: z.string().max(5000).nullable().optional() }))
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);
    await assertTokenOwner(session, data.token);
    const token = data.token.trim();
    const { engBoard, projBoard, engColMap, projColMap } = await loadImportBoards(token, data.engagementBoardId.trim(), data.projectsBoardId.trim());
    const boardId = data.which === 'eng' ? data.engagementBoardId.trim() : data.projectsBoardId.trim();
    const res = await fetchMondayApi<{ boards: { items_page: { cursor: string | null; items: ImportPageItem[] } }[] }>(
      token,
      `query GetBoardItemsPage($boardId: [ID!], $cursor: String) { boards(ids: $boardId) { items_page(limit: 500, cursor: $cursor) { cursor items { name group { title } column_values { id text value ... on StatusValue { label } } } } } }`,
      { boardId: [boardId], cursor: data.cursor ?? null }
    );
    const page = res.boards[0]?.items_page;
    const items = page?.items ?? [];
    const engRows: z.infer<typeof engagementRowSchema>[] = [];
    const projRows: z.infer<typeof projectRowSchema>[] = [];
    if (data.which === 'eng') {
      const dayCol = (title: string) => engBoard.columns.find((c) => c.type === 'checkbox' && normalizeName(c.title) === normalizeName(title));
      items.forEach((item) => {
        engRows.push({
          group: item.group?.title ?? '',
          checkedDays: WEEKDAYS.filter((w) => {
            const col = dayCol(w.title);
            const cv = col ? item.column_values.find((c) => c.id === col.id) : undefined;
            return Boolean(col) && isCheckedValue(cv?.value, cv?.text);
          }).map((w) => w.key),
          name: item.name || '',
          email: colText(item, engColMap.get(normalizeName('E-mail'))),
          team: colText(item, engColMap.get(normalizeName('Equipe'))),
          department: colText(item, engColMap.get(normalizeName('Departamento'))),
          lastAccess: colText(item, engColMap.get(normalizeName('Ativo pela última vez'))),
          weekStart: colText(item, engColMap.get(normalizeName('Início da semana'))),
          refDate: colText(item, engColMap.get(normalizeName('Date'))),
          userStatus: colText(item, engColMap.get(normalizeName('Status do usuário'))),
          createdAt: colText(item, engColMap.get(normalizeName('Criado em'))),
        });
      });
    } else {
      const startColId =
        projColMap.get(normalizeName('Início real da operação')) || projColMap.get(normalizeName('Data de início')) || projColMap.get(normalizeName('Início'));
      items.forEach((item) => {
        projRows.push({
          name: item.name || '',
          sgi: colText(item, projColMap.get(normalizeName('Nome SGI'))),
          sigla: colText(item, projColMap.get(normalizeName('Sigla do projeto'))),
          status: colText(item, projColMap.get(normalizeName('Status do projeto'))),
          managers: colText(item, projColMap.get(normalizeName('Gerente atual'))),
          axis: colText(item, projColMap.get(normalizeName('Eixo de projeto'))),
          client: colText(item, projColMap.get(normalizeName('Cliente'))),
          startDate: startColId ? colText(item, startColId) : undefined,
        });
      });
    }
    return {
      engRows, projRows, cursor: page?.cursor ?? null,
      engName: engBoard.name, projName: projBoard.name, groups: engBoard.groups.map((g) => g.title),
    };
  });

/** Depois de os dois quadros serem lidos por inteiro, a Base passa a espelhar o quadro de Engajamento. */
export const applyImportedSnapshot = createServerFn({ method: 'POST' })
  .validator(
    importIdsSchema.extend({
      engName: z.string().max(500),
      projName: z.string().max(500),
      groups: z.array(z.string().max(500)).max(2000),
      engRows: z.array(engagementRowSchema).max(60000),
      projRows: z.array(projectRowSchema).max(30000),
    })
  )
  .handler(async ({ data }) => {
    const session = await resolveSession(data.clientClaim);
    requireManage(session);
    await assertTokenOwner(session, data.token);
    const engBoardId = data.engagementBoardId.trim();
    const projBoardId = data.projectsBoardId.trim();
    const parsedEngagement = data.engRows;
    const parsedProjects = data.projRows;

    // Cada grupo do quadro é uma semana; cada item do grupo é uma linha de pessoa.
    let noIdentification = 0;
    let noGroup = 0;
    const incoming: StoredEngagementRow[] = [];
    parsedEngagement.forEach((r) => {
      if (!r.name.trim() && !r.email.trim()) { noIdentification++; return; }
      const group = (r.group ?? '').trim();
      if (!group) { noGroup++; return; }
      const ref = parseDateFlexible(r.refDate);
      const week = parseDateFlexible(r.weekStart);
      const created = parseDateFlexible(r.createdAt);
      incoming.push({
        name: r.name.trim(),
        email: r.email.trim(),
        team: r.team.trim(),
        department: r.department.trim(),
        lastAccess: r.lastAccess.trim() || null,
        refDate: ref ? toISODate(ref) : null,
        weekStart: week ? toISODate(week) : r.weekStart.trim() || null,
        userStatus: r.userStatus.trim(),
        group,
        checkedDays: r.checkedDays ?? [],
        ...(created ? { createdAt: toISODate(created) } : {}),
      });
    });
    const { saved: savedProjects, reasons: projReasons } = buildSavedProjects(parsedProjects);
    const discards: ImportDiscard[] = [];
    if (noIdentification > 0) discards.push({ reason: 'Sem nome e sem e-mail', count: noIdentification });
    if (noGroup > 0) discards.push({ reason: 'Item sem grupo', count: noGroup });

    const { report } = await mirrorBoardWeeksIntoBase(
      session,
      incoming,
      data.groups,
      (weeks, rowsSaved) => ({
        engagementFile: `API: ${data.engName} (ID ${engBoardId})`,
        projectsFile: `API: ${data.projName} (ID ${projBoardId})`,
        rowsRead: parsedEngagement.length,
        rowsSaved,
        rowsDiscarded: discards,
        projectsRead: parsedProjects.length,
        projectsSaved: savedProjects.length,
        projectsActive: savedProjects.filter((p) => isActiveProjectStatus(p.status)).length,
        projectsDiscarded: countReasons(projReasons),
        peopleExcludedByStatus: countDistinctPeople(parsedEngagement.filter((r) => !isActivatedStatus(r.userStatus))),
        weeks,
      })
    );
    await db.collection(projectsDocCollection).doc(PROJECTS_DOC_ID).set({ projects: savedProjects, rulesVersion: PROJECTS_STORE_VERSION, importedAt: new Date().toISOString() });

    return { success: true, report };
  });
