import type { RawItem } from './monday.server';
import type { ProjectConfig } from '@generated/lib/fields';
import type { IndicatorDoc, MeasurementDoc } from '@generated/models';

export type Read = { v: string | null; ids: string[]; urls: string[]; labels: string[]; unavailable: boolean; unmapped: boolean };

export function read(item: RawItem, colId: string | undefined): Read {
  const base: Read = { v: null, ids: [], urls: [], labels: [], unavailable: false, unmapped: false };
  if (!colId) return { ...base, unmapped: true };
  const cv = item.column_values.find((c) => c.id === colId);
  if (!cv) return { ...base, unavailable: true };
  const clean = (s: string | null | undefined) => (s == null || s.trim() === '' ? null : s);
  switch (cv.type) {
    case 'formula':
    case 'mirror':
    case 'lookup':
      if (cv.display_value === undefined || cv.display_value === null) {
        const t = clean(cv.text);
        return t ? { ...base, v: t } : { ...base, unavailable: true };
      }
      return { ...base, v: clean(cv.display_value) };
    case 'board_relation':
    case 'dependency':
      return { ...base, ids: (cv.linked_item_ids ?? []).map(String), v: clean(cv.display_value ?? cv.text) };
    case 'link':
      return { ...base, v: clean(cv.url_text || cv.url || cv.text), urls: cv.url ? [cv.url] : [], labels: cv.url ? [cv.url_text || cv.url] : [] };
    case 'date':
      return { ...base, v: clean(cv.date ?? cv.text) };
    case 'timeline':
      return { ...base, v: cv.from || cv.to ? `${cv.from ?? ''}|${cv.to ?? ''}` : null };
    case 'file': {
      const t = clean(cv.text);
      const urls = t ? t.split(',').map((s) => s.trim()).filter((s) => /^https?:/.test(s)) : [];
      return { ...base, v: t, urls, labels: urls.map((u) => decodeURIComponent(u.split('/').pop() ?? u)) };
    }
    default:
      return { ...base, v: clean(cv.text) };
  }
}

export function track(r: Read, key: string, unavailable: string[], unmapped: string[]) {
  if (r.unmapped) unmapped.push(key);
  else if (r.unavailable) unavailable.push(key);
  return r;
}

export function toIndicator(item: RawItem, boardId: string, cfg: ProjectConfig, now: string): IndicatorDoc {
  const ua: string[] = [];
  const um: string[] = [];
  const c = cfg.indicatorCols;
  const g = (k: string) => track(read(item, c[k]), k, ua, um);
  const kr = g('krVinculado');
  const med = g('medicao');
  return {
    projectBoardId: boardId, itemId: String(item.id), name: item.name,
    descricao: g('descricao').v, objetivo: g('objetivo').v, tipo: g('tipo').v,
    krVinculadoIds: kr.ids, krVinculadoText: kr.v,
    formaColeta: g('formaColeta').v, temporalidade: g('temporalidade').v, meta: g('meta').v,
    polaridade: g('polaridade').v, unidade: g('unidade').v, formula: g('formula').v,
    qtdMedicoes: g('qtdMedicoes').v, medicaoIds: med.ids,
    resultadoConsolidado: g('resultadoConsolidado').v,
    unavailable: ua, unmapped: um, active: true, syncedAt: now,
  };
}

export function toMeasurement(item: RawItem, boardId: string, cfg: ProjectConfig, now: string): MeasurementDoc {
  const ua: string[] = [];
  const um: string[] = [];
  const c = cfg.measurementCols;
  const g = (k: string) => track(read(item, c[k]), k, ua, um);
  const resp = g('responsavel');
  const base = g('baseDados');
  const periodo = read(item, c.periodo); // opcional: não gera aviso se ausente
  if (periodo.unavailable) ua.push('periodo');
  return {
    projectBoardId: boardId, itemId: String(item.id), name: item.name,
    prazo: g('prazo').v,
    responsaveis: resp.v ? resp.v.split(',').map((s) => s.trim()).filter(Boolean) : [],
    statusMedicao: g('statusMedicao').v,
    indicadorIds: g('indicadorVinculado').ids,
    meta: g('meta').v, valorApurado: g('valorApurado').v, resultado: g('resultado').v,
    statusMeta: g('statusMeta').v,
    baseDadosText: base.v, baseDadosUrls: base.urls, baseDadosLabels: base.labels,
    periodo: periodo.v,
    unavailable: ua, unmapped: um, active: true, syncedAt: now,
  };
}

export function colIds(cfg: ProjectConfig, kind: 'indicator' | 'measurement'): string[] {
  const m = kind === 'indicator' ? cfg.indicatorCols : cfg.measurementCols;
  return [...new Set(Object.values(m).filter(Boolean))];
}
