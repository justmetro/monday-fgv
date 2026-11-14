import { useCallback, useEffect, useRef, useState } from 'react';
import { Board0102IndicadoresBoard, Board0201ProjetosEmPlanejamentoBoard } from '@api/BoardSDK';
import { parseStart, num, MES_REF_LABELS, toDate, natCmp, objNome, objCor, MESES } from '@generated/lib';
import { isSaldoInd } from '@generated/calc';

export const board = new Board0102IndicadoresBoard();
const projBoard = new Board0201ProjetosEmPlanejamentoBoard();
/** shown statuses: Concluído / Retroativo = closed month · Em Progresso = partial · Cancelado / Não Iniciado are left out */
export const VALID = ['Concluído', 'Retroativo', 'Em Progresso'];
const AUTO_MS = 120000; // background refresh every 2 min while visible
const FOCUS_MS = 60000; // refresh on focus/visibility at most once per minute

/** link column → { url, text } or null */
const linkOf = (l) => (l?.url ? { url: l.url, text: l.label || l.text || l.url } : null);

async function loadAll(b, where, cols) {
  const all = [];
  let cursor = null;
  do {
    const q = cursor ? b.items().withColumns(cols).withPagination({ cursor }) : b.items().withColumns(cols).where(where).withPagination({ limit: 500 });
    const res = await q.execute();
    all.push(...(res.items ?? []));
    cursor = res.cursor;
  } while (cursor);
  return all;
}

const IND_GROUPS = ['topics', 'group_mm7wz4w1'];
const RASCUNHO_GROUP = 'group_mm7wz4w1';
const IND_COLS = ['cdigo', 'objetivo', 'nvel', 'meta', 'polaridade', 'formaDeColeta', 'baseDeDados', 'frmulaDeClculo', 'situaoDoDado', 'medies', 'unidadeDeMedida'];
// MEDIÇÃO view only: Resultado [V2] + Atingido / Total Período (manual "Valor apurado" is not read)
const MED_COLS = ['status', 'perodoDeReferncia', 'meta', 'resultadoV2', 'atingidoPerodo', 'totalPerodo',
  'indicadorVinculadoRelaoAntiga', 'indicadorVinculado', 'polaridade', 'prazoDaMedio', 'baseDeDados'];

function toIndicator(p) {
  const objNum = Number(String(p.objetivo ?? '').match(/Objetivo\s*(\d+)/i)?.[1]) || null;
  const codigo = (p.cdigo ?? '').trim();
  return {
    // official name everywhere = item name of the 01.02 Indicadores board
    id: String(p.id), code: codigo || `S/C·${p.id}`, semCodigo: !codigo, nome: p.name, curto: p.name,
    obj: objNum, objLabel: p.objetivo || null, nivel: p.nvel || null, sitDado: p.situaoDoDado || null,
    rascunho: p.group?.id === RASCUNHO_GROUP, unidade: [].concat(p.unidadeDeMedida ?? []).filter(Boolean).join(', ') || null, lower: p.polaridade === 'Quanto menos, melhor', metaInd: num(p.meta), meds: [],
    medIds: (p.medies?.linkedItems ?? []).map((x) => String(x.id)),
    fonte: { coleta: [].concat(p.formaDeColeta ?? []).filter(Boolean).join(', ') || null, base: linkOf(p.baseDeDados), formula: p.frmulaDeClculo || null },
  };
}
const NIVEL_ORD = { 'Tático': 0, 'Operacional': 1 };

/** month from the reference period; fallback: measurement deadline */
function periodOf(m) {
  const p = parseStart(m.perodoDeReferncia);
  if (p) return p;
  const d = toDate(m.prazoDaMedio);
  if (!d) return null;
  const y = d.getUTCFullYear(), mo = d.getUTCMonth();
  return { key: y * 100 + mo + 1, month: mo, year: y, label: `${MESES[mo]}/${String(y).slice(2)}`, fromPrazo: true };
}
/** Resultado [V2] (= Atingido ÷ Total × 100); no cases when Total Período is empty or 0 */
function apuradoOf(m, n, d) {
  if (!(d > 0)) return null;
  const v = num(m.resultadoV2);
  return Math.round((v ?? ((n ?? 0) / d) * 100) * 10) / 10;
}

