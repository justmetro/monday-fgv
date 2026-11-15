import { defineCollection } from '@vibe/db';

/**
 * App-only data of the "Alocação de Gerentes" tab (shared by every user, never written to monday
 * except at Validação). Every doc records who changed it and when.
 */

/** Manual override of a calculated value ("voltar ao calculado" deletes the doc). One per (tipo, alvoId). */
export interface AlocAjuste {
  /** "desativado": manager (Mapa id) or project (02.01 id) hidden by default (valor = '1'). */
  tipo: 'temperatura' | 'complexidade' | 'capacidade' | 'eixos' | 'desativado';
  /** Project id (temperatura/complexidade) or Mapa manager id (capacidade/eixos/desativado). */
  alvoId: string;
  valor: string;
  /** Only for tipo = eixos. */
  valores: string[];
  autor: string;
  autorId: string;
  em: string;
}

/** Comment per manager, or per project (optionally per manager inside the project). */
export interface AlocComentario {
  escopo: 'gerente' | 'projeto';
  alvoId: string;
  /** For escopo = projeto with more than one manager; '' otherwise. */
  gerenteId: string;
  texto: string;
  autor: string;
  autorId: string;
  em: string;
}

/** Projection: destination project → manager / CDPE (interno) / externo / Novo gerente. */
export interface AlocProjecao {
  projetoId: string;
  projetoNome: string;
  destinoTipo: 'gerente' | 'cdpe' | 'novo' | 'externo';
  /** Mapa manager id (gerente/externo), "novo" (single "Novo gerente"; old docs may hold "novo:…"); '' for CDPE. */
  gerenteId: string;
  /** Manager name, "Novo gerente" or the external name. */
  gerenteNome: string;
  /**
   * novo = project without manager in the 02.01 relation; reforco = adds a manager to the existing relation;
   * troca = replaces the relation. Optional (older docs) → read as "novo".
   */
  tipo?: 'novo' | 'reforco' | 'troca';
  status: 'Pendente' | 'Validada';
  autor: string;
  autorId: string;
  em: string;
  validadoPor: string;
  validadoEm: string;
}

/** Manual record of the "Histórico de projetos" (old projects); Mapa and validated rows are derived. */
export interface AlocHistorico {
  gerenteId: string;
  gerenteNome: string;
  projetoNome: string;
  eixo: string;
  /** yyyy-mm-dd or ''. */
  inicio: string;
  fim: string;
  autor: string;
  autorId: string;
  em: string;
}

/** Report line of an import that matched no 02.01 project (kept until linked or dismissed). */
export interface AlocImportPendente {
  nomeRelatorio: string;
  etapa: string;
  temp: string;
  autor: string;
  autorId: string;
  em: string;
}

/** Adjustable capacity rule (nearest active-project date, in days); a single doc — default 30/60/90 when absent. */
export interface AlocRegraCapacidade {
  curtoDias: number;
  medioDias: number;
  longoDias: number;
  autor: string;
  autorId: string;
  em: string;
}

/** JSON snapshot of a doc (`antes` / `depois` of an action). */
export type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };
export type JsonObj = { [k: string]: JsonVal };

export const ACAO_TIPOS = [
  'ajuste', 'voltar_calculado', 'desativar', 'reativar', 'massa', 'projetar', 'trocar_projecao', 'remover_projecao',
  'comentario', 'historico_adicionar', 'historico_editar', 'historico_remover', 'importacao', 'descartar_pendente',
  'validar', 'desfazer_status', 'desfazer', 'regra_capacidade', 'relatorio',
] as const;
export type AcaoTipo = (typeof ACAO_TIPOS)[number];
export const ACAO_LABEL: Record<AcaoTipo, string> = {
  ajuste: 'Ajuste de valor', voltar_calculado: 'Voltar ao calculado', desativar: 'Desativar', reativar: 'Reativar',
  massa: 'Ação em massa', projetar: 'Projetar', trocar_projecao: 'Trocar projeção', remover_projecao: 'Remover projeção',
  comentario: 'Comentário', historico_adicionar: 'Histórico: adicionar', historico_editar: 'Histórico: editar',
  historico_remover: 'Histórico: remover', importacao: 'Importação de PDF', descartar_pendente: 'Descartar pendente',
  validar: 'Validação', desfazer_status: 'Desfazer status', desfazer: 'Desfazer',
  regra_capacidade: 'Regra de capacidade', relatorio: 'Relatório gerado',
};
export const AJUSTE_LABEL: Record<AlocAjuste['tipo'], string> = {
  temperatura: 'Temperatura', complexidade: 'Complexidade', capacidade: 'Capacidade', eixos: 'Eixos', desativado: 'Desativação',
};

/** One affected doc: full state before (null = didn't exist) and after (null = deleted). */
export interface AlocMudanca {
  colecao: string;
  docId: string;
  /** Readable target (project / manager). */
  alvo: string;
  antes: JsonObj | null;
  depois: JsonObj | null;
}

/** Action log of the tab ("Registro de ações"), kept for 90 days; undo restores every `antes`. */
export interface AlocAcao {
  lote: string;
  tipo: AcaoTipo;
  descricao: string;
  autor: string;
  autorId: string;
  em: string;
  desfeita: boolean;
  desfeitaPor: string;
  desfeitaEm: string;
  itens: number;
  mudancas: AlocMudanca[];
  /** For tipo = desfazer: id of the undone action. */
  desfazDe?: string;
}

export const alocAjustes = defineCollection<AlocAjuste>({ name: 'aloc_ajustes' });
export const alocAcoes = defineCollection<AlocAcao>({ name: 'aloc_acoes', indexes: ['em'] });
export const alocComentarios = defineCollection<AlocComentario>({ name: 'aloc_comentarios' });
export const alocProjecoes = defineCollection<AlocProjecao>({ name: 'aloc_projecoes' });
export const alocHistorico = defineCollection<AlocHistorico>({ name: 'aloc_historico' });
export const alocImportPendentes = defineCollection<AlocImportPendente>({ name: 'aloc_import_pendentes' });
export const alocRegraCapacidade = defineCollection<AlocRegraCapacidade>({ name: 'aloc_regra_capacidade' });

export const ALOC_COLLECTIONS = [
  alocAjustes.name, alocComentarios.name, alocProjecoes.name, alocHistorico.name, alocImportPendentes.name, alocRegraCapacidade.name,
];

/** Weekly snapshot of the panel metrics ("Evolução"); one doc per ISO week (yyyy-Www), refreshed during the week. */
export interface SnapshotSemanal {
  semana: string;
  /** yyyy-mm-dd of the week's Monday. */
  inicioSemana: string;
  emPlanejamento: number;
  pctNoPrazo: number | null;
  saldoTotal: number;
  saldoInsumo: number;
  saldoEquipe: number;
  mediaAtivosPorGerente: number | null;
  em: string;
}
export const snapshotsSemanais = defineCollection<SnapshotSemanal>({ name: 'snapshots_semanais', indexes: ['semana'] });
