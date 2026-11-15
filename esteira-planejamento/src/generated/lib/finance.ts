import { type Projeto, parseNum, parsePct } from '@generated/lib/format';

export interface Par {
  key: 'equipe' | 'insumos' | 'total';
  label: string;
  orcado: number | null;
  planejado: number | null;
  saldoRaw: string | null;
  saldo: number | null;
  pctRaw: string | null;
  pct: number | null;
}

export function paresDe(p: Projeto): Par[] {
  return [
    {
      key: 'equipe', label: 'Equipe', orcado: p.equipeOr, planejado: p.equipePlan,
      saldoRaw: p.rSaldoEquipe, saldo: parseNum(p.rSaldoEquipe), pctRaw: p.SaldoEquipe, pct: parsePct(p.SaldoEquipe),
    },
    {
      key: 'insumos', label: 'Insumos', orcado: p.oradoInsumos, planejado: p.planejadoInsumos,
      saldoRaw: p.rSaldoInsumos, saldo: parseNum(p.rSaldoInsumos), pctRaw: p.SaldoInsumos, pct: parsePct(p.SaldoInsumos),
    },
    {
      key: 'total', label: 'Total', orcado: p.oradoTotal, planejado: p.planejadoTotal,
      saldoRaw: p.rSaldoTotal, saldo: parseNum(p.rSaldoTotal), pctRaw: p.SaldoTotal, pct: parsePct(p.SaldoTotal),
    },
  ];
}

/** Novo Cadastro: no financial planning yet, out of the sums (Pausado and cancelled ones never reach Financeiro). */
export const STATUS_FORA_DO_TOTAL = ['Novo Cadastro - 30 a 45 dias', 'Novo Cadastro - 45 a 60 dias'];

export function foraDoTotalPorStatus(p: Projeto): boolean {
  return !!p.statusPlanejamento && STATUS_FORA_DO_TOTAL.includes(p.statusPlanejamento);
}

/** Formula returned a text marker instead of a number (e.g. "SEM ORÇ"). */
export function marcadorTexto(raw: string | null): string | null {
  if (!raw || raw.trim().toLowerCase() === 'null') return null;
  return parseNum(raw) === null && raw.trim() ? raw.trim() : null;
}

export interface Totais {
  contrato: number;
  equipeOrc: number;
  equipePlan: number;
  equipeSaldo: number;
  insumosOrc: number;
  insumosPlan: number;
  insumosSaldo: number;
  totalOrc: number;
  totalPlan: number;
  totalSaldo: number;
}

export function somar(items: Projeto[]): Totais {
  const t: Totais = {
    contrato: 0, equipeOrc: 0, equipePlan: 0, equipeSaldo: 0, insumosOrc: 0,
    insumosPlan: 0, insumosSaldo: 0, totalOrc: 0, totalPlan: 0, totalSaldo: 0,
  };
  for (const p of items) {
    t.contrato += p.valorDoContrato ?? 0;
    t.equipeOrc += p.equipeOr ?? 0;
    t.equipePlan += p.equipePlan ?? 0;
    t.equipeSaldo += parseNum(p.rSaldoEquipe) ?? 0;
    t.insumosOrc += p.oradoInsumos ?? 0;
    t.insumosPlan += p.planejadoInsumos ?? 0;
    t.insumosSaldo += parseNum(p.rSaldoInsumos) ?? 0;
    t.totalOrc += p.oradoTotal ?? 0;
    t.totalPlan += p.planejadoTotal ?? 0;
    t.totalSaldo += parseNum(p.rSaldoTotal) ?? 0;
  }
  return t;
}

export type Recorte = Par['key'];
export const RECORTES: { key: Recorte; label: string }[] = [
  { key: 'total', label: 'Total' }, { key: 'insumos', label: 'Insumo' }, { key: 'equipe', label: 'Equipe' },
];
export const parDe = (p: Projeto, k: Recorte) => paresDe(p).find((x) => x.key === k) as Par;
/** Negative = numeric R$ Saldo < 0 in that cut (a project can be negative only in insumo or only in equipe). */
export const negativoEm = (p: Projeto, k: Recorte) => (parDe(p, k).saldo ?? 0) < 0;
/** Formula returned "SEM ORÇ" (no budget) in that cut. */
export const semOrcamentoEm = (p: Projeto, k: Recorte) => /sem\s*or/i.test(marcadorTexto(parDe(p, k).saldoRaw) ?? '');

