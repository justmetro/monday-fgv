import { respostaMonday } from '../../../server/monday';
// Chamadas à API do monday para a aba "Atualizar Painel" (somente servidor).
// O token nunca é registrado em logs nem devolvido ao navegador.
import { parseDateFlexible, toISODate } from '@generated/lib/dates';

export const MONDAY_CALL_TIMEOUT_MS = 25_000;

// Tipos de coluna que aceitam gravação a partir do texto do CSV
export const WRITABLE_COLUMN_TYPES = ['text', 'long_text', 'numbers', 'email', 'link', 'date', 'status', 'dropdown'] as const;

export function isWritableType(type: string): boolean {
  return (WRITABLE_COLUMN_TYPES as readonly string[]).includes(type);
}

export type MondayCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; retryable: boolean; message: string };

function scrub(message: string, token: string): string {
  let out = message || 'Erro desconhecido na API do monday.';
  if (token) out = out.split(token).join('[token]');
  return out.slice(0, 500);
}

/** Uma única tentativa, com timeout de 25s. As novas tentativas são controladas por quem chama. */
export async function mondayCallOnce<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<MondayCallResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MONDAY_CALL_TIMEOUT_MS);
  try {
    const r0 = await respostaMonday(query, variables, { versao: '2024-10', signal: controller.signal });
    const res = { status: r0.status, ok: r0.status < 400, json: async () => r0.json };
    if (res.status === 429) return { ok: false, retryable: true, message: 'Limite de requisições do monday atingido.' };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, retryable: false, message: 'Token inválido ou sem permissão no quadro.' };
    }
    if (res.status >= 500) return { ok: false, retryable: true, message: `Erro temporário do monday (HTTP ${res.status}).` };
    if (!res.ok) return { ok: false, retryable: false, message: `Falha na API do monday (HTTP ${res.status}).` };

    const json = (await res.json()) as {
      data?: T;
      errors?: { message?: string; extensions?: { code?: string } }[];
      error_message?: string;
      error_code?: string;
    };
    const err = json.errors?.[0];
    const errMsg = err?.message || json.error_message;
    if (errMsg) {
      const code = `${err?.extensions?.code ?? ''} ${json.error_code ?? ''} ${errMsg}`.toLowerCase();
      const retryable = /complexity|rate.?limit|too many|internal|timeout|temporar|fetch failed/.test(code);
      return { ok: false, retryable, message: scrub(errMsg, token) };
    }
    if (!json.data) return { ok: false, retryable: true, message: 'Resposta vazia do monday.' };
    return { ok: true, data: json.data };
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    return {
      ok: false,
      retryable: true,
      message: aborted ? 'Tempo limite de 25 segundos excedido.' : 'Falha de conexão com o monday.',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Chamada em lote (várias mutações com aliases) ----------

export const MONDAY_BATCH_TIMEOUT_MS = 60_000;

export type MondayErrorKind =
  | 'timeout' | 'rede' | 'limite_requisicoes' | 'complexidade' | 'tamanho' | 'servidor' | 'autorizacao' | 'valor_coluna' | 'consulta' | 'outro';

/** Erros em que a chamada pode ter sido executada no monday (exigem conferência antes de reenviar). */
export const MAYBE_EXECUTED_KINDS: MondayErrorKind[] = ['timeout', 'rede', 'servidor', 'outro'];
/** Erros que pedem redução do tamanho do lote. */
export const SHRINK_KINDS: MondayErrorKind[] = ['complexidade', 'tamanho', 'limite_requisicoes'];

export function classifyMondayError(text: string, httpStatus?: number): MondayErrorKind {
  const t = text.toLowerCase();
  // Erro de validação da própria consulta (ex.: variável declarada e não usada): não é recuperável, não repetir
  if (/defined on operation|never used|parse error|syntax error|unknown argument|cannot query field|is not defined|expected type|argument .* (is )?required|doesn.t exist on type|graphql validation/.test(t)) return 'consulta';
  if (httpStatus === 429 || /rate.?limit|too many|concurren|retry_in/.test(t)) return 'limite_requisicoes';
  if (/complexity/.test(t)) return 'complexidade';
  if (httpStatus === 413 || /too large|payload|query.?size|max.?size|too long/.test(t)) return 'tamanho';
  if (httpStatus === 401 || httpStatus === 403 || /unauthori|not authenticated|permission/.test(t)) return 'autorizacao';
  if (/columnvalue|column value|invalid value|invalid_column|label|dropdown/.test(t)) return 'valor_coluna';
  if ((httpStatus ?? 0) >= 500 || /internal|temporar|server error/.test(t)) return 'servidor';
  if (/timeout|aborted|tempo limite/.test(t)) return 'timeout';
  if (/fetch failed|econnreset|socket|connection/.test(t)) return 'rede';
  return 'outro';
}

export interface BatchItemInput {
  key: string;
  op: 'create' | 'update';
  itemId?: string; // obrigatório em 'update'
  name: string;
  columnValues: Record<string, unknown>;
}

export interface BatchItemOutcome {
  key: string;
  id?: string;
  error?: string;
  kind?: MondayErrorKind;
}

export type BatchCallResult =
  | { delivered: true; outcomes: BatchItemOutcome[] }
  | { delivered: false; kind: MondayErrorKind; message: string };

/** Uma única chamada GraphQL que cria e/ou atualiza todos os itens do lote (somente no grupo informado). */
export async function mondayUpsertItemsBatch(
  token: string,
  boardId: string,
  groupId: string,
  items: BatchItemInput[]
): Promise<BatchCallResult> {
  if (items.length === 0) return { delivered: true, outcomes: [] };

  const lines: string[] = [];
  // $groupId só existe na chamada quando há criação. Alterar item existente usa só o ID do item
  // (antes a variável era sempre declarada e o monday recusava: "variable: groupId defined on operation: but never used").
  const hasCreate = items.some((it) => it.op === 'create');
  const vars: Record<string, unknown> = hasCreate ? { boardId, groupId } : { boardId };

  items.forEach((it, idx) => {
    const alias = `m_${idx}`;
    const cvVar = `cv_${idx}`;
    vars[cvVar] = JSON.stringify(it.columnValues);
    if (it.op === 'create') {
      const nameVar = `nm_${idx}`;
      vars[nameVar] = it.name;
      lines.push(`${alias}: create_item(board_id: $boardId, group_id: $groupId, item_name: $${nameVar}, column_values: $${cvVar}) { id }`);
    } else {
      const itemVar = `id_${idx}`;
      vars[itemVar] = it.itemId;
      lines.push(`${alias}: change_multiple_column_values(board_id: $boardId, item_id: $${itemVar}, column_values: $${cvVar}) { id }`);
    }
  });

  const varDefs = [
    '$boardId: ID!',
    ...(hasCreate ? ['$groupId: String!'] : []),
    ...items.flatMap((it, idx) => (it.op === 'create' ? [`$nm_${idx}: String!`, `$cv_${idx}: JSON!`] : [`$id_${idx}: ID!`, `$cv_${idx}: JSON!`])),
  ].join(', ');

  const query = `mutation (${varDefs}) { ${lines.join(' ')} }`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MONDAY_BATCH_TIMEOUT_MS);
  try {
    const r0 = await respostaMonday(query, vars, { versao: '2024-10', signal: controller.signal });
    const res = { status: r0.status, ok: r0.status < 400, json: async () => r0.json };
    if (!res.ok && res.status >= 500) {
      return { delivered: false, kind: 'servidor', message: `Erro temporário do monday (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as {
      data?: Record<string, { id?: string } | null>;
      errors?: { message?: string; path?: (string | number)[]; extensions?: { code?: string } }[];
      error_message?: string;
    };
    if (json.error_message && !json.data) {
      return { delivered: false, kind: classifyMondayError(json.error_message, res.status), message: scrub(json.error_message, token) };
    }
    // Erro da chamada inteira (sem item específico): a chamada não foi executada, devolve o erro bruto
    const topLevel = (json.errors ?? []).find((e) => !e.path?.length);
    if (topLevel && (!json.data || Object.values(json.data).every((v) => !v))) {
      const msg = topLevel.message ?? json.error_message ?? 'Erro na chamada ao monday.';
      return { delivered: false, kind: classifyMondayError(msg, res.status), message: scrub(msg, token) };
    }
    const data = json.data ?? {};
    const errMap = new Map<string, string>();
    (json.errors ?? []).forEach((e) => {
      const alias = String(e.path?.[0] ?? '');
      if (alias) errMap.set(alias, e.message ?? 'Erro na operação do item.');
    });

    const outcomes: BatchItemOutcome[] = items.map((it, idx) => {
      const alias = `m_${idx}`;
      const err = errMap.get(alias);
      if (err) return { key: it.key, error: scrub(err, token), kind: classifyMondayError(err) };
      // Só é sucesso se o monday devolveu o item desta operação (criação OU alteração).
      // Antes, alterações sem retorno contavam como sucesso e o erro geral da chamada se perdia.
      const returnedId = data[alias]?.id;
      if (!returnedId) {
        const topErr = json.errors?.[0]?.message;
        const msg = topErr
          ? scrub(topErr, token)
          : it.op === 'create' ? 'Item não criado pela API do monday.' : 'O monday não confirmou a alteração do item.';
        return { key: it.key, error: msg, kind: classifyMondayError(msg) };
      }
      return { key: it.key, id: it.op === 'create' ? returnedId : it.itemId };
    });
    return { delivered: true, outcomes };
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    return {
      delivered: false,
      kind: aborted ? 'timeout' : 'rede',
      message: aborted ? 'Tempo limite de 60 segundos excedido.' : 'Falha de conexão com o monday.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface GroupItemState {
  id: string;
  name: string;
  values: Record<string, { text: string | null; value: string | null }>;
}

const safeId = (id: string) => id.replace(/[^\w-]/g, '');

/** Lê os itens de UM grupo, só com as colunas pedidas. Nunca lê outros grupos. */
export async function mondayReadGroupItems(
  token: string,
  boardId: string,
  groupId: string,
  columnIds: string[]
): Promise<{ ok: true; items: GroupItemState[] } | { ok: false; kind: MondayErrorKind; message: string }> {
  const ids = columnIds.map(safeId).filter(Boolean);
  const colSel = ids.length ? `column_values(ids: [${ids.map((c) => `"${c}"`).join(', ')}]) { id text value }` : '';
  const first = `query ($board: [ID!], $group: [String]) { boards(ids: $board) { groups(ids: $group) { items_page(limit: 500) { cursor items { id name ${colSel} } } } } }`;
  const next = `query ($cursor: String!) { next_items_page(limit: 500, cursor: $cursor) { cursor items { id name ${colSel} } } }`;
  type Page = { cursor: string | null; items: { id: string; name: string; column_values?: { id: string; text: string | null; value: string | null }[] }[] };
  const out: GroupItemState[] = [];
  const push = (p: Page | undefined) =>
    p?.items.forEach((it) => {
      const values: GroupItemState['values'] = {};
      (it.column_values ?? []).forEach((cv) => { values[cv.id] = { text: cv.text, value: cv.value }; });
      out.push({ id: String(it.id), name: it.name, values });
    });

  const r1 = await mondayCallOnce<{ boards: { groups: { items_page: Page }[] }[] }>(token, first, { board: [boardId], group: [groupId] });
  if (!r1.ok) return { ok: false, kind: classifyMondayError(r1.message), message: r1.message };
  let page = r1.data.boards?.[0]?.groups?.[0]?.items_page;
  push(page);
  let guard = 0;
  while (page?.cursor && guard < 60) {
    const r: MondayCallResult<{ next_items_page: Page }> = await mondayCallOnce<{ next_items_page: Page }>(token, next, { cursor: page.cursor });
    if (!r.ok) return { ok: false, kind: classifyMondayError(r.message), message: r.message };
    page = r.data.next_items_page;
    push(page);
    guard++;
  }
  return { ok: true, items: out };
}

/** Lê nome e e-mail dos itens já existentes no grupo (para não duplicar). */
export async function mondayListGroupItems(
  token: string,
  boardId: string,
  groupId: string,
  emailColumnId: string | null
): Promise<{ ok: true; items: { name: string; email: string }[] } | { ok: false; kind: MondayErrorKind; message: string }> {
  const res = await mondayReadGroupItems(token, boardId, groupId, emailColumnId ? [emailColumnId] : []);
  if (!res.ok) return res;
  return {
    ok: true,
    items: res.items.map((it) => ({ name: it.name, email: emailColumnId ? it.values[safeId(emailColumnId)]?.text ?? '' : '' })),
  };
}

/** Confere em qual grupo cada item está (para nunca atualizar itens de outras semanas). */
export async function mondayItemGroups(
  token: string,
  itemIds: string[]
): Promise<{ ok: true; groups: Map<string, string> } | { ok: false; kind: MondayErrorKind; message: string }> {
  const res = await mondayCallOnce<{ items: { id: string; group: { id: string } | null }[] }>(
    token,
    `query ($ids: [ID!]) { items(ids: $ids, limit: 100) { id group { id } } }`,
    { ids: itemIds }
  );
  if (!res.ok) return { ok: false, kind: classifyMondayError(res.message), message: res.message };
  const groups = new Map<string, string>();
  (res.data.items ?? []).forEach((it) => { if (it.group?.id) groups.set(String(it.id), it.group.id); });
  return { ok: true, groups };
}

/** Converte o texto do CSV no formato de gravação da coluna. Retorna null quando não dá para gravar. */
export function toColumnValue(type: string, raw: string): unknown | null {
  const v = raw.trim();
  if (!v) return null;
  switch (type) {
    case 'text':
      return v;
    case 'long_text':
      return { text: v };
    case 'numbers': {
      const n = v.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
      return /^-?\d+(\.\d+)?$/.test(n) ? n : null;
    }
    case 'email': {
      const email = v.match(/[^\s<>"',;]+@[^\s<>"',;]+/)?.[0];
      return email ? { email, text: email } : null;
    }
    case 'link':
      return { url: v, text: v };
    case 'date': {
      const d = parseDateFlexible(v);
      return d ? { date: toISODate(d) } : null;
    }
    case 'status':
      return { label: v };
    case 'dropdown': {
      const labels = v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      return labels.length ? { labels } : null;
    }
    case 'checkbox':
      // Formato aceito pelo monday para marcar a caixa (antes este caso não existia e o check era descartado)
      return /^(true|1|sim|v|x)$/i.test(v) ? { checked: 'true' } : null;
    default:
      return null;
  }
}

