import { defineCollection } from '@vibe/db';

export interface StoredEngagementRow {
  name: string;
  email: string;
  team: string; // Texto da coluna Equipe (opções separadas por vírgula)
  department: string;
  lastAccess: string | null;
  refDate: string | null;
  weekStart: string | null;
  weekEnd?: string | null; // Domingo da semana guardada do grupo (AAAA-MM-DD)
  userStatus?: string; // Texto completo do rótulo "Status do usuário" (só "Ativado" conta)
  group?: string; // Título do grupo (semana) do item no quadro
  checkedDays?: string[]; // Dias marcados no item: 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'
  createdAt?: string | null; // Data de entrada na Monday (coluna "Criado em"), AAAA-MM-DD
  // Valores das demais colunas (título da coluna → texto), para espelhar a linha no quadro
  boardValues?: Record<string, string>;
}

// Validação manual da semana na aba Base
export interface BaseWeekStatusDoc {
  group: string;
  status: 'pendente' | 'validada';
  updatedAt: string;
  updatedByEmail: string;
  updatedByName: string;
  // Intervalo da semana guardado ao criar o grupo, calculado da Data da análise (o nome do grupo é só rótulo)
  weekStart?: string; // AAAA-MM-DD (segunda)
  weekEnd?: string; // AAAA-MM-DD (domingo)
  rangeFromDate?: string; // Data da análise que definiu o intervalo
  lastReprocessedAt?: string;
  // Semana vinda da importação pela API sem período definido: fica fora dos scores e painéis até o período ser salvo
  periodPending?: boolean;
  reopenedAt?: string;
  reopenedByEmail?: string;
  reopenedByName?: string;
  // Contadores do painel da semana, gravados ao salvar o período
  counters?: { people: number; checks: number; outside: number; noAccess: number; byDay: Record<string, number> };
}

export const baseWeekStatusCollection = defineCollection<BaseWeekStatusDoc>({
  name: 'base_week_status',
});

// Histórico de ações nas semanas da Base (quem, qual semana, quando)
export interface BaseWeekLogDoc {
  at: string;
  action: 'apagou_semana' | 'reabriu_semana' | 'definiu_periodo' | 'removida_na_importacao' | 'reescreveu_semana';
  group: string;
  byEmail: string;
  byName: string;
  detail?: string;
}

export const baseWeekLogCollection = defineCollection<BaseWeekLogDoc>({
  name: 'base_week_log',
  indexes: ['at'],
});

// Fila do que ficou na Base mas ainda não foi confirmado no quadro (um documento por semana)
export interface MirrorQueueDoc {
  group: string;
  pendingCount: number;
  pendingNames: string[]; // até 200 nomes, para exibição
  checksPending: number;
  lastError: string;
  updatedAt: string;
}

export const mirrorQueueCollection = defineCollection<MirrorQueueDoc>({
  name: 'mirror_queue',
});

// Última conferência Quadro x Base
export interface BaseSyncDifference {
  group: string;
  name: string;
  email: string;
  type: 'missing_in_board' | 'missing_in_base' | 'checked_days_diff' | 'last_access_diff';
  detail: string;
}

export interface BaseSyncWeekTotals {
  group: string;
  boardPeople: number;
  basePeople: number;
  boardChecks: number;
  baseChecks: number;
}

export interface BaseSyncStatusDoc {
  checkedAt: string;
  checkedByName: string;
  inSync: boolean;
  boardRows: number;
  baseRows: number;
  differencesCount: number;
  differences: BaseSyncDifference[]; // até 300
  weeks: BaseSyncWeekTotals[];
}

export const baseSyncStatusCollection = defineCollection<BaseSyncStatusDoc>({
  name: 'base_sync_status',
});

export interface StoredProjectItem {
  id: string;
  name: string;
  sgi: string;
  sigla: string;
  status: string;
  managers: string[];
  axis: string;
  client: string[];
  startDate?: string | null; // Data de início do projeto (AAAA-MM-DD ou texto formatado)
}

export interface ImportDiscard {
  reason: string;
  count: number;
}

/** Resultado da importação pela API: semanas do quadro espelhadas na Base. */
export interface WeeksImportReport {
  kept: string[];
  created: string[];
  removed: string[];
  people: { group: string; people: number }[];
  pendingPeriod: string[];
}

