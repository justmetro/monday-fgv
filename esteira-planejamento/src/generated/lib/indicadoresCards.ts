import { fmtBRL, fmtPct } from '@generated/lib/format';
import { RECORTES } from '@generated/lib/finance';
import { type Indicadores, METAS, REGRAS, variacao, variacaoPp } from '@generated/lib/indicadores';

export interface LinhaCard { label: string; valor: string }
export interface CardInd {
  k: string;
  grupo: string;
  label: string;
  regra: string;
  valor: string;
  /** Short line under the value (e.g. the R$ of a percentage card). */
  sub?: string;
  /** Details shown as a list, one item per line. */
  linhas?: LinhaCard[];
  /** Target of the indicator and whether the result reached it (null = no result). */
  meta?: { texto: string; ok: boolean | null };
  /** Change vs. the comparison period (null = no comparison); `pp` = percentage points instead of % change. */
  delta: number | null;
  pp?: boolean;
  negativo?: boolean;
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const ROT = { total: 'Total', equipe: 'Equipe', insumos: 'Insumos' } as const;

/** Every indicator card (screen, report, PDF and PPT share this list). */
export function montarCards(ind: Indicadores, ant: Indicadores | null): CardInd[] {
  const out: CardInd[] = [{
    k: 'n', grupo: 'Projetos', label: 'Projetos na base Res. Acumulado', regra: REGRAS.projetos, valor: String(ind.n),
    linhas: ind.porStatus.map((s) => ({ label: s.label, valor: String(s.value) })), delta: variacao(ind.n, ant?.n ?? null),
  }, {
    k: 'assinatura', grupo: 'Projetos', label: 'Assinados × Em planejamento', regra: REGRAS.assinatura,
    valor: `${ind.assinados} / ${ind.naoAssinados}`,
    linhas: [
      { label: 'Assinados', valor: String(ind.assinados) },
      { label: 'Em planejamento (não assinados)', valor: String(ind.naoAssinados) },
      { label: 'Total', valor: String(ind.n) },
    ],
    delta: variacao(ind.assinados, ant?.assinados ?? null),
  }, {
    k: 'assinatura-rs', grupo: 'Projetos', label: 'Saldo: assinados × em planejamento', regra: REGRAS.assinatura,
    valor: fmtBRL(ind.fin.total.saldo),
    linhas: [
      { label: 'Assinados', valor: `${fmtBRL(ind.finAssinados.saldo)} · orç. ${fmtBRL(ind.finAssinados.orc)}` },
      { label: 'Em planejamento', valor: `${fmtBRL(ind.finNaoAssinados.saldo)} · orç. ${fmtBRL(ind.finNaoAssinados.orc)}` },
      { label: 'Total', valor: fmtBRL(ind.fin.total.saldo) },
    ],
    delta: null, negativo: ind.fin.total.saldo < 0,
  }];
  for (const k of ['it11', 'it12'] as const) {
    const x = ind[k];
    out.push({
      k, grupo: 'Prazos', label: k === 'it11' ? 'Conclusão do planejamento em até 15 dias' : 'Registro no SGI em até 21 dias',
      regra: REGRAS[k], valor: fmtPct(x.pct),
      meta: { texto: `Meta ${METAS[k]}% · ${k === 'it11' ? 'IT1.1' : 'IT1.2'}`, ok: x.pct === null ? null : x.pct >= METAS[k] },
      linhas: [
        { label: 'No prazo', valor: String(x.ok) },
        { label: 'Fora do prazo', valor: String(x.n - x.ok) },
        { label: 'Com Data de Assinatura', valor: String(x.n) },
      ],
      delta: variacaoPp(x.pct, ant?.[k].pct ?? null), pp: true,
    });
  }
  for (const k of ['total', 'equipe', 'insumos'] as const) {
    const f = ind.fin[k];
    const a = ant?.fin[k] ?? null;
    const g = `Financeiro · ${ROT[k]}`;
    out.push(
      { k: `${k}-orc`, grupo: g, label: `Orçado ${ROT[k]}`, regra: REGRAS.soma(ROT[k]), valor: fmtBRL(f.orc), sub: plural(f.n, 'projeto somado', 'projetos somados'), delta: variacao(f.orc, a?.orc ?? null) },
      { k: `${k}-plan`, grupo: g, label: `Planejado ${ROT[k]}`, regra: REGRAS.soma(ROT[k]), valor: fmtBRL(f.plan), sub: f.orc ? `${fmtPct((f.plan / f.orc) * 100)} do orçado` : undefined, delta: variacao(f.plan, a?.plan ?? null) },
      { k: `${k}-saldo`, grupo: g, label: `% de saldo ${ROT[k]}`, regra: REGRAS.saldoPct(ROT[k]), valor: fmtPct(f.pct), sub: fmtBRL(f.saldo), delta: variacaoPp(f.pct, a?.pct ?? null), pp: true, negativo: f.saldo < 0 },
    );
  }
  for (const r of RECORTES) {
    const x = ind.negativos[r.key];
    out.push({
      k: `neg-${r.key}`, grupo: 'Saldo negativo', label: `Saldo negativo · ${r.label}`, regra: REGRAS.negativos,
      valor: String(x.n), sub: `soma ${fmtBRL(x.soma)}`, delta: variacao(x.n, ant?.negativos[r.key].n ?? null), negativo: x.n > 0,
    });
  }
  return out;
}

export const fmtDelta = (c: Pick<CardInd, 'delta' | 'pp'>) =>
  c.delta === null ? null : `${c.delta > 0 ? '+' : ''}${dec.format(c.delta)}${c.pp ? ' p.p.' : '%'}`;

/** Plain-text details of a card for the exports (PDF / PPT): sub, meta and list items. */
export function textoCard(c: CardInd): string {
  return [c.sub, c.meta?.texto, ...(c.linhas ?? []).map((l) => `${l.label}: ${l.valor}`)].filter(Boolean).join(' · ');
}
