export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'muted';

/** Pipeline order (status list and funnel) — same as the monday esteira. Cancelled statuses are never shown. */
export const STATUS_PLAN_ORDEM = [
  'Em andamento',
  'Em replanejamento',
  'Em revisão',
  'Planejado aguardando assinatura',
  'Instrumento Concluído',
  'Finalizado (Plan + SGI)',
  'Pausado',
  'Novo Cadastro - 30 a 45 dias',
  'Novo Cadastro - 45 a 60 dias',
];

export const NOVO_CADASTRO = ['Novo Cadastro - 30 a 45 dias', 'Novo Cadastro - 45 a 60 dias'];

/** Exact monday colors of Status Planejamento (theme tokens; class names literal for the CSS build). */
const ST_VAR: Record<string, string> = {
  'Novo Cadastro - 45 a 60 dias': '--st-novo-45',
  'Novo Cadastro - 30 a 45 dias': '--st-novo-30',
  'Em andamento': '--st-andamento',
  'Em replanejamento': '--st-replan',
  'Em revisão': '--st-revisao',
  'Planejado aguardando assinatura': '--st-aguard',
  'Instrumento Concluído': '--st-instr',
  Pausado: '--st-pausado',
  'Finalizado (Plan + SGI)': '--st-final',
};
const ST_DOT: Record<string, string> = {
  'Novo Cadastro - 45 a 60 dias': 'bg-[hsl(var(--st-novo-45))]',
  'Novo Cadastro - 30 a 45 dias': 'bg-[hsl(var(--st-novo-30))]',
  'Em andamento': 'bg-[hsl(var(--st-andamento))]',
  'Em replanejamento': 'bg-[hsl(var(--st-replan))]',
  'Em revisão': 'bg-[hsl(var(--st-revisao))]',
  'Planejado aguardando assinatura': 'bg-[hsl(var(--st-aguard))]',
  'Instrumento Concluído': 'bg-[hsl(var(--st-instr))]',
  Pausado: 'bg-[hsl(var(--st-pausado))]',
  'Finalizado (Plan + SGI)': 'bg-[hsl(var(--st-final))]',
};

/** Chart color of a label: monday color for Status Planejamento, else the tone color. */
export function corDe(label: string | null | undefined): string {
  const v = label ? ST_VAR[label] : undefined;
  return v ? `hsl(var(${v}))` : TONE_VAR[toneOf(label)];
}
/** Dot class of a label: monday color for Status Planejamento, else the tone dot. */
export function dotDe(label: string | null | undefined): string {
  return (label && ST_DOT[label]) || TONE_DOT[toneOf(label)];
}

/** Status SGI in process order (labels new on the board go after these). */
export const SGI_ORDEM = [
  'Aguardando planejamento',
  'Aguardando cadastro no SGI',
  'Em registro no SGI',
  'Em validação no SGI',
  'TAP Reprovado',
  'Validado no SGI',
  'Não Iniciado',
  'Pausado',
  'Despriorizado',
  'Sem planejamento [ANTIGOS]',
];

const TONES: Record<string, Tone> = {
  'Novo Cadastro - 30 a 45 dias': 'neutral',
  'Novo Cadastro - 45 a 60 dias': 'neutral',
  'Em replanejamento': 'warning',
  'Em andamento': 'info',
  'Em revisão': 'warning',
  'Planejado aguardando assinatura': 'warning',
  'Instrumento Concluído': 'success',
  'Finalizado (Plan + SGI)': 'success',
  Pausado: 'muted',
  Despriorizado: 'muted',
  'Sem planejamento [ANTIGOS]': 'danger',
  // SGI
  'Validado no SGI': 'success',
  'Em registro no SGI': 'info',
  'Em validação no SGI': 'warning',
  'Não Iniciado': 'neutral',
  'TAP Reprovado': 'danger',
  'Aguardando cadastro no SGI': 'warning',
  'Aguardando planejamento': 'neutral',
  // Prioridade
  Crítico: 'danger',
  Alta: 'danger',
  Média: 'warning',
  Baixa: 'info',
  Não: 'muted',
  // status geral
  'Em Progresso': 'info',
  Concluído: 'success',
  Cancelado: 'danger',
  'Em Planejamento': 'info',
  'Em Revisão': 'warning',
  Iniciação: 'info',
  Execução: 'info',
  Encerramento: 'success',
  Parado: 'danger',
  // Radar Monitoramento
  'Alta Prob. de Repactuação': 'danger',
  'Crono Produtos Pactuado': 'success',
  'Crono Produtos em Construção': 'neutral',
  // Alocação de Equipe
  'Equipe alocada': 'success',
  'Sem equipe': 'danger',
  'Não preenchido': 'neutral',
  Verificar: 'warning',
  // Dimensionamento
  'Não concluído': 'neutral',
};

export function toneOf(label: string | null | undefined): Tone {
  return (label && TONES[label]) || 'neutral';
}

export const TONE_VAR: Record<Tone, string> = {
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--danger))',
  info: 'hsl(var(--info))',
  neutral: 'hsl(var(--neutral-status))',
  muted: 'hsl(var(--fg-subtle))',
};

export const TONE_DOT: Record<Tone, string> = {
  success: 'bg-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning))]',
  danger: 'bg-[hsl(var(--danger))]',
  info: 'bg-[hsl(var(--info))]',
  neutral: 'bg-[hsl(var(--neutral-status))]',
  muted: 'bg-[hsl(var(--fg-subtle))]',
};
