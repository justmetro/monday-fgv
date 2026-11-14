import { z } from 'zod';
import { fmtBRL2, fmtDate, fmtNum } from '@generated/lib/painel';

/** Campos registrados no histórico: quadro de origem, rótulo, tipo e propriedade local correspondente. */
export const CAMPOS = {
  alertaDesalocao: { board: 'A', label: 'Alerta desalocação', kind: 'status', local: 'alertaDesalocacao' },
  inciofimContratual: { board: 'A', label: 'Início/fim contratual', kind: 'timeline', local: 'contratual' },
  ltimaEntregaPrevista: { board: 'A', label: 'Última Entrega Prevista', kind: 'date', local: 'ultimaEntrega' },
  nClt: { board: 'C', label: 'Nº CLT', kind: 'number', local: 'nClt' },
  custoMensalEquipeR: { board: 'C', label: 'Custo mensal (equipe fixa)', kind: 'money', local: 'custoMensal' },
  atualizaoDaEquipe: { board: 'C', label: 'Atualização da equipe', kind: 'date', local: 'atualizacaoEquipe' },
  perspectivaDeFinalizao: { board: 'C', label: 'Perspectiva de renovação/aditivo', kind: 'status', local: 'perspectiva' },
  dataPrevistaDeEntradarenovao: { board: 'C', label: 'Data perspectiva', kind: 'date', local: 'dataEntrada' },
  deciso: { board: 'C', label: 'Decisão', kind: 'status', local: 'decisao' },
  mesesDeManuteno: { board: 'C', label: 'Meses de manutenção', kind: 'number', local: 'mesesManutencao' },
  detalheDaDeciso: { board: 'C', label: 'Detalhe da decisão', kind: 'text', local: 'detalhe' },
  responsvelPelaDeciso: { board: 'C', label: 'Responsável pela decisão', kind: 'people', local: 'responsaveis' },
  dataDaDeciso: { board: 'C', label: 'Data da decisão', kind: 'date', local: 'dataDecisao' },
  statusDeCategorizao: { board: 'C', label: 'Status', kind: 'status', local: 'statusCat' },
  ajusteClt: { board: 'E', label: 'Nº CLT (ajuste no app)', kind: 'number', local: 'nClt' },
  ajusteCusto: { board: 'E', label: 'Custo mensal (ajuste no app)', kind: 'money', local: 'custoMensal' },
  // Edições de produto feitas só no app (não gravam no monday).
  produtoPrazo: { board: 'P', label: 'Prazo de entrega', kind: 'date', local: 'prazo' },
  produtoAtraso: { board: 'P', label: 'Situação', kind: 'status', local: 'atraso' },
  produtoStatus: { board: 'P', label: 'Status do produto', kind: 'status', local: 'status' },
  produtoValor: { board: 'P', label: 'Valor do produto', kind: 'money', local: 'valor' },
  produtoEntregaReal: { board: 'P', label: 'Data de Entrega Real Corporativo', kind: 'date', local: 'entregaReal' },
} as const;

export type CampoKey = keyof typeof CAMPOS;
export const CAMPO_KEYS = Object.keys(CAMPOS) as [CampoKey, ...CampoKey[]];

export const CAMPO_PRODUTO: Record<'prazo' | 'atraso' | 'status' | 'valor' | 'entregaReal', CampoKey> = {
  prazo: 'produtoPrazo', atraso: 'produtoAtraso', status: 'produtoStatus', valor: 'produtoValor', entregaReal: 'produtoEntregaReal',
};

export const logValorSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.object({ from: z.string().nullable(), to: z.string().nullable() }),
  z.array(z.object({ id: z.string(), name: z.string() })),
]);
export type LogValor = z.infer<typeof logValorSchema>;

export const mudancaSchema = z.object({
  campo: z.enum(CAMPO_KEYS), de: logValorSchema, para: logValorSchema,
  produtoId: z.string().optional(), produtoNome: z.string().max(300).optional(),
});
export type Mudanca = z.infer<typeof mudancaSchema>;

export type LogEntry = {
  id: string;
  itemId: string;
  projectId: string;
  projectName: string;
  user: string;
  at: string;
  acao: 'alteracao' | 'reversao';
  ref: string | null;
  changes: Mudanca[];
  /** 'app' = edição de produto guardada só no app. */
  origem?: 'monday' | 'app';
};

export function fmtValor(campo: CampoKey, v: LogValor): string {
  if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) return '(vazio)';
  const kind = CAMPOS[campo].kind;
  if (Array.isArray(v)) return v.map((p) => p.name || p.id).join(', ');
  if (typeof v === 'object') return `${fmtDate(v.from)} – ${fmtDate(v.to)}`;
  if (kind === 'date' && typeof v === 'string') return fmtDate(v);
  if (kind === 'money' && typeof v === 'number') return fmtBRL2(v);
  if (typeof v === 'number') return fmtNum(v);
  return v.length > 80 ? `${v.slice(0, 80)}…` : v;
}

/** Compara dois valores do log (ordem de pessoas irrelevante). */
export function valorIgual(a: LogValor, b: LogValor): boolean {
  const norm = (v: LogValor) => (Array.isArray(v) ? v.map((p) => p.id).sort() : v === '' ? null : v);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
