import { defineCollection } from '@vibe/db';

/** Edição de produto feita no app (rascunho até validação). Nunca é gravada no monday. */
export interface ProdutoEdicao {
  produtoId: string;
  projectId: string;
  /** Campos editados (presença = valor sobreposto): 'prazo' | 'atraso' | 'status' | 'valor'. */
  campos: string[];
  prazo?: string | null;
  atraso?: string | null;
  status?: string | null;
  valor?: number | null;
  user: string;
  at: string;
}
export const produtoEdicoes = defineCollection<ProdutoEdicao>({ name: 'produto_edicoes', indexes: ['produtoId'] });

/** Registro de histórico das edições feitas no app (mesmo formato do histórico do monday). */
export interface LogApp {
  projectId: string;
  projectName: string;
  user: string;
  at: string;
  acao: 'alteracao' | 'reversao';
  ref: string | null;
  /** JSON das mudanças (lista de Mudanca). */
  changesJson: string;
}
/** Ajuste manual da equipe feito no app (sobrepõe o cálculo do quadro Equipes Revisadas). */
export interface EquipeAjuste {
  projectId: string;
  /** Campos ajustados: 'nClt' | 'custoMensal'. */
  campos: string[];
  nClt?: number | null;
  custoMensal?: number | null;
  user: string;
  at: string;
}
export const equipeAjustes = defineCollection<EquipeAjuste>({ name: 'equipe_ajustes', indexes: ['projectId'] });

export const logApp = defineCollection<LogApp>({ name: 'log_app' });

/** Marcadores de projeto feitos no app (ex.: "Sem equipe fixa"). Nunca gravados no monday. */
export interface ProjetoMarcador {
  projectId: string;
  semEquipeFixa: boolean;
  user: string;
  at: string;
}
/** Fatores de encargos por modalidade (custo = Valor Base Plan. × fator). Um único documento. */
export interface FatoresCusto {
  clt: number;
  bolsa: number;
  estagio: number;
  rpaFixo: number;
  user: string;
  at: string;
}
export const fatoresCusto = defineCollection<FatoresCusto>({ name: 'fatores_custo' });

/** Perspectiva de renovação + mini report de Negócios (cada salvamento = 1 documento; o mais recente vale). */
export interface PerspectivaRenovacao {
  projectId: string;
  nivel: string | null;
  /** Temperatura da perspectiva (faixa de prazo); ausente em registros antigos. */
  temperatura?: string | null;
  /** Tipo: Contrato Novo / Aditivo / Sem informação; ausente em registros antigos. */
  tipo?: string | null;
  report: string;
  user: string;
  at: string;
}
export const perspectivasRenovacao = defineCollection<PerspectivaRenovacao>({ name: 'perspectivas_renovacao', indexes: ['projectId'] });

export const projetoMarcadores = defineCollection<ProjetoMarcador>({ name: 'projeto_marcadores', indexes: ['projectId'] });

/** Lista editável de opções do campo "Status" (categorização). Documento único. */
export interface StatusCatOpcoes {
  opcoes: string[];
  user: string;
  at: string;
}
export const statusCatOpcoes = defineCollection<StatusCatOpcoes>({ name: 'status_cat_opcoes' });
