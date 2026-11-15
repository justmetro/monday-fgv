import { type Projeto, codigoDe, fmtBRL, fmtPct } from '@generated/lib/format';
import { parDe, marcadorTexto } from '@generated/lib/finance';
import { type Indicadores, METAS } from '@generated/lib/indicadores';
import { rotuloMesLongo } from '@generated/lib/periodo';

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** Short summary from a sentence template (deterministic, no AI). */
export function resumoMes(mes: string, ind: Indicadores, ant: Indicadores | null, mesAnt: string): string {
  const f = ind.fin.total;
  const neg = ind.negativos.total;
  let s = `Até ${rotuloMesLongo(mes)}, ${plural(ind.n, 'projeto está', 'projetos estão')} na base Res. Acumulado do ano (início e conclusão do planejamento até o fim do mês), com orçado ${fmtBRL(f.orc)}, planejado ${fmtBRL(f.plan)} e saldo ${fmtBRL(f.saldo)} (${fmtPct(f.pct)}).`;
  s += neg.n ? ` ${plural(neg.n, 'projeto está', 'projetos estão')} com saldo total negativo, somando ${fmtBRL(neg.soma)}.` : ' Nenhum projeto com saldo total negativo.';
  if (ind.semOrc.total) s += ` ${plural(ind.semOrc.total, 'projeto aparece', 'projetos aparecem')} sem orçamento.`;
  if (ind.it11.pct !== null) s += ` Conclusão do planejamento em até 15 dias (IT1.1): ${fmtPct(ind.it11.pct)}, meta ${METAS.it11}%.`;
  if (ind.it12.pct !== null) s += ` Registro no SGI em até 21 dias (IT1.2): ${fmtPct(ind.it12.pct)}, meta ${METAS.it12}%.`;
  if (ant) {
    const d = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${fmtPct(((a - b) / Math.abs(b)) * 100)}` : 'sem base');
    s += ` Em relação a ${rotuloMesLongo(mesAnt)}: ${plural(ant.n, 'projeto', 'projetos')} até o mês anterior; orçado ${d(f.orc, ant.fin.total.orc)}, saldo ${d(f.saldo, ant.fin.total.saldo)}.`;
  }
  return s;
}

export interface LinhaRel { id: string; projeto: string; status: string; orc: number | null; plan: number | null; saldo: number | null; pct: number | null; marca: string | null }
export type ColRel = 'projeto' | 'status' | 'orc' | 'plan' | 'saldo' | 'pct';
export const COLS_REL: { k: ColRel; label: string; num: boolean }[] = [
  { k: 'projeto', label: 'Projeto', num: false }, { k: 'status', label: 'Status', num: false }, { k: 'orc', label: 'Orçado', num: true },
  { k: 'plan', label: 'Planejado', num: true }, { k: 'saldo', label: 'Saldo', num: true }, { k: 'pct', label: 'Saldo %', num: true },
];

export function linhasRelatorio(ps: Projeto[]): LinhaRel[] {
  return ps.map((p) => {
    const x = parDe(p, 'total');
    return {
      id: p.id, projeto: `${codigoDe(p) ? `${codigoDe(p)} · ` : ''}${p.name}`, status: p.statusPlanejamento ?? '—',
      orc: x.orcado, plan: x.planejado, saldo: x.saldo, pct: x.pct, marca: marcadorTexto(x.saldoRaw),
    };
  });
}

export function ordenarLinhas(ls: LinhaRel[], k: ColRel, dir: 'asc' | 'desc'): LinhaRel[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...ls].sort((a, b) => {
    const va = a[k];
    const vb = b[k];
    if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'pt-BR') * m;
    const na = typeof va === 'number' ? va : -Infinity;
    const nb = typeof vb === 'number' ? vb : -Infinity;
    return na === nb ? 0 : na > nb ? m : -m;
  });
}

export const celula = (l: LinhaRel, k: ColRel): string => {
  if (k === 'projeto') return l.projeto;
  if (k === 'status') return l.status;
  if ((k === 'saldo' || k === 'pct') && l.marca) return l.marca;
  if (k === 'pct') return fmtPct(l.pct);
  return fmtBRL(l[k]);
};
