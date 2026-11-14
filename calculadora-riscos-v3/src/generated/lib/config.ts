// Parâmetros de exibição desta versão de TESTE. Nenhuma regra de cálculo vive aqui:
// Grau e Nível são sempre lidos das colunas de fórmula do quadro 09.4.

/** Grau a partir do qual o risco é destacado como crítico (definido pela equipe). */
export const LIMITE_CRITICO = 15;

/** Avisos visuais do contador de aplicáveis (limites em definição — não bloqueiam). */
export const AVISOS_APLICAVEIS = { atencao: 30, alerta: 50 } as const;

/** Rótulos exatamente como existem nas colunas de status do 09.4. */
export const APLICABILIDADE_OPCOES = ['Em avaliação', 'Aplicável', 'Não aplicável'] as const;
export const ESCALA = ['Muito Baixo', 'Baixo', 'Médio', 'Alto', 'Muito Alto'] as const;
export const ESTRATEGIAS = ['Aceitar', 'Mitigar', 'Transferir', 'Prevenir', 'Escalar'] as const;
export const STATUS_TRATAMENTO = ['Não iniciado', 'Em tratamento', 'Em monitoramento', 'Encerrado'] as const;

export type Aplicabilidade = (typeof APLICABILIDADE_OPCOES)[number];

/** Converte o texto exibido pela fórmula "Grau de Risco" em número (sem recalcular). */
export function grauOf(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(n) && String(value).trim() !== '' ? n : null;
}

export function isCritico(value: string | null | undefined): boolean {
  const g = grauOf(value);
  return g !== null && g >= LIMITE_CRITICO;
}

/** Data → 'AAAA-MM-DD' (as datas do quadro chegam à meia-noite UTC). */
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
}

/** Erros de gravação marcados pelo servidor quando falta permissão de edição. */
export function isPermissionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return msg.includes('SEM_PERMISSAO');
}

export function splitLabels(values: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    for (const part of String(v).split(', ')) {
      const t = part.trim();
      if (t) out.add(t);
    }
  }
  return [...out];
}