export interface ImportReport {
  engagementFile: string;
  projectsFile: string;
  rowsRead: number;
  rowsSaved: number;
  rowsDiscarded: ImportDiscard[];
  projectsRead: number;
  projectsSaved: number;
  projectsActive?: number; // Dos salvos, quantos são ativos pela regra atual
  projectsDiscarded: ImportDiscard[];
  peopleExcludedByStatus?: number; // Pessoas únicas com Status do usuário diferente de "Ativado"
  weeks?: WeeksImportReport; // Só na importação pela API
}

// Metadados principais do snapshot
export interface SnapshotMetaDoc {
  updatedAt: string; // ISO string
  updatedBy: {
    id: string;
    name: string;
    email?: string;
  };
  rowsCount: number;
  projectsCount: number;
  chunkCount: number;
  importReport?: ImportReport;
}

// Chunks de colaboradores (até 250 linhas por documento, bem abaixo do limite de 256KB)
export interface EngagementChunkDoc {
  index: number;
  rows: StoredEngagementRow[];
}

// Projetos ativos consolidados
export interface ProjectsDoc {
  projects: StoredProjectItem[]; // Todos os projetos do Histórico, cada um com o seu Status do Projeto
  rulesVersion?: number; // 2 = guarda todos os projetos (sem filtro de status); ausente = guardou só os ativos pela regra antiga
  importedAt?: string; // ISO da última importação dos projetos
}

export interface PmoConfigDoc {
  updatedAt: string;
  updatedBy: {
    id: string;
    name: string;
  };
  pmoEmails: string[];
}

