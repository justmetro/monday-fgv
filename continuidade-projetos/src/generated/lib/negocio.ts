import type { Modalidade } from '@generated/server/alocacao';

export type { Modalidade };

export const NIVEIS_PERSPECTIVA = ['Alta', 'Média', 'Baixa', 'Em negociação', 'Sem perspectiva', 'Renovado', 'Aditivo', 'Sem informação'] as const;
/** Tipo da perspectiva (guardado só no app). */
export const TIPOS_PERSPECTIVA = ['Contrato Novo', 'Aditivo', 'Sem informação'] as const;
/** Temperatura da perspectiva (faixa de prazo); a ordem define a ordenação da coluna. */
export const TEMPERATURAS = ['15 a 30 dias', '30 a 45 dias', '45 a 60 dias', 'Mais de 60 dias', 'Sem informação'] as const;

/** Ordem de exibição das modalidades da folha fixa. */
export const MODALIDADES: Modalidade[] = ['CLT', 'Bolsa', 'RPA fixo', 'Estágio'];
export const SEM_MODALIDADE = 'Modalidade não informada';

export type Fatores = { clt: number; bolsa: number; estagio: number; rpaFixo: number };
export const FATORES_PADRAO: Fatores = { clt: 1, bolsa: 1, estagio: 1, rpaFixo: 1 };

const CHAVE: Record<Modalidade, keyof Fatores> = { CLT: 'clt', Bolsa: 'bolsa', 'Estágio': 'estagio', 'RPA fixo': 'rpaFixo' };
export const chaveFator = (m: Modalidade) => CHAVE[m];

/** Fator de encargos da modalidade (não informada = 1,0). */
export function fatorDe(m: Modalidade | null, f: Fatores): number {
  return m ? f[CHAVE[m]] ?? 1 : 1;
}

export type ContagemModalidade = Record<Modalidade, number>;
export const contagemVazia = (): ContagemModalidade => ({ CLT: 0, Bolsa: 0, 'RPA fixo': 0, 'Estágio': 0 });

/** Tons de chip/gráfico por modalidade. */
export const COR_MODALIDADE: Record<Modalidade, string> = {
  CLT: 'hsl(var(--chart-1))',
  Bolsa: 'hsl(var(--chart-2))',
  'RPA fixo': 'hsl(var(--chart-3))',
  'Estágio': 'hsl(var(--chart-4))',
};
