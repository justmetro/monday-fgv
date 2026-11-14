import { defineCollection } from '@vibe/db';

/** Projeto = quadro de origem. Identidade: boardId. config = JSON (ProjectConfig). */
export interface ProjectDoc {
  boardId: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  boardUrl: string;
  config: string;
  indicatorCount: number;
  measurementCount: number;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  syncStatus: 'ok' | 'error' | 'running' | 'never';
  syncMessage: string;
  createdBy: string;
  /** Ausente = ativo. Só projetos ativos contam no painel, panorama e indicadores. */
  enabled?: boolean;
  /** Projeto cadastrado sem indicador elaborado (sem leitura de grupos/colunas). */
  noIndicators?: boolean;
  // ——— Vínculo com o Histórico de Projetos (fonte complementar; campos opcionais) ———
  /** Código ano/número extraído do nome do quadro de origem. */
  hCode?: string | null;
  /** confirmed = vínculo confirmado; pending = sem vínculo (ver hPendingReason). Ausente = nunca avaliado. */
  hLink?: 'confirmed' | 'pending' | null;
  hPendingReason?: string | null;
  hOrigin?: 'code' | 'manual' | null;
  hShared?: boolean | null;
  hBoardId?: string | null;
  hItemId?: string | null;
  hItemName?: string | null;
  hItemUrl?: string | null;
  hItemCode?: string | null;
  hConflict?: string | null;
  hStatus?: string | null;
  hStatusColor?: string | null;
  hManagers?: string[];
  hManagerIds?: string[];
  hAxes?: string[];
  /** ok | empty | unmapped | unavailable — por campo. */
  hStatusState?: string | null;
  hManagerState?: string | null;
  hAxesState?: string | null;
  hLastSuccessAt?: string | null;
  hLastAttemptAt?: string | null;
  hLastOk?: boolean | null;
  hLastMessage?: string | null;
  /** ok | not_returned | error */
  hValidation?: string | null;
  // ——— Grupos operacionais (opcionais; ausentes = grupo não configurado) ———
  scheduleCount?: number;
  subitemCount?: number;
  productCount?: number;
  riskCount?: number;
  /** JSON: Record<GroupKey, { status: 'ok' | 'error' | 'off'; message: string; at: string }>. */
  groupSync?: string;
}

/** Campos comuns aos registros importados dos grupos operacionais. */
interface OpsBase {
  projectBoardId: string;
  itemId: string;
  name: string;
  unavailable: string[];
  unmapped: string[];
  active: boolean;
  syncedAt: string;
  flagsAt?: string;
}

export interface ScheduleItemDoc extends OpsBase {
  frentes: string | null;
  responsaveis: string[];
  status: string | null;
  saude: string | null;
  produtoIds: string[];
  produtoText: string | null;
  inicioPlanejado: string | null;
  fimPlanejado: string | null;
  flagSemResponsavel?: boolean;
  flagSemCronograma?: boolean;
  flagAtrasada?: boolean;
}

export interface ScheduleSubitemDoc extends OpsBase {
  parentItemId: string;
  responsaveis: string[];
  status: string | null;
  produtoIds: string[];
  produtoText: string | null;
  inicioPlanejado: string | null;
  fimPlanejado: string | null;
  flagSemResponsavel?: boolean;
  flagSemCronograma?: boolean;
  flagAtrasada?: boolean;
}

export interface ProductDoc extends OpsBase {
  valorText: string | null;
  valor: number | null;
  linkUrl: string | null;
  linkText: string | null;
  envioCpa: string | null;
  comecoReal: string | null;
  entregaReal: string | null;
  status: string | null;
  faturamentoText: string | null;
  faturamento: number | null;
  pagamentoText: string | null;
  pagamento: number | null;
  statusPagamento: string | null;
  entregaPlanejada: string | null;
  /** Timeline "Planejado Início - Entrega" (opcional). */
  planInicio?: string | null;
  planEntrega?: string | null;
  flagEntregaAtrasada?: boolean;
  flagSemEntregaPlanejada?: boolean;
  flagEntregueSemFaturamento?: boolean;
  flagPagamentoPendente?: boolean;
}

export interface RiskDoc extends OpsBase {
  periodo: string | null;
  tema: string | null;
  categoria: string | null;
  impactado: string | null;
  causa: string | null;
  efeito: string | null;
  probabilidadeStatus: string | null;
  impactoStatus: string | null;
  nivel: string | null;
  estrategia: string | null;
  resposta: string | null;
  responsaveis: string[];
  ultimaAtualizacao: string | null;
  probabilidadeFormula: string | null;
  impactoFormula: string | null;
  flagSemResponsavel?: boolean;
  flagAtualizacaoAntiga?: boolean;
  flagDivergencia?: boolean;
}

export const scheduleItems = defineCollection<ScheduleItemDoc>({ name: 'schedule_items', indexes: ['projectBoardId'] });
export const scheduleSubitems = defineCollection<ScheduleSubitemDoc>({ name: 'schedule_subitems', indexes: ['projectBoardId'] });
export const products = defineCollection<ProductDoc>({ name: 'products', indexes: ['projectBoardId'] });
export const risks = defineCollection<RiskDoc>({ name: 'risks', indexes: ['projectBoardId'] });

/** Configuração única do quadro de referência "Histórico de Projetos". */
export interface HistoryConfigDoc {
  boardId: string;
  boardName: string;
  boardUrl: string;
  statusCol: string | null;
  managerCol: string | null;
  axesCol: string | null;
  codeCol: string | null;
  savedAt: string;
  savedBy: string;
}