// Configuração dos IDs dos quadros para importação via API do monday
export interface BoardIdsConfigDoc {
  engagementBoardId: string;
  projectsBoardId: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Compatibilidade com de-para legado e controle de seed
export interface LegacyTeamMappingDoc {
  mapping?: Record<string, string>;
}

export interface TeamMappingMetaDoc {
  seededAt?: string;
}

export const legacyTeamMappingCollection = defineCollection<LegacyTeamMappingDoc>({
  name: 'team_mapping_legacy',
});

export const teamMappingMetaCollection = defineCollection<TeamMappingMetaDoc>({
  name: 'team_mapping_meta',
});

// Linha da tabela de-para: equipe -> nome completo do projeto ativo ou "Não é projeto"
export interface TeamProjectRow {
  equipe: string;
  projeto: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Afastamentos (Férias e Licenças)
export type AbsenceType = 'Férias' | 'Licença';

export type AbsenceOrigin = 'Painel Geral' | 'Painel do Gerente' | 'Meu Perfil';

export interface AbsenceDoc {
  email: string; // E-mail normalizado do colaborador
  tipo: AbsenceType;
  inicio: string; // YYYY-MM-DD (primeiro dia fora)
  volta: string | null; // YYYY-MM-DD (primeiro dia de trabalho, opcional)
  criadoEm: string; // ISO string
  criadoPor: {
    id: string;
    name: string;
    email: string;
  };
  atualizadoEm?: string;
  atualizadoPor?: {
    id: string;
    name: string;
    email: string;
  };
  // Fluxo de validação — somente departamento Projetos (campos opcionais; cadastros antigos seguem a regra antiga)
  fluxo?: 'projetos';
  departamento?: string;
  status?: 'pendente' | 'validado';
  validadoPor?: { id: string; name: string; email: string };
  validadoEm?: string;
  removido?: boolean;
  removidoPor?: { id: string; name: string; email: string };
  removidoEm?: string;
  // Origem de cada ação (tela onde foi feita)
  criadoOrigem?: AbsenceOrigin;
  atualizadoOrigem?: AbsenceOrigin;
  removidoOrigem?: AbsenceOrigin;
}

// Histórico da aba "Atualizar Painel" (nunca guarda o token)
export type PanelUploadStatus = 'em_andamento' | 'concluido' | 'concluido_com_falhas' | 'parado' | 'cancelado' | 'erro';

export type MirrorStage = 'criar' | 'campos' | 'checks' | 'equipes';

export interface PanelUploadFailure {
  row: number; // linha do CSV (1 = cabeçalho)
  name: string;
  reason: string;
  stage?: MirrorStage; // etapa em que a falha ocorreu
}

export interface PanelUploadMetrics {
  elapsedMs: number;
  itemsPerSecond: number;
  itemsPerCallStart: number;
  itemsPerCallFinal: number;
  itemsPerCallHistory: number[]; // tamanhos usados, incluindo reduções automáticas
  parallelCalls: number;
  calls: number; // chamadas de criação em lote
  verifications: number; // leituras do grupo para evitar duplicados
  retries: number;
  errorsByKind: Record<string, number>;
  rawErrors?: string[]; // mensagens originais da API (sem o token), até 20 diferentes
}

// Últimos ajustes usados na gravação (não sensíveis)
export interface PanelUploadSettingsDoc {
  itemsPerCall: number;
  parallelCalls: number;
  updatedAt: string;
}

export const panelUploadSettingsCollection = defineCollection<PanelUploadSettingsDoc>({
  name: 'panel_upload_settings',
});

export interface PanelUploadRunDoc {
  weekStart?: string; // período digitado no envio (domingo), AAAA-MM-DD
  weekEnd?: string; // período digitado no envio (sábado)
  kind?: 'normal' | 'base_antiga'; // "base antiga" não entra no score geral
  legacyByStatus?: Record<string, number>; // base antiga: linhas que entraram por status antigo
  // Reescrita de semana (base antiga): contagens de antes e depois (sem token)
  rewrite?: {
    before: { people: number; checks: number; boardItems: number | null; analysisDate?: string };
    after: { people: number; checks: number };
  };
  metrics?: PanelUploadMetrics;
  // Contadores por etapa, sempre da leitura de volta do quadro
  fieldsTodo?: number; // último acesso/Date a avançar em itens existentes
  fieldsDone?: number;
  teamExpected?: number;
  teamConfirmed?: number;
  failuresByStage?: Partial<Record<MirrorStage, number>>;
  duplicateNames?: string[]; // pessoas com mais de um item no grupo do quadro
  discardedByLabel?: Record<string, number>; // desativadas sem linha na semana (ignoradas), por "Status do usuário"
  deactivated?: number; // marcadas como Desativado nesta semana (lido de volta da Base)
  reactivated?: number; // voltaram a Ativado nesta semana
  ignoredDeactivated?: number;
  // Modelo semanal com checks por dia (opcionais para manter registros antigos)
  weekday?: string; // 'seg' | 'ter' | 'qua' | 'qui' | 'sex'
  groupExisted?: boolean;
  toUpdate?: number;
  updated?: number;
  unchanged?: number;
  checksToMark?: number;
  checksMarked?: number; // checks confirmados no quadro por leitura de volta
  checksExpected?: number; // checks que a Base tem para a semana
  checksWithoutColumn?: number; // checks de sábado/domingo sem coluna no quadro (ficam só na Base)
  baseCreated?: number;
  baseUpdated?: number;
  baseUnchanged?: number;
  checkColumnId?: string; // única coluna de check que esta gravação pode marcar
  updateColumnIds?: string[]; // únicas colunas que esta gravação pode alterar em itens existentes
  boardId: string;
  groupId: string;
  groupName: string;
  analysisDate: string; // AAAA-MM-DD
  fileName: string;
  uploadedByEmail: string;
  uploadedByName: string;
  uploadedById: string;
  startedAt: string; // ISO
  lastActivityAt: string; // ISO
  finishedAt?: string;
  status: PanelUploadStatus;
  stopReason?: string;
  rowsRead: number;
  discardedByStatus: number;
  toCreate: number;
  created: number;
  failed: number;
  pending: number;
  ignoredColumns: string[];
  failures: PanelUploadFailure[];
}

export const panelUploadRunsCollection = defineCollection<PanelUploadRunDoc>({
  name: 'panel_upload_runs',
  indexes: ['status', 'startedAt', 'analysisDate'],
});

export const snapshotMetaCollection = defineCollection<SnapshotMetaDoc>({
  name: 'snapshot_meta',
});

export const engagementChunksCollection = defineCollection<EngagementChunkDoc>({
  name: 'engagement_chunks',
  indexes: ['index'],
});

export const projectsDocCollection = defineCollection<ProjectsDoc>({
  name: 'snapshot_projects',
});

export const pmoConfigCollection = defineCollection<PmoConfigDoc>({
  name: 'pmo_config',
});

export const boardIdsConfigCollection = defineCollection<BoardIdsConfigDoc>({
  name: 'board_ids_config',
});

export const teamProjectRowsCollection = defineCollection<TeamProjectRow>({
  name: 'team_project_rows',
});

export const absencesCollection = defineCollection<AbsenceDoc>({
  name: 'user_absences',
  indexes: ['email', 'tipo'],
});

/** Histórico de exclusões da Base (quem apagou e quando). */
export interface BaseDeletionLogDoc {
  deletedAt: string;
  deletedByEmail: string;
  deletedByName: string;
  rowsDeleted: number;
}

export const baseDeletionLogCollection = defineCollection<BaseDeletionLogDoc>({
  name: 'base_deletion_log',
  indexes: ['deletedAt'],
});
