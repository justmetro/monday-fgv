import { type Projeto, toDate, today, daysBetween, parsePct } from '@generated/lib/format';
import { STATUS_INATIVOS, isInativo } from '@generated/lib/board-options';

export type Farol = 'atrasado' | 'vence' | 'noPrazo' | 'aberto' | 'inativo' | 'semData';

export interface Etapa {
  key: 'plan' | 'sgi' | 'dim';
  label: string;
  farol: Farol;
  prazo: Date | null;
  conclusao: Date | null;
  resultado: string | null;
  extra?: { label: string; value: string | null };
  diasParaPrazo: number | null;
  detalhe: string;
}

/** Formula text "null" or blank counts as no value. */
export function semValor(v: string | null | undefined): boolean {
  return !v || !v.trim() || v.trim().toLowerCase() === 'null';
}

/**
 * Reads the "result" formulas. Board returns "100%" (on time) / "0%" (late) — only meaningful when
 * the matching completion date is filled (both formulas carry a default value otherwise).
 */
export function lerResultado(v: string | null | undefined): 'ok' | 'late' | null {
  if (semValor(v)) return null;
  const s = (v as string).trim().toLowerCase();
  if (/fora|atras|n[aã]o|false|✗|❌/.test(s)) return 'late';
  if (/sim|no prazo|ok|true|✓|✅/.test(s)) return 'ok';
  const n = parsePct(v);
  if (n === null) return null;
  return n >= 100 ? 'ok' : 'late';
}

type Aval = { farol: Farol; dias: number | null; detalhe: string };

function avaliarConcluida(prazo: Date | null, conclusao: Date, resultado: string | null | undefined, dias: number | null): Aval {
  const r = lerResultado(resultado);
  if (r === 'ok') return { farol: 'noPrazo', dias, detalhe: 'Concluído no prazo' };
  if (r === 'late') return { farol: 'atrasado', dias, detalhe: 'Concluído fora do prazo' };
  if (prazo) {
    return conclusao.getTime() <= prazo.getTime()
      ? { farol: 'noPrazo', dias, detalhe: 'Concluído no prazo' }
      : { farol: 'atrasado', dias, detalhe: 'Concluído fora do prazo' };
  }
  return { farol: 'noPrazo', dias, detalhe: 'Concluído (sem prazo)' };
}

function avaliar(prazo: Date | null, conclusao: Date | null, resultado: string | null | undefined, inativo: string | null): Aval {
  const dias = prazo ? daysBetween(today(), prazo) : null;
  if (conclusao) return avaliarConcluida(prazo, conclusao, resultado, dias);
  // Open stage on an inactive project: never raises late/due alerts.
  if (inativo) return { farol: 'inativo', dias: null, detalhe: inativo };
  if (!prazo || dias === null) return { farol: 'semData', dias, detalhe: 'Sem data' };
  if (dias < 0) return { farol: 'atrasado', dias, detalhe: `Atrasado há ${Math.abs(dias)} d` };
  if (dias <= 7) return { farol: 'vence', dias, detalhe: dias === 0 ? 'Vence hoje' : `Vence em ${dias} d` };
  return { farol: 'aberto', dias, detalhe: `Em aberto · ${dias} d` };
}

export function etapasDe(p: Projeto): Etapa[] {
  const inativo = isInativo(p.statusPlanejamento) ? STATUS_INATIVOS[p.statusPlanejamento as string] : null;

  const prazoPlan = toDate(p.calcPrazoDeConcluso) ?? toDate(p.prazoDeConcluso);
  const concPlan = toDate(p.conclusoDoPlanejamento);
  const a = avaliar(prazoPlan, concPlan, p.resultadoConclusoPlanejamento, inativo);

  const prazoSgi = toDate(p.calcPrazoRegistroSgi) ?? toDate(p.prazoRegistroSgi);
  const concSgi = toDate(p.conclusoRegistroSgi);
  const b = avaliar(prazoSgi, concSgi, p.resultadoSgi, inativo);

  const prazoDim = toDate(p.prazoDimensionamento);
  const concDim = toDate(p.conclusoDoDimensionamento);
  let c: Aval;
  if (!concDim && p.dimensionamentoConcludo === 'Concluído') {
    c = { farol: 'noPrazo', dias: null, detalhe: 'Concluído (sem data)' };
  } else if (!concDim && inativo) {
    // Dimensionamento was never measured on inactive projects.
    c = { farol: 'inativo', dias: null, detalhe: 'Sem apuração' };
  } else {
    c = avaliar(prazoDim, concDim, p.io211NoPrazo, null);
  }

  return [
    { key: 'plan', label: 'Planejamento', farol: a.farol, prazo: prazoPlan, conclusao: concPlan, resultado: p.resultadoConclusoPlanejamento, diasParaPrazo: a.dias, detalhe: a.detalhe },
    { key: 'sgi', label: 'Registro SGI', farol: b.farol, prazo: prazoSgi, conclusao: concSgi, resultado: p.resultadoSgi, diasParaPrazo: b.dias, detalhe: b.detalhe },
    {
      key: 'dim', label: 'Dimensionamento', farol: c.farol, prazo: prazoDim, conclusao: concDim, resultado: p.io211NoPrazo,
      extra: { label: 'Dias', value: p.diasDimensionamento }, diasParaPrazo: c.dias, detalhe: c.detalhe,
    },
  ];
}

const PESO: Record<Farol, number> = { atrasado: 4, vence: 3, aberto: 1, noPrazo: 0, inativo: 0, semData: 0 };

/** Sort key: late stages first, then due-soon, then nearest deadline. Inactive projects sink. */
export function severidade(etapas: Etapa[], inativo: boolean): number {
  const atrasos = etapas.filter((e) => e.farol === 'atrasado').length;
  const vence = etapas.filter((e) => e.farol === 'vence').length;
  const max = Math.max(...etapas.map((e) => PESO[e.farol]));
  return (inativo ? 0 : 1000) + atrasos * 100 + vence * 10 + max;
}

export function proximoPrazo(etapas: Etapa[]): number {
  const ds = etapas.map((e) => e.diasParaPrazo).filter((d): d is number => d !== null);
  return ds.length ? Math.min(...ds) : Number.POSITIVE_INFINITY;
}
