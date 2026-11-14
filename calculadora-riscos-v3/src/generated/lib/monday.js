import { mondayClient } from '@/context/MondayContextProvider';

/** Chamada GraphQL com o login de quem usa o app (monday SDK). Erros viram Error com cause.errors. */
async function execGql(query, variables) {
  let res;
  try {
    res = await mondayClient.api(query, { variables, apiVersion: '2026-10' });
  } catch (e) {
    const errs = e?.data?.errors || e?.errors || (e?.data?.error_message ? [{ message: e.data.error_message }] : null);
    throw Object.assign(new Error(errs ? errs.map((x) => x.message).join('; ') : String(e?.message || e)), { cause: { errors: errs || [] } });
  }
  if (res?.errors?.length) throw Object.assign(new Error(res.errors.map((x) => x.message).join('; ')), { cause: { errors: res.errors } });
  if (res?.error_message) throw Object.assign(new Error(res.error_message), { cause: { errors: [{ message: res.error_message }] } });
  return res?.data;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fragmento comum de column_values (texto, valor bruto, relação, dropdown, checkbox, espelho)
export const CV_FIELDS = `id text value
  ... on BoardRelationValue { linked_item_ids }
  ... on DropdownValue { values { id label } }
  ... on CheckboxValue { checked }
  ... on MirrorValue { display_value }`;

/** Retorna o tempo de espera (ms) se o erro for de limite de uso da API; null caso contrário. */
function rateLimitDelay(err) {
  const errs = err?.cause?.errors || [];
  const ext = errs[0]?.extensions || {};
  const blob = `${err?.message || ''} ${errs.map((e) => e.message).join(' ')} ${JSON.stringify(ext)}`;
  if (!/complexity|rate.?limit|too many|429|concurrency|budget|minute limit/i.test(blob)) return null;
  const secs = ext.retry_in_seconds ?? blob.match(/(\d+)\s*(seconds|segundos)/i)?.[1];
  return Math.min(60, Math.max(2, Number(secs) || 10)) * 1000 + 500;
}

export function isRateLimit(err) {
  return rateLimitDelay(err) !== null;
}

/** Executa GraphQL com o login de quem está usando o app, com novas tentativas em limite de uso. */
export async function gql(query, variables = {}, attempts = 5) {
  for (let i = 0; ; i++) {
    try {
      return await execGql(query, variables);
    } catch (err) {
      const wait = rateLimitDelay(err);
      if (wait === null || i >= attempts - 1) throw err;
      await sleep(wait);
    }
  }
}

export function errorMessage(err) {
  const errs = err?.cause?.errors;
  if (Array.isArray(errs) && errs.length) return errs.map((e) => e.message).join('; ');
  return String(err?.message || err).replace(/^Monday API request failed[^:]*:\s*/, '');
}

function normalize(item) {
  const cols = {};
  (item.column_values || []).forEach((cv) => { cols[cv.id] = cv; });
  return { id: String(item.id), name: item.name || '', cols };
}

/** Lê TODOS os itens de um board (items_page 500 + next_items_page), com pausas entre páginas. */
export async function fetchAllItems(boardId, columnIds, queryParams = null) {
  const first = queryParams
    ? await gql(
      `query ($b: [ID!], $c: [String!], $qp: ItemsQuery) { boards(ids: $b) { items_page(limit: 500, query_params: $qp) { cursor items { id name column_values(ids: $c) { ${CV_FIELDS} } } } } }`,
      { b: [String(boardId)], c: columnIds, qp: queryParams }
    )
    : await gql(
      `query ($b: [ID!], $c: [String!]) { boards(ids: $b) { items_page(limit: 500) { cursor items { id name column_values(ids: $c) { ${CV_FIELDS} } } } } }`,
      { b: [String(boardId)], c: columnIds }
    );
  const page = first?.boards?.[0]?.items_page;
  if (!page) throw new Error(`Não foi possível ler o board ${boardId} (sem acesso ou board inexistente).`);
  const items = page.items.map(normalize);
  let cursor = page.cursor;
  while (cursor) {
    await sleep(250);
    const next = await gql(
      `query ($cur: String!, $c: [String!]) { next_items_page(limit: 500, cursor: $cur) { cursor items { id name column_values(ids: $c) { ${CV_FIELDS} } } } }`,
      { cur: cursor, c: columnIds }
    );
    items.push(...(next?.next_items_page?.items || []).map(normalize));
    cursor = next?.next_items_page?.cursor || null;
  }
  return items;
}

/** Lê itens específicos por id (lotes de 100). */
export async function fetchItemsByIds(ids, columnIds) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await gql(
      `query ($ids: [ID!], $c: [String!]) { items(ids: $ids) { id name column_values(ids: $c) { ${CV_FIELDS} } } }`,
      { ids: chunk.map(String), c: columnIds }
    );
    out.push(...(res?.items || []).map(normalize));
    if (i + 100 < ids.length) await sleep(250);
  }
  return out;
}

// Leitura de valores
export const txt = (cv) => String(cv?.text ?? cv?.display_value ?? '');
export const isChecked = (cv) => cv?.checked === true || txt(cv).trim() === 'v';
export const dropdownLabels = (cv) => {
  if (Array.isArray(cv?.values)) return cv.values.map((v) => v.label).filter((l) => l != null && l !== '');
  const t = txt(cv).trim();
  return t ? [t] : [];
};
export const linkedIds = (cv) => {
  if (Array.isArray(cv?.linked_item_ids)) return cv.linked_item_ids.map(String);
  try {
    const v = JSON.parse(cv?.value || 'null');
    return (v?.linkedPulseIds || []).map((x) => String(x.linkedPulseId));
  } catch {
    return [];
  }
};

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
