import { type Projeto, fmtBRL, fmtDate, toDate } from '@generated/lib/format';
import { type Recorte, RECORTES, parDe, negativoEm, semOrcamentoEm, foraDoTotalPorStatus } from '@generated/lib/finance';
import { type Taxa, itValor } from '@generated/lib/metricas';
import { STATUS_PLAN_ORDEM } from '@generated/lib/status';
import { mesKey } from '@generated/lib/periodo';

/**
 * Indicadores (and the monthly report) use the base "Res. Acumulado" (lib/resAcumulado) of the selected cycle,
 * already cut by the top filters. Everything below works on that base.
 */

/** Enters the sums: not Novo Cadastro; "SEM ORÇ" is removed per cut. */
export const entraNaSoma = (p: Projeto) => !foraDoTotalPorStatus(p);

/** One project behind a number: the value that entered the calculation (already formatted); `grupo` splits the side panel. */
export interface ItemConta { p: Projeto; valor: string; grupo?: string }

export interface Fin { orc: number; plan: number; saldo: number; pct: number | null; n: number }
export interface Indicadores {
  n: number;
  /** Projects with / without Data de Assinatura inside the base; n = soma dos dois. */
  assinados: number;
  naoAssinados: number;
  /** Total cut (Orçado / Planejado / Saldo) of each group; the general total (fin.total) is their sum. */
  finAssinados: Fin;
  finNaoAssinados: Fin;
  porStatus: { label: string; value: number }[];
  fin: Record<Recorte, Fin>;
  negativos: Record<Recorte, { n: number; soma: number }>;
  semOrc: Record<Recorte, number>;
  /** IT1.1 (planning ≤ 15 days after signing) and IT1.2 (SGI record ≤ 21 days after signing). */
  it11: Taxa;
  it12: Taxa;
  /** Projects counted in each card (key = card key of indicadoresCards). */
  listas: Record<string, ItemConta[]>;
}

export const METAS = { it11: 70, it12: 80 } as const;
const DIAS = { it11: 15, it12: 21 } as const;
const DIA_MS = 86_400_000;

const somados = (ps: Projeto[], k: Recorte) => ps.filter((p) => entraNaSoma(p) && !semOrcamentoEm(p, k));

export function somaFin(ps: Projeto[], k: Recorte): Fin {
  const f = { orc: 0, plan: 0, saldo: 0, n: 0 };
  for (const p of somados(ps, k)) {
    const x = parDe(p, k);
    f.orc += x.orcado ?? 0;
    f.plan += x.planejado ?? 0;
    f.saldo += x.saldo ?? 0;
    f.n++;
  }
  return { ...f, pct: f.orc ? (f.saldo / f.orc) * 100 : null };
}

/**
 * IT1.1 / IT1.2 per project: base = projects with Data de Assinatura. Uses the board's IT column (100 = on time)
 * when it has a value; otherwise days from Data de Assinatura to the completion date (≤ limit = on time).
 */
function itPrazo(base: Projeto[], k: 'it11' | 'it12') {
  const lista: ItemConta[] = [];
  let ok = 0;
  for (const p of base) {
    const ass = toDate(p.dataDeAssinatura);
    if (!ass) continue;
    const conc = toDate(k === 'it11' ? p.conclusoDoPlanejamento : p.conclusoRegistroSgi);
    const dias = conc ? Math.round((conc.getTime() - ass.getTime()) / DIA_MS) : null;
    const col = itValor(p[k]);
    const dentro = col !== null ? col > 0 : dias !== null && dias <= DIAS[k];
    if (dentro) ok++;
    const quando = conc ? `${fmtDate(conc)} · ${dias} dia${dias === 1 ? '' : 's'}` : k === 'it11' ? 'sem conclusão' : 'sem registro no SGI';
    lista.push({ p, valor: quando, grupo: dentro ? 'No prazo' : 'Fora do prazo' });
  }
  return { taxa: { pct: lista.length ? (ok / lista.length) * 100 : null, ok, n: lista.length }, lista };
}

