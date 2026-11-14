// Sinalizações dos grupos operacionais, gravadas na sincronização (data de referência = flagsAt).
import { EMPTY_PRODUCT_STATUS, EMPTY_RISK_STATUS, EMPTY_SCHEDULE_STATUS, norm, type ProjectConfig } from '@generated/lib/fields';
import type { ProductDoc, RiskDoc, ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';

export function flagSchedule<T extends ScheduleItemDoc | ScheduleSubitemDoc>(x: T, cfg: ProjectConfig, today: string, flagsAt: string): T {
  const st = cfg.scheduleStatus ?? EMPTY_SCHEDULE_STATUS;
  const closed = !!x.status && (st.concluded.includes(x.status) || st.excluded.includes(x.status));
  return {
    ...x,
    flagSemResponsavel: !x.unmapped.includes('responsavel') && x.responsaveis.length === 0,
    flagSemCronograma: !x.unmapped.includes('cronograma') && !x.fimPlanejado && !x.inicioPlanejado,
    flagAtrasada: !!x.fimPlanejado && x.fimPlanejado < today && !closed,
    flagsAt,
  };
}

export const isDelivered = (p: ProductDoc, cfg: ProjectConfig | null) => !!p.entregaReal || (!!p.status && (cfg?.productStatus ?? EMPTY_PRODUCT_STATUS).delivered.includes(p.status));

export function flagProduct(p: ProductDoc, cfg: ProjectConfig, today: string, flagsAt: string): ProductDoc {
  const st = cfg.productStatus ?? EMPTY_PRODUCT_STATUS;
  const delivered = isDelivered(p, cfg);
  const paid = !!p.statusPagamento && st.paid.includes(p.statusPagamento);
  return {
    ...p,
    flagEntregaAtrasada: !!p.entregaPlanejada && p.entregaPlanejada < today && !p.entregaReal && !delivered,
    flagSemEntregaPlanejada: !p.unmapped.includes('entregaPlanejada') && !p.entregaPlanejada,
    flagEntregueSemFaturamento: delivered && !p.unmapped.includes('faturamento') && p.faturamento == null && !p.faturamentoText,
    flagPagamentoPendente: delivered && st.paid.length > 0 && !p.unmapped.includes('statusPagamento') && !paid,
    flagsAt,
  };
}

/** Status × fórmula: número compara com a posição (1..n) na escala; texto compara normalizado. */
function diverges(status: string | null, formula: string | null, scale: string[]): boolean {
  if (!status || !formula) return false;
  const f = formula.trim().replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(f)) {
    const i = scale.indexOf(status);
    return i >= 0 && Number(f) !== i + 1;
  }
  return norm(status) !== norm(formula);
}

export function flagRisk(r: RiskDoc, cfg: ProjectConfig, today: string, flagsAt: string): RiskDoc {
  const st = cfg.riskStatus ?? EMPTY_RISK_STATUS;
  const limit = new Date(`${today}T12:00:00`);
  limit.setDate(limit.getDate() - (st.staleDays || 30));
  const lim = limit.toISOString().slice(0, 10);
  const upd = r.ultimaAtualizacao?.slice(0, 10) ?? null;
  return {
    ...r,
    flagSemResponsavel: !r.unmapped.includes('responsavel') && r.responsaveis.length === 0,
    flagAtualizacaoAntiga: !r.unmapped.includes('ultimaAtualizacao') && (!upd || upd < lim),
    flagDivergencia: diverges(r.probabilidadeStatus, r.probabilidadeFormula, st.probability) || diverges(r.impactoStatus, r.impactoFormula, st.impact),
    flagsAt,
  };
}
