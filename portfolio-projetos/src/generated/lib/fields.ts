// Definições compartilhadas (cliente + servidor): campos lógicos, sugestão de mapeamento e de status.

export type ColumnInfo = { id: string; title: string; type: string; labels: string[] };
export type GroupInfo = { id: string; title: string };
export type FieldDef = { key: string; label: string; titles: string[]; types: string[]; optional?: boolean; /** Só sugere colunas do tipo esperado (desempate de títulos duplicados). */ strictType?: boolean };

export type StatusConfig = { concluded: string[]; excluded: string[]; reached: string[]; notReached: string[] };
export type ProjectConfig = {
  indicatorGroupId: string;
  measurementGroupId: string;
  indicatorCols: Record<string, string>;
  measurementCols: Record<string, string>;
  status: StatusConfig;
  // ——— Grupos operacionais (todos opcionais; '' ou ausente = não importar) ———
  scheduleGroupId?: string;
  scheduleCols?: Record<string, string>;
  /** Lê os subelementos das atividades do Cronograma. */
  importSubitems?: boolean;
  subitemCols?: Record<string, string>;
  productGroupId?: string;
  productCols?: Record<string, string>;
  riskGroupId?: string;
  riskCols?: Record<string, string>;
  scheduleStatus?: ScheduleStatus;
  productStatus?: ProductStatus;
  riskStatus?: RiskStatus;
};

export type ScheduleStatus = { concluded: string[]; excluded: string[]; healthOk: string[]; healthWarn: string[]; healthBad: string[] };
export type ProductStatus = { delivered: string[]; paid: string[] };
/** Listas ordenadas do menor para o maior. staleDays = limite de "atualização antiga". */
export type RiskStatus = { levels: string[]; probability: string[]; impact: string[]; staleDays: number };
export const EMPTY_SCHEDULE_STATUS: ScheduleStatus = { concluded: [], excluded: [], healthOk: [], healthWarn: [], healthBad: [] };
export const EMPTY_PRODUCT_STATUS: ProductStatus = { delivered: [], paid: [] };
export const EMPTY_RISK_STATUS: RiskStatus = { levels: [], probability: [], impact: [], staleDays: 30 };

export type GroupKey = 'ind' | 'med' | 'sched' | 'prod' | 'risk';
export const GROUP_LABEL: Record<GroupKey, string> = { ind: 'Indicadores', med: 'Medições', sched: 'Cronograma', prod: 'Produtos', risk: 'Riscos' };
export const OPS_GROUPS: GroupKey[] = ['sched', 'prod', 'risk'];

export function groupIdOf(cfg: ProjectConfig | null, g: GroupKey): string {
  if (!cfg) return '';
  return (g === 'ind' ? cfg.indicatorGroupId : g === 'med' ? cfg.measurementGroupId : g === 'sched' ? cfg.scheduleGroupId : g === 'prod' ? cfg.productGroupId : cfg.riskGroupId) ?? '';
}

const TXT = ['text', 'long_text', 'dropdown', 'status', 'formula', 'mirror', 'numbers'];

export const INDICATOR_FIELDS: FieldDef[] = [
  { key: 'descricao', label: 'Descrição do KR/KPI', titles: ['descricao do kr/kpi', 'descricao do kr', 'descricao do kpi'], types: ['long_text', 'text'] },
  { key: 'objetivo', label: 'Objetivo', titles: ['objetivo'], types: TXT },
  { key: 'tipo', label: 'Tipo de indicador', titles: ['tipo de indicador'], types: ['status', 'dropdown', 'text'] },
  { key: 'krVinculado', label: 'KR vinculado', titles: ['kr vinculado'], types: ['board_relation', 'dependency'] },
  { key: 'formaColeta', label: 'Forma de Coleta', titles: ['forma de coleta'], types: TXT },
  { key: 'temporalidade', label: 'Temporalidade', titles: ['temporalidade'], types: TXT },
  { key: 'meta', label: 'Meta', titles: ['meta'], types: ['numbers', 'text', 'formula'] },
  { key: 'polaridade', label: 'Polaridade', titles: ['polaridade'], types: ['status', 'dropdown', 'text'] },
  { key: 'unidade', label: 'Unidade', titles: ['unidade'], types: TXT },
  { key: 'formula', label: 'Fórmula de cálculo', titles: ['formula de calculo'], types: ['long_text', 'text'] },
  { key: 'qtdMedicoes', label: 'Quantidade de Medições', titles: ['quantidade de medicoes'], types: ['numbers', 'text', 'formula'] },
  { key: 'medicao', label: 'Medição (conexão)', titles: ['medicao', 'medicoes'], types: ['board_relation'] },
  { key: 'resultadoConsolidado', label: 'Resultado Consolidado', titles: ['resultado consolidado'], types: ['mirror', 'formula', 'numbers', 'text'] },
];