export function calcularIndicadores(base: Projeto[]): Indicadores {
  const cont = new Map<string, number>();
  for (const p of base) { const s = p.statusPlanejamento ?? 'Sem status'; cont.set(s, (cont.get(s) ?? 0) + 1); }
  const ordem = (s: string) => { const i = STATUS_PLAN_ORDEM.indexOf(s); return i < 0 ? 99 : i; };
  const porStatus = [...cont.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => ordem(a.label) - ordem(b.label));
  const rec = <T,>(f: (k: Recorte) => T) => Object.fromEntries(RECORTES.map((r) => [r.key, f(r.key)])) as Record<Recorte, T>;
  const listaAss = base.filter((p) => !!toDate(p.dataDeAssinatura));
  const listaNao = base.filter((p) => !toDate(p.dataDeAssinatura));
  const it11 = itPrazo(base, 'it11');
  const it12 = itPrazo(base, 'it12');

  const listas: Record<string, ItemConta[]> = {
    n: base.map((p) => ({ p, valor: p.statusPlanejamento ?? 'Sem status' })),
    assinatura: base.map((p) => (toDate(p.dataDeAssinatura)
      ? { p, valor: `Assinado em ${fmtDate(p.dataDeAssinatura)}`, grupo: 'Assinados' }
      : { p, valor: 'Sem Data de Assinatura', grupo: 'Em planejamento (não assinados)' })),
    'assinatura-rs': somados(base, 'total').map((p) => ({ p, valor: fmtBRL(parDe(p, 'total').saldo), grupo: toDate(p.dataDeAssinatura) ? 'Assinados' : 'Em planejamento (não assinados)' })),
    it11: it11.lista,
    it12: it12.lista,
  };
  for (const r of RECORTES) {
    const ps = somados(base, r.key);
    listas[`${r.key}-orc`] = ps.map((p) => ({ p, valor: fmtBRL(parDe(p, r.key).orcado) }));
    listas[`${r.key}-plan`] = ps.map((p) => ({ p, valor: fmtBRL(parDe(p, r.key).planejado) }));
    listas[`${r.key}-saldo`] = ps.map((p) => ({ p, valor: fmtBRL(parDe(p, r.key).saldo) }));
    listas[`neg-${r.key}`] = base.filter((p) => negativoEm(p, r.key)).map((p) => ({ p, valor: fmtBRL(parDe(p, r.key).saldo) }));
  }

  return {
    n: base.length,
    assinados: listaAss.length,
    naoAssinados: listaNao.length,
    finAssinados: somaFin(listaAss, 'total'),
    finNaoAssinados: somaFin(listaNao, 'total'),
    porStatus,
    fin: rec((k) => somaFin(base, k)),
    negativos: rec((k) => {
      const neg = base.filter((p) => negativoEm(p, k));
      return { n: neg.length, soma: neg.reduce((a, p) => a + (parDe(p, k).saldo ?? 0), 0) };
    }),
    semOrc: rec((k) => base.filter((p) => semOrcamentoEm(p, k)).length),
    it11: it11.taxa,
    it12: it12.taxa,
    listas,
  };
}

export interface PontoMes { mes: string; orc: number; plan: number; saldo: number; pct: number | null }
/** Total cut by month of the Conclusão do Planejamento (the date that closes the Res. Acumulado base; same sum rule as the cards). */
export function porMes(base: Projeto[], meses: string[]): PontoMes[] {
  const grupos = new Map<string, Projeto[]>(meses.map((m) => [m, []]));
  for (const p of base) { const d = toDate(p.conclusoDoPlanejamento); if (d) grupos.get(mesKey(d))?.push(p); }
  return meses.map((m) => { const f = somaFin(grupos.get(m) ?? [], 'total'); return { mes: m, orc: f.orc, plan: f.plan, saldo: f.saldo, pct: f.pct }; });
}

/** Relative change vs. the previous period (null when there is no comparable base). */
export const variacao = (atual: number | null, anterior: number | null) =>
  atual === null || anterior === null || anterior === 0 ? null : ((atual - anterior) / Math.abs(anterior)) * 100;
/** Difference in percentage points (for cards that already are a percentage). */
export const variacaoPp = (atual: number | null, anterior: number | null) =>
  atual === null || anterior === null ? null : atual - anterior;

export const REGRAS = {
  projetos: 'Projetos da base Res. Acumulado do ciclo (mesmo filtro do dashboard da monday), com os filtros do topo aplicados. Clique para ver a lista.',
  assinatura: 'Dentro da base Res. Acumulado: Assinados = com Data de Assinatura; Em planejamento = sem Data de Assinatura. Total = soma dos dois.',
  soma: (rot: string) => `Soma de Orçado ${rot}, Planejado ${rot} e R$ Saldo ${rot} dos projetos da base Res. Acumulado. Ficam fora: Novo Cadastro e “SEM ORÇ”.`,
  saldoPct: (rot: string) => `% de saldo = R$ Saldo ${rot} ÷ Orçado ${rot} × 100 dos projetos da base Res. Acumulado (fora: Novo Cadastro e “SEM ORÇ”). Abaixo, o saldo em R$. Comparativo em pontos percentuais.`,
  negativos: 'Projetos da base com R$ Saldo numérico menor que zero em cada recorte (Total, Equipe, Insumo) e a soma desses saldos.',
  it11: `IT1.1 · meta ${METAS.it11}%: projetos com planejamento concluído em até ${DIAS.it11} dias da Data de Assinatura ÷ projetos da base Res. Acumulado do ciclo com Data de Assinatura. Usa a coluna IT1.1 do quadro (100 = no prazo); sem valor, conta os dias entre a Data de Assinatura e a Conclusão do Planejamento. Comparativo em pontos percentuais.`,
  it12: `IT1.2 · meta ${METAS.it12}%: projetos com Conclusão Registro SGI em até ${DIAS.it12} dias da Data de Assinatura ÷ projetos da base Res. Acumulado do ciclo com Data de Assinatura. Usa a coluna IT1.2 do quadro (100 = no prazo); sem valor, conta os dias entre a Data de Assinatura e a Conclusão Registro SGI. Comparativo em pontos percentuais.`,
};
