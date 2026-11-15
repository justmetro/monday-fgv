import { type Projeto, toDate } from '@generated/lib/format';
import { isInativo } from '@generated/lib/board-options';
import { taxaNoPrazo } from '@generated/lib/metricas';
import { nomesGerentesDe, isAtivoNaEsteira } from '@generated/lib/carga';
import { foraDoTotalPorStatus, somar } from '@generated/lib/finance';
import type { SnapshotSemanal } from '@generated/models';

export type Granularidade = 'mes' | 'trimestre';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface Bucket { key: string; rotulo: string; ini: Date; fim: Date }

/** Last 12 months or last 6 quarters (oldest first), ending in the current one. */
export function buckets(g: Granularidade, hoje = new Date()): Bucket[] {
  if (g === 'mes') {
    return Array.from({ length: 12 }, (_, i) => {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1);
      const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0, 23, 59, 59);
      return { key: `${ini.getFullYear()}-${ini.getMonth() + 1}`, rotulo: `${MESES[ini.getMonth()]}/${String(ini.getFullYear()).slice(2)}`, ini, fim };
    });
  }
  const tAtual = Math.floor(hoje.getMonth() / 3);
  return Array.from({ length: 6 }, (_, i) => {
    const ini = new Date(hoje.getFullYear(), (tAtual - 5 + i) * 3, 1);
    const fim = new Date(ini.getFullYear(), ini.getMonth() + 3, 0, 23, 59, 59);
    return { key: `${ini.getFullYear()}-T${Math.floor(ini.getMonth() / 3) + 1}`, rotulo: `T${Math.floor(ini.getMonth() / 3) + 1}/${String(ini.getFullYear()).slice(2)}`, ini, fim };
  });
}

const em = (d: Date | null, b: Bucket) => !!d && d >= b.ini && d <= b.fim;

/** Financial balance with the same base as the Financeiro tab (no Pausado / Novo Cadastro). */
export function saldosAtuais(items: Projeto[]) {
  const base = items.filter((p) => p.statusPlanejamento !== 'Pausado' && !foraDoTotalPorStatus(p));
  const t = somar(base);
  return { total: t.totalSaldo, insumo: t.insumosSaldo, equipe: t.equipeSaldo };
}

/** Average active projects per manager (managers with ≥ 1 active project, from the 02.01 "Gerente" column). */
export function mediaAtivosPorGerente(items: Projeto[]): number | null {
  const porG = new Map<string, number>();
  for (const p of items) {
    if (!isAtivoNaEsteira(p)) continue;
    for (const g of nomesGerentesDe(p)) porG.set(g.key, (porG.get(g.key) ?? 0) + 1);
  }
  if (!porG.size) return null;
  return [...porG.values()].reduce((a, b) => a + b, 0) / porG.size;
}

export interface Ponto {
  rotulo: string;
  entradas: number;
  saidas: number;
  emPlanejamento: number;
  saldoTotal: number | null;
  saldoInsumo: number | null;
  saldoEquipe: number | null;
}

/**
 * Series: novos projetos (Início Planejamento) / planejamento concluído (Conclusão do Planejamento) / em planejamento
 * are rebuilt from the board dates; balances come from the weekly
 * snapshots (latest snapshot inside the bucket), so they only exist from the first snapshot on.
 */
export function serie(items: Projeto[], snaps: SnapshotSemanal[], g: Granularidade): Ponto[] {
  return buckets(g).map((b) => {
    const s = [...snaps].filter((x) => em(toDate(x.inicioSemana), b)).sort((a, c) => a.semana.localeCompare(c.semana)).pop();
    return {
      rotulo: b.rotulo,
      entradas: items.filter((p) => em(toDate(p.incioPlanejamento), b)).length,
      saidas: items.filter((p) => em(toDate(p.conclusoDoPlanejamento), b)).length,
      emPlanejamento: items.filter((p) => {
        const ini = toDate(p.incioPlanejamento);
        const fim = toDate(p.conclusoDoPlanejamento);
        return !!ini && ini <= b.fim && (!fim || fim > b.fim);
      }).length,
      saldoTotal: s?.saldoTotal ?? null,
      saldoInsumo: s?.saldoInsumo ?? null,
      saldoEquipe: s?.saldoEquipe ?? null,
    };
  });
}

/** ISO week key (yyyy-Www) and its Monday (yyyy-mm-dd). */
export function semanaIso(d = new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dow);
  const ano = dt.getUTCFullYear();
  const semana = Math.ceil(((dt.getTime() - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7);
  const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() || 7) - 1));
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { semana: `${ano}-W${String(semana).padStart(2, '0')}`, inicioSemana: iso(seg) };
}

/** Current metrics saved in the weekly snapshot. */
export function metricasAtuais(items: Projeto[]) {
  const s = saldosAtuais(items);
  const ano = new Date().getFullYear();
  return {
    ...semanaIso(),
    emPlanejamento: items.filter((p) => !isInativo(p.statusPlanejamento)).length,
    pctNoPrazo: taxaNoPrazo(items, 'plan', (d) => d.getFullYear() === ano).pct,
    saldoTotal: s.total, saldoInsumo: s.insumo, saldoEquipe: s.equipe,
    mediaAtivosPorGerente: mediaAtivosPorGerente(items),
  };
}

/** Earliest date the history covers: first Início Planejamento or first snapshot, whichever is older. */
export function historicoDesde(items: Projeto[], snaps: SnapshotSemanal[]): Date | null {
  const ds = [...items.map((p) => toDate(p.incioPlanejamento)), ...snaps.map((s) => toDate(s.inicioSemana))].filter((d): d is Date => !!d);
  return ds.length ? new Date(Math.min(...ds.map((d) => d.getTime()))) : null;
}