export const MEASUREMENT_FIELDS: FieldDef[] = [
  { key: 'prazo', label: 'Prazo de Medição', titles: ['prazo de medicao'], types: ['date'] },
  { key: 'responsavel', label: 'Responsável', titles: ['responsavel'], types: ['people', 'multiple-person', 'text'] },
  { key: 'statusMedicao', label: 'Status Medição', titles: ['status medicao', 'status da medicao'], types: ['status'] },
  { key: 'indicadorVinculado', label: 'Indicador Vinculado', titles: ['indicador vinculado'], types: ['board_relation'] },
  { key: 'meta', label: 'Meta (da medição)', titles: ['meta'], types: ['numbers', 'text', 'formula'] },
  { key: 'valorApurado', label: 'Valor Apurado', titles: ['valor apurado'], types: ['numbers', 'text', 'formula'] },
  { key: 'resultado', label: 'Resultado', titles: ['resultado'], types: ['formula', 'numbers', 'text', 'mirror'] },
  { key: 'statusMeta', label: 'Status da Meta', titles: ['status da meta'], types: ['formula', 'status', 'text', 'mirror'] },
  { key: 'baseDados', label: 'Base de dados', titles: ['base de dados'], types: ['link', 'file', 'text', 'long_text'] },
  { key: 'periodo', label: 'Período de Medição', titles: ['periodo de medicao'], types: ['timeline', 'text'], optional: true },
];

export function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function suggestColumn(def: FieldDef, cols: ColumnInfo[]): string {
  const byTitle = cols.filter((c) => def.titles.includes(norm(c.title)));
  const typed = byTitle.find((c) => def.types.includes(c.type));
  if (def.strictType) return typed?.id ?? '';
  return (typed ?? byTitle[0])?.id ?? '';
}

export function suggestGroup(kind: 'indicator' | 'measurement' | 'schedule' | 'product' | 'risk', groups: GroupInfo[]): string {
  if (kind === 'schedule' || kind === 'product' || kind === 'risk') {
    const stem = kind === 'schedule' ? 'cronograma' : kind === 'product' ? 'produto' : 'risco';
    const ex = groups.find((g) => [stem, `${stem}s`].includes(norm(g.title)));
    return (ex ?? groups.find((g) => norm(g.title).startsWith(stem)))?.id ?? '';
  }
  const exact = kind === 'indicator' ? ['indicador', 'indicadores'] : ['medicao do indicador', 'medicoes do indicador', 'medicao', 'medicoes'];
  const hit = groups.find((g) => exact.includes(norm(g.title)));
  if (hit) return hit.id;
  const part = groups.find((g) => (kind === 'indicator' ? norm(g.title).startsWith('indicador') : norm(g.title).includes('medic')));
  return part?.id ?? '';
}

export function suggestStatus(medLabels: string[], metaLabels: string[]): StatusConfig {
  const n = (l: string) => norm(l);
  return {
    concluded: medLabels.filter((l) => /conclu|finaliz/.test(n(l))),
    excluded: medLabels.filter((l) => /cancel|despriori|nao ha|nao aplic|^n\/a$/.test(n(l))),
    reached: metaLabels.filter((l) => /alcan|atingid|cumprid|superad/.test(n(l)) && !/nao|parcial/.test(n(l))),
    notReached: metaLabels.filter((l) => /(nao|abaixo).*(alcan|atingid|cumprid)|abaixo/.test(n(l))),
  };
}

export function parseConfig(raw: string | null | undefined): ProjectConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProjectConfig;
  } catch {
    return null;
  }
}

// Campos dos grupos operacionais (definidos em arquivo próprio para manter este enxuto).
export * from './fields-ops';