/** Campos de valor: string | null. Campos em `unavailable` não puderam ser obtidos; em `unmapped`, não mapeados. */
export interface IndicatorDoc {
  projectBoardId: string;
  itemId: string;
  name: string;
  descricao: string | null;
  objetivo: string | null;
  tipo: string | null;
  krVinculadoIds: string[];
  krVinculadoText: string | null;
  formaColeta: string | null;
  temporalidade: string | null;
  meta: string | null;
  polaridade: string | null;
  unidade: string | null;
  formula: string | null;
  qtdMedicoes: string | null;
  medicaoIds: string[];
  resultadoConsolidado: string | null;
  unavailable: string[];
  unmapped: string[];
  active: boolean;
  syncedAt: string;
}

export interface MeasurementDoc {
  projectBoardId: string;
  itemId: string;
  name: string;
  prazo: string | null;
  responsaveis: string[];
  statusMedicao: string | null;
  indicadorIds: string[];
  meta: string | null;
  valorApurado: string | null;
  resultado: string | null;
  statusMeta: string | null;
  baseDadosText: string | null;
  baseDadosUrls: string[];
  baseDadosLabels: string[];
  periodo: string | null;
  /** Sinalizações gravadas na sincronização (data de referência = flagsAt). */
  flagPrazoVencido?: boolean;
  flagSemBaseDados?: boolean;
  flagSemPrazo?: boolean;
  flagsAt?: string;
  unavailable: string[];
  unmapped: string[];
  active: boolean;
  syncedAt: string;
}

export interface SyncLogDoc {
  projectBoardId: string;
  at: string;
  ok: boolean;
  summary: string;
}

/** Token pessoal da Monday por usuário. Lido somente no servidor; nunca devolvido ao navegador. */
export interface UserTokenDoc {
  userId: string;
  token: string;
  mondayName: string;
  savedAt: string;
}
export const userTokens = defineCollection<UserTokenDoc>({ name: 'user_tokens', indexes: ['userId'] });

export const projects = defineCollection<ProjectDoc>({ name: 'projects', indexes: ['boardId'] });
export const indicators = defineCollection<IndicatorDoc>({ name: 'indicators', indexes: ['projectBoardId'] });
export const measurements = defineCollection<MeasurementDoc>({ name: 'measurements', indexes: ['projectBoardId'] });
export const historyConfig = defineCollection<HistoryConfigDoc>({ name: 'history_config' });
export const syncLogs = defineCollection<SyncLogDoc>({ name: 'sync_logs', indexes: ['projectBoardId'] });

/** Classificação temática de um indicador (separada dos dados importados). Chave = projectBoardId:itemId. */
export interface IndicatorClassDoc {
  key: string;
  projectBoardId: string;
  itemId: string;
  tema: string;
  subtema: string;
  familia: string;
  publico: string | null;
  justificativa: string;
  confianca: 'alta' | 'media' | 'baixa';
  precisaRevisao: boolean;
  /** ia = sugestão da IA; manual = definida por pessoa; ia_revisada = sugestão da IA confirmada. */
  origem: 'ia' | 'manual' | 'ia_revisada';
  revisado: boolean;
  revisadoEm: string | null;
  /** Assinatura dos campos textuais usados na classificação. */
  assinatura: string;
  /** Textos mudaram após a classificação: revisar (a decisão anterior não é sobrescrita). */
  textoAlterado?: boolean;
  taxonomiaVersao: number;
  classificadoEm: string;
}
export const indicatorClasses = defineCollection<IndicatorClassDoc>({ name: 'indicator_classes', indexes: ['key'] });

export interface TaxonomyMetaDoc { versao: number; updatedAt: string }
export const taxonomyMeta = defineCollection<TaxonomyMetaDoc>({ name: 'taxonomy_meta' });

/** Rotina diária de atualização (uma execução por dia útil). results = JSON: { boardId, name, ok, summary, at }[]. */
export interface DailyRunDoc {
  date: string;
  status: 'running' | 'done';
  startedAt: string;
  updatedAt: string;
  finishedAt?: string | null;
  by: string;
  byName?: string | null;
  total: number;
  results: string;
}
export const dailyRuns = defineCollection<DailyRunDoc>({ name: 'daily_runs', indexes: ['date'] });

// ——— Exportação para quadros analíticos da Monday (Base Analítica — Portfólio) ———
/** Configuração única: workspace de destino, pasta e quadros/colunas criados (boards = JSON). */
export interface ExportConfigDoc {
  workspaceId: string;
  workspaceName: string;
  folderId: string | null;
  boards: string;
  updatedAt: string;
  updatedBy: string;
}
export const exportConfig = defineCollection<ExportConfigDoc>({ name: 'export_config' });

/** Item já exportado: chave do registro → item na Monday + assinatura dos valores gravados. */
export interface ExportItemDoc {
  board: string;
  chave: string;
  projectBoardId: string;
  mondayItemId: string;
  sig: string;
  state: 'ativo' | 'removido';
  updatedAt: string;
}
export const exportItems = defineCollection<ExportItemDoc>({ name: 'export_items', indexes: ['projectBoardId', ['projectBoardId', 'board']] });

/** Execução de exportação (manual ou rotina diária); stats = JSON por quadro. */
export interface ExportRunDoc {
  at: string;
  updatedAt: string;
  origin: 'manual' | 'diaria';
  by: string;
  byName: string;
  stats: string;
  projects: number;
  errors: string;
}
export const exportRuns = defineCollection<ExportRunDoc>({ name: 'export_runs', indexes: ['at'] });
