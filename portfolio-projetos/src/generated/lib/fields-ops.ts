// Campos lógicos e sugestões de status dos grupos operacionais (Cronograma, Subelementos, Produtos, Riscos).
import { norm, type FieldDef, type ProductStatus, type RiskStatus, type ScheduleStatus } from './fields';

const DATE = ['date', 'timeline', 'formula', 'mirror', 'text'];
const PEOPLE = ['people', 'multiple-person', 'person', 'text', 'dropdown'];
const MONEY = ['numbers', 'formula', 'mirror', 'text'];
const REL = ['board_relation', 'dependency', 'mirror'];

export const SCHEDULE_FIELDS: FieldDef[] = [
  { key: 'frentes', label: 'Frentes', titles: ['frentes', 'frente'], types: ['dropdown', 'status', 'text', 'tags'] },
  { key: 'responsavel', label: 'Responsável', titles: ['responsavel', 'responsaveis'], types: PEOPLE },
  { key: 'status', label: 'Status', titles: ['status'], types: ['status', 'text'] },
  { key: 'saude', label: 'Saúde', titles: ['saude'], types: ['status', 'formula', 'text'] },
  { key: 'produto', label: 'Produto - Cronograma', titles: ['produto - cronograma', 'produto', 'produtos'], types: REL },
  { key: 'cronograma', label: 'Cronograma planejado', titles: ['cronograma planejado', 'cronograma'], types: ['timeline', 'date'] },
];

export const SUBITEM_FIELDS: FieldDef[] = [
  { key: 'responsavel', label: 'Responsável', titles: ['responsavel', 'responsaveis', 'pessoa', 'proprietario'], types: PEOPLE },
  { key: 'status', label: 'Status', titles: ['status'], types: ['status', 'text'] },
  { key: 'cronograma', label: 'Cronograma planejado', titles: ['cronograma planejado', 'cronograma', 'cronograma de tempo'], types: ['timeline', 'date'] },
  { key: 'produto', label: 'Produto - Cronograma', titles: ['produto - cronograma', 'produto', 'produtos'], types: REL, optional: true },
];

export const PRODUCT_FIELDS: FieldDef[] = [
  { key: 'valor', label: 'Valor Produto', titles: ['valor produto', 'valor do produto', 'valor'], types: MONEY },
  { key: 'link', label: 'Link do Produto', titles: ['link do produto', 'link'], types: ['link', 'text', 'file'] },
  { key: 'envioCpa', label: 'Envio à CPA', titles: ['envio a cpa', 'envio cpa'], types: DATE },
  { key: 'comecoReal', label: 'Começo Real', titles: ['comeco real', 'inicio real'], types: DATE },
  { key: 'entregaReal', label: 'Entrega Real', titles: ['entrega real'], types: DATE },
  { key: 'status', label: 'Status Produto', titles: ['status produto', 'status do produto', 'status'], types: ['status', 'text'] },
  { key: 'faturamento', label: 'Faturamento estimado', titles: ['faturamento estimado'], types: [...MONEY, 'date'] },
  { key: 'pagamento', label: 'Pagamento estimado', titles: ['pagamento estimado'], types: [...MONEY, 'date'] },
  { key: 'statusPagamento', label: 'Status Pagamento', titles: ['status pagamento', 'status do pagamento'], types: ['status', 'text'] },
  { key: 'entregaPlanejada', label: 'Entrega Planejada', titles: ['entrega planejada'], types: DATE },
  { key: 'planInicioEntrega', label: 'Planejado Início - Entrega', titles: ['planejado inicio - entrega', 'planejado inicio entrega', 'planejado inicio-entrega'], types: ['timeline', 'date', 'formula', 'mirror'], optional: true },
];

