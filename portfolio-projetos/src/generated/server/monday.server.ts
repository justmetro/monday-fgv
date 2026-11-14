import getServerApiClient from '@api/api-client.server';
import type { ColumnInfo, GroupInfo } from '@generated/lib/fields';
import { AccessError, toAccessError } from './access-errors.server';
import { currentUserToken, requestWithToken } from './user-token.server';

/**
 * Todas as consultas usam getServerApiClient(): no modo do app publicado (internal/private) ele envia a
 * sessão do usuário atual (token vindo da Monday) ao proxy vibe-auth, que decide o escopo de acesso.
 * Falhas são convertidas em AccessError classificada (sem tokens).
 */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  try {
    // Token pessoal do próprio usuário (se cadastrado) → acesso exatamente igual ao dele na Monday.
    const token = await currentUserToken();
    if (token) return (await requestWithToken(token, query, variables)) as T;
    const api = await getServerApiClient();
    const res = await api.client.request(query, variables);
    return res as T;
  } catch (e) {
    const err = toAccessError(e);
    console.error('[monday] consulta falhou', { kind: err.kind, code: err.code, status: err.status, msg: err.platformMessage });
    throw err;
  }
}

export async function fetchWorkspaces(): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await gql<{ workspaces: { id: string; name: string }[] }>(
      `query($p:Int!){ workspaces(limit:100, page:$p, state:active){ id name } }`,
      { p: page },
    );
    out.push(...(r.workspaces ?? []));
    if ((r.workspaces ?? []).length < 100) break;
  }
  return out;
}

export async function fetchBoards(workspaceId: string): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await gql<{ boards: { id: string; name: string; type: string }[] }>(
      `query($w:[ID!],$p:Int!){ boards(workspace_ids:$w, limit:100, page:$p, state:active){ id name type } }`,
      { w: [workspaceId], p: page },
    );
    const b = r.boards ?? [];
    out.push(...b.filter((x) => x.type === 'board').map((x) => ({ id: x.id, name: x.name })));
    if (b.length < 100) break;
  }
  return out;
}

export type BoardStructure = {
  id: string;
  name: string;
  url: string;
  workspaceId: string;
  workspaceName: string;
  groups: GroupInfo[];
  columns: ColumnInfo[];
  /** Quadro de subitens (via coluna do tipo subtasks) e suas colunas próprias. */
  subitemBoardId: string | null;
  subitemColumns: ColumnInfo[];
};

type RawCol = { id: string; title: string; type: string; settings_str: string };
function toColumn(c: RawCol): ColumnInfo {
  let labels: string[] = [];
  try {
    const s = JSON.parse(c.settings_str || '{}') as { labels?: Record<string, string> | { label?: string; name?: string }[] };
    if (Array.isArray(s.labels)) labels = s.labels.map((l) => l.label ?? l.name ?? '').filter(Boolean);
    else if (s.labels) labels = Object.values(s.labels).filter(Boolean);
  } catch { /* sem labels */ }
  return { id: c.id, title: c.title, type: c.type, labels };
}

async function fetchSubitemStructure(cols: RawCol[]): Promise<{ id: string | null; columns: ColumnInfo[] }> {
  const sub = cols.find((c) => c.type === 'subtasks');
  if (!sub) return { id: null, columns: [] };
  let id: string | null = null;
  try {
    const s = JSON.parse(sub.settings_str || '{}') as { boardIds?: (string | number)[] };
    id = s.boardIds?.[0] != null ? String(s.boardIds[0]) : null;
  } catch { /* sem configuração */ }
  if (!id) return { id: null, columns: [] };
  const r = await gql<{ boards: { columns: RawCol[] }[] }>(`query($b:[ID!]){ boards(ids:$b){ columns{ id title type settings_str } } }`, { b: [id] });
  return { id, columns: (r.boards?.[0]?.columns ?? []).map(toColumn) };
}

export async function fetchBoardStructure(boardId: string): Promise<BoardStructure> {
  const r = await gql<{
    boards: {
      id: string; name: string; url: string;
      workspace: { id: string; name: string } | null;
      groups: GroupInfo[];
      columns: { id: string; title: string; type: string; settings_str: string }[];
    }[];
  }>(
    `query($b:[ID!]){ boards(ids:$b){ id name url workspace{ id name } groups{ id title } columns{ id title type settings_str } } }`,
    { b: [boardId] },
  );
  const b = r.boards?.[0];
  if (!b) throw new AccessError('not_returned', null, null, 'Resposta vazia: o quadro não foi retornado pela consulta.');
  // Estrutura dos subelementos é complementar: uma falha aqui não impede a leitura do quadro.
  const sub = await fetchSubitemStructure(b.columns ?? []).catch((e: unknown) => {
    console.error('[monday] estrutura de subelementos indisponível', e);
    return { id: null, columns: [] as ColumnInfo[] };
  });
  return {
    id: b.id, name: b.name, url: b.url,
    workspaceId: b.workspace?.id ?? '', workspaceName: b.workspace?.name ?? 'Área principal',
    groups: b.groups ?? [],
    columns: (b.columns ?? []).map(toColumn),
    subitemBoardId: sub.id,
    subitemColumns: sub.columns,
  };
}

export type RawCV = {
  id: string; type: string; text: string | null;
  display_value?: string | null; linked_item_ids?: string[];
  url?: string | null; url_text?: string | null; date?: string | null;
  from?: string | null; to?: string | null;
};
export type RawItem = { id: string; name: string; column_values: RawCV[]; subitems?: RawItem[] | null };

