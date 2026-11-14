import { gql, fetchAllItems, linkedIds, isRateLimit, CV_FIELDS } from '@generated/lib/monday';
import { B_RISCOS } from '@generated/lib/engineData';

/** Itens do 09.4 sem projeto vinculado (rel_projeto vazio), com paginação completa por cursor. */
export async function fetchOrphans() {
  let items;
  try {
    items = await fetchAllItems(B_RISCOS, ['rel_proj'], {
      rules: [{ column_id: 'rel_proj', compare_value: [], operator: 'is_empty' }],
    });
  } catch (err) {
    if (isRateLimit(err)) throw err;
    console.error('Filtro "vazio" não aceito; lendo o 09.4 completo:', err);
    items = await fetchAllItems(B_RISCOS, ['rel_proj']);
  }
  // Conferência local: só conta como órfão quem realmente não tem nenhum projeto ligado
  return items.filter((it) => linkedIds(it.cols.rel_proj).length === 0).map((it) => ({ id: it.id, name: it.name }));
}

/** Relê o item imediatamente antes de apagar. true = continua sem projeto. null = item não existe mais. */
export async function isStillOrphan(itemId) {
  const res = await gql(
    `query ($ids: [ID!]) { items(ids: $ids) { id board { id } column_values(ids: ["rel_projeto"]) { ${CV_FIELDS} } } }`,
    { ids: [String(itemId)] }
  );
  const it = res?.items?.[0];
  if (!it) return null;
  if (String(it.board?.id) !== String(B_RISCOS)) return false; // segurança: só apaga itens do 09.4
  return linkedIds(it.column_values?.[0]).length === 0;
}

/** Apaga vários itens numa única requisição (aliases d0, d1, …). */
export async function deleteBatch(ids, attempts = 5) {
  const body = ids.map((id, i) => `d${i}: delete_item(item_id: ${Number(id)}) { id }`).join(' ');
  await gql(`mutation { ${body} }`, {}, attempts);
}

/** Dos ids informados, devolve os que ainda existem. */
export async function existingIds(ids) {
  const res = await gql('query ($ids: [ID!]) { items(ids: $ids) { id } }', { ids: ids.map(String) });
  return new Set((res?.items || []).map((it) => String(it.id)));
}

export async function deleteItem(itemId) {
  await gql('mutation ($i: ID!) { delete_item(item_id: $i) { id } }', { i: String(itemId) });
}
