import type { RawItem } from './monday.server';
import type { ProjectConfig } from '@generated/lib/fields';
import type { ProductDoc, RiskDoc, ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';
import { parseMoney, toIsoDate } from '@generated/lib/money';
import { read, track } from './extract.server';

const people = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Data simples ou timeline: devolve início e fim normalizados. */
function range(v: string | null): { from: string | null; to: string | null } {
  if (!v) return { from: null, to: null };
  if (v.includes('|')) { const [a, b] = v.split('|'); return { from: toIsoDate(a), to: toIsoDate(b) }; }
  const d = toIsoDate(v);
  return { from: d, to: d };
}
/** Campo de data: aceita date ou timeline (usa o fim). Texto não reconhecido é preservado. */
const dateOf = (v: string | null) => (v && v.includes('|') ? range(v).to : toIsoDate(v) ?? v);

function reader(item: RawItem, cols: Record<string, string> | undefined, optional: string[] = []) {
  const ua: string[] = [];
  const um: string[] = [];
  const g = (k: string) => {
    const r = read(item, cols?.[k]);
    if (optional.includes(k)) { if (r.unavailable) ua.push(k); return r; }
    return track(r, k, ua, um);
  };
  return { g, ua, um };
}

export function toScheduleItem(item: RawItem, boardId: string, cfg: ProjectConfig, now: string): ScheduleItemDoc {
  const { g, ua, um } = reader(item, cfg.scheduleCols);
  const prod = g('produto');
  const cr = range(g('cronograma').v);
  return {
    projectBoardId: boardId, itemId: String(item.id), name: item.name,
    frentes: g('frentes').v, responsaveis: people(g('responsavel').v), status: g('status').v, saude: g('saude').v,
    produtoIds: prod.ids, produtoText: prod.v, inicioPlanejado: cr.from, fimPlanejado: cr.to,
    unavailable: ua, unmapped: um, active: true, syncedAt: now,
  };
}

export function toSubitem(item: RawItem, parentId: string, boardId: string, cfg: ProjectConfig, now: string): ScheduleSubitemDoc {
  const { g, ua, um } = reader(item, cfg.subitemCols, ['produto']);
  const prod = g('produto');
  const cr = range(g('cronograma').v);
  return {
    projectBoardId: boardId, itemId: String(item.id), parentItemId: String(parentId), name: item.name,
    responsaveis: people(g('responsavel').v), status: g('status').v,
    produtoIds: prod.ids, produtoText: prod.v, inicioPlanejado: cr.from, fimPlanejado: cr.to,
    unavailable: ua, unmapped: um, active: true, syncedAt: now,
  };
}

export function toProduct(item: RawItem, boardId: string, cfg: ProjectConfig, now: string): ProductDoc {
  const { g, ua, um } = reader(item, cfg.productCols, ['planInicioEntrega']);
  const valor = g('valor').v;
  const plan = range(g('planInicioEntrega').v);
  const link = g('link');
  const fat = g('faturamento').v;
  const pag = g('pagamento').v;
  return {
    projectBoardId: boardId, itemId: String(item.id), name: item.name,
    valorText: valor, valor: parseMoney(valor),
    linkUrl: link.urls[0] ?? (link.v && /^https?:/.test(link.v) ? link.v : null), linkText: link.v,
    envioCpa: dateOf(g('envioCpa').v), comecoReal: dateOf(g('comecoReal').v), entregaReal: dateOf(g('entregaReal').v),
    status: g('status').v,
    faturamentoText: fat, faturamento: parseMoney(fat),
    pagamentoText: pag, pagamento: parseMoney(pag),
    statusPagamento: g('statusPagamento').v, entregaPlanejada: dateOf(g('entregaPlanejada').v),
    planInicio: plan.from, planEntrega: plan.to,
    unavailable: ua, unmapped: um, active: true, syncedAt: now,
  };
}

export function toRisk(item: RawItem, boardId: string, cfg: ProjectConfig, now: string): RiskDoc {
  const { g, ua, um } = reader(item, cfg.riskCols);
  const periodo = g('periodo').v;
  return {
    projectBoardId: boardId, itemId: String(item.id), name: item.name,
    periodo, tema: g('tema').v, categoria: g('categoria').v, impactado: g('impactado').v,
    causa: g('causa').v, efeito: g('efeito').v,
    probabilidadeStatus: g('probabilidadeStatus').v, impactoStatus: g('impactoStatus').v, nivel: g('nivel').v,
    estrategia: g('estrategia').v, resposta: g('resposta').v, responsaveis: people(g('responsavel').v),
    ultimaAtualizacao: dateOf(g('ultimaAtualizacao').v),
    probabilidadeFormula: g('probabilidadeFormula').v, impactoFormula: g('impactoFormula').v,
    unavailable: ua, unmapped: um, active: true, syncedAt: now,
  };
}

export const idsOf = (m: Record<string, string> | undefined) => [...new Set(Object.values(m ?? {}).filter(Boolean))];