async function fetchAll() {
  const [meds, inds, projs] = await Promise.all([
    loadAll(board, { group: ['group_title'] }, MED_COLS),
    loadAll(board, { group: IND_GROUPS, exibirNoPainel: true }, IND_COLS),
    loadAll(projBoard, { msRefernciaResultado: MES_REF_LABELS }, ['gerente1', 'dataDeAssinatura', 'conclusoDoPlanejamento',
      'conclusoRegistroSgi', 'msRefernciaResultado', 'statusPlanejamento', 'incioPlanejamento'])
      .catch((e) => { console.error(e); return []; }),
  ]);
  const list = inds.filter((p) => IND_GROUPS.includes(p.group?.id)).map(toIndicator)
    .sort((x, y) => (x.obj ?? 99) - (y.obj ?? 99) || (NIVEL_ORD[x.nivel] ?? 2) - (NIVEL_ORD[y.nivel] ?? 2) || natCmp(x.code, y.code));
  const objInfo = {};
  list.forEach((i) => {
    const k = i.obj ?? 0;
    const o = (objInfo[k] ??= { id: k, nome: objNome(i.objLabel, i.obj), cor: objCor(i.obj), selo: null });
    if (i.rascunho) o.selo = 'RASCUNHO';
    else if (!o.selo && ['A avaliar', 'Sem fonte'].includes(i.sitDado)) o.selo = 'EM REVISÃO';
  });
  list.forEach((i) => { i.objInfo = objInfo[i.obj ?? 0]; });
  const byId = new Map(list.map((i) => [i.id, i]));
  const byMed = new Map(list.flatMap((i) => i.medIds.map((mid) => [mid, i])));
  const byCode = new Map(list.filter((i) => !i.semCodigo).map((i) => [i.code.toUpperCase(), i]));
  // link order: old relation → indicator's MEDIÇÕES relation → "Indicador vinculado" dropdown (code prefix)
  const findInd = (m) => {
    const rel = (m.indicadorVinculadoRelaoAntiga?.linkedItems ?? []).map((x) => byId.get(String(x.id))).find(Boolean);
    if (rel) return rel;
    if (byMed.has(String(m.id))) return byMed.get(String(m.id));
    const opt = [].concat(m.indicadorVinculado ?? [])[0];
    const code = typeof opt === 'string' ? opt.split(/\s+-\s+/)[0].trim().toUpperCase() : null;
    return code ? byCode.get(code) : undefined;
  };
  const excl = {};
  const skip = (k) => { excl[k] = (excl[k] ?? 0) + 1; };
  const hasLink = (m) => (m.indicadorVinculadoRelaoAntiga?.linkedItems?.length ?? 0) > 0 || [].concat(m.indicadorVinculado ?? []).length > 0 || byMed.has(String(m.id));
  const raw = [];
  let semStatus = 0, viaPrazo = 0;
  for (const m of meds) {
    if (m.group?.id !== 'group_title') continue;
    const entry = findInd(m);
    if (!entry) { skip(hasLink(m) ? 'Indicador não marcado em "Exibir no painel"' : 'Sem indicador vinculado'); continue; }
    const period = periodOf(m);
    const n = num(m.atingidoPerodo), d = num(m.totalPerodo);
    const r = { id: String(m.id), name: m.name, code: entry.code, status: m.status ?? null, period,
      periodEnd: toDate(m.perodoDeReferncia?.to), prazo: toDate(m.prazoDaMedio), apurado: apuradoOf(m, n, d),
      meta: num(m.meta), n, d, parcial: m.status === 'Em Progresso', base: linkOf(m.baseDeDados) };
    raw.push(r);
    if (m.status === 'Cancelado' || m.status === 'Não Iniciado') { skip(`Status "${m.status}"`); continue; }
    if (!period) { skip('Sem período de referência nem prazo'); continue; }
    if (!m.status) semStatus++;
    if (period.fromPrazo) viaPrazo++;
    if (m.polaridade === 'Quanto menos, melhor') entry.lower = true;
    entry.meds.push({ ...r, meta: r.meta ?? entry.metaInd });
  }
  const ind = list.map((e) => {
    // one measurement per month: keep the most complete / latest id
    const byMonth = new Map();
    e.meds.forEach((x) => {
      const k = x.period.key, prev = byMonth.get(k);
      const rank = (z) => (z.status === 'Concluído' || z.status === 'Retroativo' ? 1 : 0);
      if (!prev || rank(x) > rank(prev) || (rank(x) === rank(prev) && Number(x.id) > Number(prev.id))) byMonth.set(k, x);
    });
    const out = { ...e, meds: [...byMonth.values()].sort((x, y) => x.period.key - y.period.key) };
    out.saldo = isSaldoInd(out);
    out.meds = out.meds.map((x) => ({ ...x, saldo: out.saldo }));
    return out;
  });
  const projects = projs.map((p) => {
    const mes = MES_REF_LABELS.indexOf(p.msRefernciaResultado);
    return { id: String(p.id), name: p.name, gerente: p.gerente1?.join(', ') || '—', assin: toDate(p.dataDeAssinatura), mes, inicio: toDate(p.incioPlanejamento),
      concPlan: toDate(p.conclusoDoPlanejamento), concSgi: toDate(p.conclusoRegistroSgi), statusPlan: p.statusPlanejamento };
  }).filter((p) => p.mes >= 0);
  const usadas = ind.reduce((s, i) => s + i.meds.length, 0);
  const carga = { total: meds.length, usadas, fora: Object.entries(excl).map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd), semStatus, viaPrazo };
  return { ind, raw, projects, carga };
}

export function useIndicadores() {
  const [state, setState] = useState({ loading: true, refetching: false, error: null, ind: [], raw: [], projects: [], carga: null, updatedAt: null });
  const load = useCallback((silent) => {
    setState((s) => ({ ...s, refetching: !!silent }));
    return fetchAll().then((d) => setState({ loading: false, refetching: false, error: null, ...d, updatedAt: new Date() }))
      .catch((e) => { console.error(e); setState((s) => ({ ...s, loading: false, refetching: false, error: 'Não foi possível carregar as medições.' })); });
  }, []);
  const lastLoad = useRef(0);
  const busy = useRef(false);
  const run = useCallback((silent) => {
    if (busy.current) return Promise.resolve();
    busy.current = true; lastLoad.current = Date.now();
    return load(silent).finally(() => { busy.current = false; });
  }, [load]);
  useEffect(() => { run(false); }, [run]);
  useEffect(() => {
    const visible = () => document.visibilityState === 'visible';
    const maybe = () => { if (visible() && Date.now() - lastLoad.current > FOCUS_MS) run(true); };
    const tick = setInterval(() => { if (visible() && Date.now() - lastLoad.current >= AUTO_MS - 1000) run(true); }, 15000);
    document.addEventListener('visibilitychange', maybe);
    window.addEventListener('focus', maybe);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', maybe); window.removeEventListener('focus', maybe); };
  }, [run]);
  return { ...state, reload: () => run(true) };
}