export const RISK_FIELDS: FieldDef[] = [
  { key: 'periodo', label: 'Período do Risco', titles: ['periodo do risco', 'periodo'], types: ['timeline', 'date', 'text', 'dropdown', 'status'] },
  { key: 'tema', label: 'Tema', titles: ['tema'], types: ['dropdown', 'status', 'text'] },
  { key: 'categoria', label: 'Categoria', titles: ['categoria'], types: ['dropdown', 'status', 'text'] },
  { key: 'impactado', label: 'Impactado', titles: ['impactado', 'impactados'], types: ['dropdown', 'text', 'status', 'people'] },
  { key: 'causa', label: 'Causa', titles: ['causa'], types: ['long_text', 'text'] },
  { key: 'efeito', label: 'Efeito', titles: ['efeito'], types: ['long_text', 'text'] },
  { key: 'probabilidadeStatus', label: 'Probabilidade (status)', titles: ['probabilidade'], types: ['status', 'dropdown'], strictType: true },
  { key: 'impactoStatus', label: 'Impacto (status)', titles: ['impacto'], types: ['status', 'dropdown'], strictType: true },
  { key: 'nivel', label: 'Nível do Risco (fórmula)', titles: ['nivel do risco', 'nivel de risco', 'nivel'], types: ['formula', 'status', 'mirror', 'text'] },
  { key: 'estrategia', label: 'Estratégia', titles: ['estrategia'], types: ['status', 'dropdown', 'text'] },
  { key: 'resposta', label: 'Descrição da Resposta ao Risco', titles: ['descricao da resposta ao risco', 'resposta ao risco'], types: ['long_text', 'text'] },
  { key: 'responsavel', label: 'Responsável pelo Monitoramento', titles: ['responsavel pelo monitoramento', 'responsavel'], types: PEOPLE },
  { key: 'ultimaAtualizacao', label: 'Última atualização', titles: ['ultima atualizacao'], types: ['date', 'last_updated', 'timeline', 'text'] },
  { key: 'probabilidadeFormula', label: 'Probabilidade (fórmula)', titles: ['probabilidade'], types: ['formula'], strictType: true },
  { key: 'impactoFormula', label: 'Impacto (fórmula)', titles: ['impacto'], types: ['formula'], strictType: true },
];

const pick = (labels: string[], re: RegExp, not?: RegExp) => labels.filter((l) => re.test(norm(l)) && !(not && not.test(norm(l))));
const ORDER: [RegExp, number][] = [[/muito baix|insignific|^rar/, 0], [/muito alt|critic|extrem|quase cert/, 4], [/baix|pequen|improv/, 1], [/medi|moderad|possiv/, 2], [/alt|grave|provav/, 3]];

/** Ordena rótulos do menor para o maior por palavras-chave; sem correspondência ficam no fim. */
export function orderLevels(labels: string[]): string[] {
  const score = (l: string) => ORDER.find(([re]) => re.test(norm(l)))?.[1] ?? 99;
  return [...new Set(labels.filter(Boolean))].sort((a, b) => score(a) - score(b));
}

export function suggestScheduleStatus(statusLabels: string[], healthLabels: string[]): ScheduleStatus {
  return {
    concluded: pick(statusLabels, /conclu|finaliz|feito|entregue/, /nao/),
    excluded: pick(statusLabels, /cancel|despriori|exclu|suspens/),
    healthOk: pick(healthLabels, /no prazo|em dia|saudav|^ok|normal|verde|adiantad/, /nao/),
    healthWarn: pick(healthLabels, /atenc|risco|alert|amarel/),
    healthBad: pick(healthLabels, /atras|critic|vermelh|fora do prazo/),
  };
}

export function suggestProductStatus(statusLabels: string[], payLabels: string[]): ProductStatus {
  return { delivered: pick(statusLabels, /entregu|conclu|aprovad|finaliz/, /nao/), paid: pick(payLabels, /pago|recebid|quitad|liquidad/, /nao|pend/) };
}

export function suggestRiskStatus(levels: string[], prob: string[], imp: string[]): RiskStatus {
  return { levels: orderLevels(levels), probability: orderLevels(prob), impact: orderLevels(imp), staleDays: 30 };
}
