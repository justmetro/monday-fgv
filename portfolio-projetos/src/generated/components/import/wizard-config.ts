import {
  INDICATOR_FIELDS, MEASUREMENT_FIELDS, PRODUCT_FIELDS, RISK_FIELDS, SCHEDULE_FIELDS, SUBITEM_FIELDS,
  parseConfig, suggestColumn, suggestGroup, suggestProductStatus, suggestRiskStatus, suggestScheduleStatus,
  type ColumnInfo, type FieldDef, type GroupInfo, type ProjectConfig,
} from '@generated/lib/fields';

const sugg = (defs: FieldDef[], cols: ColumnInfo[]) => Object.fromEntries(defs.map((d) => [d.key, suggestColumn(d, cols)]));

/** Config inicial: a salva (preservada) completada com sugestões para os blocos novos ainda ausentes. */
export function initialConfig(saved: string | null, groups: GroupInfo[], cols: ColumnInfo[], subCols: ColumnInfo[], hasSub: boolean): ProjectConfig {
  const s = parseConfig(saved);
  const base: ProjectConfig = s ?? {
    indicatorGroupId: suggestGroup('indicator', groups),
    measurementGroupId: suggestGroup('measurement', groups),
    indicatorCols: sugg(INDICATOR_FIELDS, cols),
    measurementCols: sugg(MEASUREMENT_FIELDS, cols),
    status: { concluded: [], excluded: [], reached: [], notReached: [] },
  };
  return {
    ...base,
    scheduleGroupId: base.scheduleGroupId ?? suggestGroup('schedule', groups),
    scheduleCols: base.scheduleCols ?? sugg(SCHEDULE_FIELDS, cols),
    importSubitems: base.importSubitems ?? hasSub,
    subitemCols: base.subitemCols ?? sugg(SUBITEM_FIELDS, subCols),
    productGroupId: base.productGroupId ?? suggestGroup('product', groups),
    productCols: base.productCols ?? sugg(PRODUCT_FIELDS, cols),
    riskGroupId: base.riskGroupId ?? suggestGroup('risk', groups),
    riskCols: base.riskCols ?? sugg(RISK_FIELDS, cols),
  };
}

const lab = (cols: ColumnInfo[], id: string | undefined, extra: string[] = []) => [...new Set([...(cols.find((c) => c.id === id)?.labels ?? []), ...extra])];

export type OpsLabels = { sched: string[]; health: string[]; prod: string[]; pay: string[]; level: string[]; prob: string[]; imp: string[] };

export function opsLabels(cfg: ProjectConfig, cols: ColumnInfo[], subCols: ColumnInfo[], p: {
  sched: { statusValues: string[]; healthValues: string[] } | null; prods: { statusValues: string[]; payValues: string[] } | null;
  risks: { levelValues: string[]; probValues: string[]; impValues: string[] } | null;
} | null): OpsLabels {
  return {
    sched: [...new Set([...lab(cols, cfg.scheduleCols?.status, p?.sched?.statusValues), ...lab(subCols, cfg.subitemCols?.status)])],
    health: lab(cols, cfg.scheduleCols?.saude, p?.sched?.healthValues),
    prod: lab(cols, cfg.productCols?.status, p?.prods?.statusValues),
    pay: lab(cols, cfg.productCols?.statusPagamento, p?.prods?.payValues),
    level: lab(cols, cfg.riskCols?.nivel, p?.risks?.levelValues),
    prob: lab(cols, cfg.riskCols?.probabilidadeStatus, p?.risks?.probValues),
    imp: lab(cols, cfg.riskCols?.impactoStatus, p?.risks?.impValues),
  };
}

/** Sugere (por regex sobre os rótulos reais) só os blocos de status ainda não confirmados. */
export function withOpsStatusSuggestions(cfg: ProjectConfig, l: OpsLabels): ProjectConfig {
  return {
    ...cfg,
    scheduleStatus: cfg.scheduleStatus ?? (cfg.scheduleGroupId ? suggestScheduleStatus(l.sched, l.health) : undefined),
    productStatus: cfg.productStatus ?? (cfg.productGroupId ? suggestProductStatus(l.prod, l.pay) : undefined),
    riskStatus: cfg.riskStatus ?? (cfg.riskGroupId ? suggestRiskStatus(l.level, l.prob, l.imp) : undefined),
  };
}
