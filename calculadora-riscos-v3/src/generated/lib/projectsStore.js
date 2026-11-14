import { readProjects } from '@generated/lib/fields';
import { fetchItemsByIds, isRateLimit, sleep, txt, errorMessage } from '@generated/lib/monday';
import { parseBoardId, readBoardNames, countProjectRisks } from '@generated/lib/sendData';

/**
 * Cache em memória dos projetos do 09.1, compartilhado entre as abas.
 * Carrega todos os itens uma vez (500 por página) e só recarrega quando pedido.
 */
export const STORE_COLS = ['calculadora', 'riscosGerados', 'dataDaLtimaExecuo', 'envioAoPlanejamento', 'linkDoPlanejamento'];
const RAW_COLS = ['calc', 'n_riscos', 'data_calc', 'envio_plan', 'link_mm7nck8b'];

let state = {
  items: [], status: 'idle', refreshing: false, error: null, loadedAt: null,
  meta: new Map(), metaPending: new Set(), metaLoaded: false,
};
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

export const getState = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const linkBoardId = (link) => parseBoardId(link?.url) || parseBoardId(link?.label);

async function withRetry(fn) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (err) {
      if (!isRateLimit(err) || i >= 4) throw err;
      await sleep(10000);
    }
  }
}

async function fetchAllProjects() {
  const items = await withRetry(() => readProjects());
  return items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

let inflight = null;
/** Carrega a base (uma vez). force = recarrega sem esvaziar a tela. */
export function loadProjects({ force = false } = {}) {
  if (inflight) return inflight;
  if (!force && state.status === 'ready') return Promise.resolve(state.items);
  const first = state.items.length === 0;
  set(first ? { status: 'loading', error: null } : { refreshing: true, error: null });
  inflight = (async () => {
    try {
      const items = await fetchAllProjects();
      set({ items, status: 'ready', refreshing: false, loadedAt: new Date() });
      return items;
    } catch (err) {
      console.error('Erro ao carregar projetos do 09.1:', err);
      set({ status: state.items.length ? 'ready' : 'error', refreshing: false, error: `Não foi possível carregar os projetos do 09.1. Detalhe: ${errorMessage(err)}` });
      throw err;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Aplica valores conhecidos (resultado de execução) direto na base compartilhada. */
export function patchItems(patches) {
  set({ items: state.items.map((it) => (patches[it.id] ? { ...it, ...patches[it.id] } : it)) });
}

/** Relê só os itens processados e atualiza a base com os valores gravados. */
export async function refetchItems(ids) {
  if (!ids?.length) return;
  try {
    const raw = await fetchItemsByIds(ids, RAW_COLS);
    const patches = {};
    raw.forEach((r) => {
      const c = r.cols;
      let link = null;
      try {
        const v = JSON.parse(c.link_mm7nck8b?.value || 'null');
        if (v?.url) link = { url: v.url, label: v.text || v.url };
      } catch { link = null; }
      const n = txt(c.n_riscos).trim();
      const d = txt(c.data_calc).trim();
      patches[r.id] = {
        name: r.name,
        calculadora: txt(c.calc).trim() || null,
        riscosGerados: n === '' ? null : Number(n),
        dataDaLtimaExecuo: d ? new Date(`${d.slice(0, 10)}T00:00:00.000Z`) : null,
        envioAoPlanejamento: txt(c.envio_plan).trim() || null,
        linkDoPlanejamento: link,
      };
    });
    patchItems(patches);
  } catch (err) {
    console.error('Erro ao reler projetos processados:', err);
  }
}

/** Meta do envio (nome do quadro destino + riscos no 09.4) para os projetos informados, em lotes de 100. */
export async function loadMeta(items) {
  const withLink = items.filter((it) => linkBoardId(it.linkDoPlanejamento));
  const ids = items.map((it) => it.id);
  if (!ids.length) { set({ metaLoaded: true }); return; }
  set({ metaPending: new Set([...state.metaPending, ...ids]) });
  const boardIds = [...new Set(withLink.map((it) => linkBoardId(it.linkDoPlanejamento)))];
  let names = null;
  try { names = boardIds.length ? await readBoardNames(boardIds) : new Map(); } catch (err) {
    console.error('Erro ao ler quadros de planejamento:', err);
  }
  const counts = new Map();
  let countsOk = true;
  for (let i = 0; i < ids.length; i += 100) {
    try {
      const part = await countProjectRisks(ids.slice(i, i + 100));
      part.forEach((v, k) => counts.set(k, v));
    } catch (err) {
      console.error('Erro ao contar riscos do 09.4:', err);
      countsOk = false;
    }
    if (i + 100 < ids.length) await sleep(250);
  }
  const meta = new Map(state.meta);
  items.forEach((it) => {
    const bid = linkBoardId(it.linkDoPlanejamento);
    meta.set(it.id, {
      boardId: bid,
      destName: bid && names ? names.get(bid) ?? null : null,
      destChecked: Boolean(names),
      risks: countsOk ? counts.get(String(it.id)) ?? { total: 0, by: {} } : null,
    });
  });
  const pending = new Set(state.metaPending);
  ids.forEach((id) => pending.delete(id));
  set({ meta, metaPending: pending, metaLoaded: true });
}

let metaInflight = null;
export function ensureMeta() {
  if (state.metaLoaded || metaInflight || state.status !== 'ready') return;
  metaInflight = loadMeta(state.items).finally(() => { metaInflight = null; });
}

/** "Atualizar dados": base de projetos e, se já carregada, a meta do envio. */
export async function refreshAll() {
  const items = await loadProjects({ force: true });
  if (state.metaLoaded) await loadMeta(items);
}