const ITEM_FIELDS = `id name column_values(ids:$c){ id type text
  ... on FormulaValue { display_value }
  ... on MirrorValue { display_value }
  ... on BoardRelationValue { linked_item_ids display_value }
  ... on DependencyValue { linked_item_ids display_value }
  ... on LinkValue { url url_text }
  ... on DateValue { date }
  ... on TimelineValue { from to } }`;

const SUB_FIELDS = ITEM_FIELDS.replace('column_values(ids:$c)', 'column_values(ids:$sc)');

/**
 * Lê TODOS os itens de um grupo, seguindo a paginação. Qualquer falha propaga (sem leitura parcial).
 * Com subitemColumnIds, lê também os subelementos de cada item (colunas do quadro de subitens).
 */
export async function fetchGroupItems(boardId: string, groupId: string, columnIds: string[], subitemColumnIds?: string[], maxParents?: number): Promise<RawItem[]> {
  // 1) Lista leve de IDs do grupo (paginação sequencial, sem colunas — rápida).
  const all = await listGroupItemIds(boardId, groupId);
  const ids = maxParents ? all.slice(0, maxParents) : all;
  // 2) Detalhes em lotes paralelos (a leitura de colunas calculadas é o que pesa).
  //    Sem colunas pedidas (leitura só de subelementos), não relê os itens-pai.
  const items = columnIds.length ? await fetchItemsByIds(ids, columnIds, ITEM_FIELDS, 'c') : ids.map((id) => ({ id, name: '', column_values: [] }));
  if (!subitemColumnIds) return items;
  const byParent = await fetchSubitemsOf(ids, subitemColumnIds);
  return items.map((it) => ({ ...it, subitems: byParent.get(String(it.id)) ?? [] }));
}

/** Subelementos dos itens indicados: IDs por item-pai (leve) e depois detalhes em lotes paralelos. */
export async function fetchSubitemsOf(ids: string[], subitemColumnIds: string[]): Promise<Map<string, RawItem[]>> {
  const sc = subitemColumnIds.length ? subitemColumnIds : ['name'];
  const parentOf = new Map<string, string>();
  await pool(chunk(ids, 100), async (part) => {
    const r = await gql<{ items: { id: string; subitems: { id: string }[] | null }[] }>(
      `query($i:[ID!]){ items(ids:$i, limit:100){ id subitems{ id } } }`, { i: part },
    );
    (r.items ?? []).forEach((it) => (it.subitems ?? []).forEach((s) => parentOf.set(String(s.id), String(it.id))));
  });
  const subs = await fetchItemsByIds([...parentOf.keys()], sc, SUB_FIELDS, 'sc');
  const byParent = new Map<string, RawItem[]>();
  subs.forEach((s) => { const p = parentOf.get(String(s.id)); if (p) byParent.set(p, [...(byParent.get(p) ?? []), s]); });
  return byParent;
}

const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** Executa tarefas com concorrência limitada. Qualquer falha propaga (sem leitura parcial). */
async function pool<T>(tasks: T[], fn: (t: T) => Promise<void>, size = 6) {
  let i = 0;
  const worker = async () => { while (i < tasks.length) { const t = tasks[i++]; if (t !== undefined) await fn(t); } };
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
}

export async function listGroupItemIds(boardId: string, groupId: string): Promise<string[]> {
  const first = await gql<{ boards: { groups: { items_page: { cursor: string | null; items: { id: string }[] } }[] }[] }>(
    `query($b:[ID!],$g:[String]){ boards(ids:$b){ groups(ids:$g){ items_page(limit:500){ cursor items{ id } } } } }`,
    { b: [boardId], g: [groupId] },
  );
  const group = first.boards?.[0]?.groups?.[0];
  if (!group) throw new Error(`Grupo ${groupId} não encontrado no quadro.`);
  const ids = (group.items_page.items ?? []).map((x) => String(x.id));
  let cursor = group.items_page.cursor;
  let guard = 0;
  while (cursor && guard++ < 200) {
    const next = await gql<{ next_items_page: { cursor: string | null; items: { id: string }[] } }>(
      `query($cur:String!){ next_items_page(limit:500, cursor:$cur){ cursor items{ id } } }`, { cur: cursor },
    );
    ids.push(...(next.next_items_page?.items ?? []).map((x) => String(x.id)));
    cursor = next.next_items_page?.cursor ?? null;
  }
  return ids;
}

/** Lê itens por ID em lotes de 50, até 6 consultas simultâneas; devolve na ordem original. */
async function fetchItemsByIds(ids: string[], cols: string[], fields: string, colVar: 'c' | 'sc'): Promise<RawItem[]> {
  const got = new Map<string, RawItem>();
  await pool(chunk(ids, 50), async (part) => {
    const r = await gql<{ items: RawItem[] }>(
      `query($i:[ID!],$${colVar}:[String!]){ items(ids:$i, limit:50){ ${fields} } }`, { i: part, [colVar]: cols },
    );
    (r.items ?? []).forEach((it) => got.set(String(it.id), it));
  });
  return ids.map((id) => got.get(id)).filter((x): x is RawItem => !!x);
}

/** IDs de quadros que o usuário atual consegue acessar. */
export async function fetchAccessibleBoardIds(ids: string[]): Promise<Set<string>> {
  const ok = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await gql<{ boards: { id: string }[] }>(`query($b:[ID!]){ boards(ids:$b, limit:100){ id } }`, { b: ids.slice(i, i + 100) });
    (r.boards ?? []).forEach((b) => ok.add(String(b.id)));
  }
  return ok;
}
