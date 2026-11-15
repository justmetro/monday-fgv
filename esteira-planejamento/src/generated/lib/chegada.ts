import { addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import { type Projeto, toDate, today } from '@generated/lib/format';
import { type Destino, type Temp, PAUSADA, SEM_TEMP } from '@generated/lib/alocacao';

/**
 * Days until a new project arrives, from its temperature: a band ("30 a 45 dias") = rounded AVERAGE (38);
 * a single number = that number; "Reforço imediato", "Assinado" and "Mudança de gestão" = today (0);
 * "Sem temperatura" / "Negociação pausada" = no forecast (null).
 */
export function diasDaTemp(t: Temp): number | null {
  if (t === SEM_TEMP || t === PAUSADA) return null;
  if (t === 'Reforço imediato' || t === 'Assinado' || t === 'Mudança de gestão') return 0;
  const faixa = t.match(/(\d+)\s*a\s*(\d+)/);
  if (faixa) return Math.round((Number(faixa[1]) + Number(faixa[2])) / 2);
  const n = t.match(/(\d+)/);
  return n ? Number(n[1]) : null;
}

export type OrigemMeses = 'vigencia' | 'contrato' | 'estimado';
export const MESES_PADRAO = 6;
const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;
const mesesEntre = (a: Date, b: Date) => Math.max(1, Math.round(differenceInCalendarDays(b, a) / 30.4375));

/** Duration in months: Vigência Contratual; else Prazo início → término execução; else 6 months (estimated). */
export function duracaoDe(p: Projeto): { meses: number; origem: OrigemMeses } {
  const de = toDate(p.vignciaContratual?.from);
  const ate = toDate(p.vignciaContratual?.to);
  if (de && ate && ate > de) return { meses: mesesEntre(de, ate), origem: 'vigencia' };
  const ini = toDate(p.prazoIncioExecuo);
  const fim = toDate(p.prazoTrminoExecuo);
  if (ini && fim && fim > ini) return { meses: mesesEntre(ini, fim), origem: 'contrato' };
  return { meses: MESES_PADRAO, origem: 'estimado' };
}

export function rotuloOrigem(origem: OrigemMeses, n: number): string {
  if (origem === 'vigencia') return `Vigência: ${meses(n)}`;
  if (origem === 'contrato') return `Duração prevista do contrato (não é vigência): ${meses(n)}`;
  return `Estimado: ${meses(n)}`;
}
export const ORIGEM_CURTA: Record<OrigemMeses, string> = { vigencia: 'Vigência', contrato: 'Duração prevista do contrato', estimado: 'Estimado' };

export interface Chegada {
  dias: number | null;
  /** Expected arrival (today + days of the temperature); null = no forecast. */
  inicio: Date | null;
  fim: Date | null;
  meses: number;
  origem: OrigemMeses;
  rotuloOrigem: string;
}

/** Arrival forecast and duration of a NEW project (Gantt, Lista, Validação and report all use this). */
export function chegadaDe(d: Destino, hoje: Date = today()): Chegada {
  const dias = diasDaTemp(d.temp.valor);
  const dur = duracaoDe(d.p);
  const inicio = dias === null ? null : addDays(hoje, dias);
  return { dias, inicio, fim: inicio ? addMonths(inicio, dur.meses) : null, meses: dur.meses, origem: dur.origem, rotuloOrigem: rotuloOrigem(dur.origem, dur.meses) };
}

export const CHEGADA_REGRA = 'Chegada prevista = hoje + dias da temperatura (faixa “30 a 45 dias” = média arredondada, 38; número único = o número; Reforço imediato, Assinado e Mudança de gestão = hoje; Sem temperatura = sem previsão). Duração: Vigência Contratual em meses; se vazia, meses entre Prazo início e Prazo término execução; se faltar, 6 meses (estimado). Fim = chegada + meses.';

export const fmtMeses = meses;
