// Comunicação dos projetos: updates e respostas por workspace de projeto, na mesma semana do engajamento
// (domingo a sábado) e com o mesmo número ("Semana N") usado no quadro Análise de Engajamento.
import { gql } from './monday';
import { mongo } from './mongo';

export const COMM_BOARD_ID = (process.env.COMM_BOARD_ID || '18439727709').trim();
export const COMM_COLLECTION = 'comm_weeks_v2';
const PROJECT_RE = /^\s*(\d{4}\/\d{3})/;

export interface CommWeekRow {
  _id: string; // weekStart|workspaceId
  weekStart: string; // domingo, AAAA-MM-DD
  weekEnd: string; // sábado
  week: string; // "Semana N"
  weekNumber: number;
  workspaceId: string;
  project: string;
  code: string; // AAAA/NNN
  updates: number;
  replies: number;
  total: number;
  authors: number;
  members: number;
  msgsPerMember: number;
  computedAt: string;
}

// ---------- datas ----------
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(at(s).getTime() + n * 86400000));
export const sundayOf = (s: string) => addDays(s, -at(s).getUTCDay());
export const brDate = (s: string) => s.split('-').reverse().join('/');
/** Hoje em Brasília (UTC-3). */
const todayBR = () => iso(new Date(Date.now() - 3 * 3600000));
/** Domingo da última semana completa (domingo a sábado). */
export const lastCompleteWeek = () => addDays(sundayOf(todayBR()), -7);

// ---------- número da semana ----------
interface WeekStatus { group?: string; weekStart?: string; weekEnd?: string }
const numOf = (g?: string) => Number((g ?? '').match(/(\d+)/)?.[1] ?? NaN);

/**
 * Número da semana igual ao do engajamento: usa o grupo "Semana N" da Base cujo período cobre a semana.
 * Sem grupo para a semana, conta as semanas a partir do grupo com período mais próximo.
 */
export async function weekNumberFor(weekStart: string): Promise<{ n: number; source: 'engajamento' | 'calculado' }> {
  const docs = (await (await mongo()).collection<WeekStatus>('base_week_status').find({}, { projection: { group: 1, weekStart: 1, weekEnd: 1 } }).toArray())
    .filter((d) => d.weekStart && d.weekEnd && Number.isFinite(numOf(d.group)));
  const mid = addDays(weekStart, 3);
  const hits = docs.filter((d) => d.weekStart! <= mid && mid <= d.weekEnd!);
  if (hits.length) return { n: Math.max(...hits.map((d) => numOf(d.group))), source: 'engajamento' };
  if (!docs.length) throw new Error('A Base do engajamento não tem semanas com período definido para numerar a semana.');
  // Âncora: semana registrada mais próxima (em caso de empate, o maior número)
  const dist = (d: WeekStatus) => Math.abs(at(sundayOf(d.weekStart!)).getTime() - at(weekStart).getTime());
  const anchor = docs.sort((a, b) => dist(a) - dist(b) || numOf(b.group) - numOf(a.group))[0];
  const diff = Math.round((at(weekStart).getTime() - at(sundayOf(anchor.weekStart!)).getTime()) / (7 * 86400000));
  return { n: numOf(anchor.group) + diff, source: 'calculado' };
}

// ---------- leitura no monday ----------
async function projectWorkspaces(): Promise<{ id: string; name: string; code: string; members: number }[]> {
  const out: { id: string; name: string; code: string; members: number }[] = [];
  for (let page = 1; page < 50; page++) {
    const r = await gql<{ workspaces: { id: string; name: string; state?: string; users_subscribers?: { id: string }[] }[] }>(
      'query ($p: Int!) { workspaces(limit: 100, page: $p, state: active) { id name users_subscribers(limit: 500) { id } } }', { p: page });
    r.workspaces.forEach((w) => {
      const m = w.name.match(PROJECT_RE);
      if (m) out.push({ id: String(w.id), name: w.name.trim(), code: m[1], members: w.users_subscribers?.length ?? 0 });
    });
    if (r.workspaces.length < 100) break;
  }
  return out;
}

/** Quadros (e quadros de subitens) de cada workspace. */
async function boardsByWorkspace(wsIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, Set<string>>();
  for (let i = 0; i < wsIds.length; i += 10) {
    const chunk = wsIds.slice(i, i + 10);
    for (let page = 1; page < 100; page++) {
      const r = await gql<{ boards: { id: string; workspace_id: string | null; columns: { settings_str: string }[] }[] }>(
        'query ($w: [ID], $p: Int!) { boards(workspace_ids: $w, limit: 100, page: $p, state: active) { id workspace_id columns(types: [subtasks]) { settings_str } } }',
        { w: chunk, p: page });
      r.boards.forEach((b) => {
        const ws = String(b.workspace_id ?? '');
        if (!ws) return;
        const set = map.get(ws) ?? new Set<string>();
        set.add(String(b.id));
        b.columns.forEach((c) => {
          try { (JSON.parse(c.settings_str || '{}').boardIds ?? []).forEach((id: unknown) => set.add(String(id))); } catch { /* sem subitens */ }
        });
        map.set(ws, set);
      });
      if (r.boards.length < 100) break;
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

/** Updates por quadro com filtro de data no próprio quadro (a consulta da raiz repete itens entre páginas). */
async function updatesByBoard(boardIds: string[], from: string, to: string): Promise<Map<string, { id: string; creator_id: string | null }[]>> {
  const out = new Map<string, Map<string, string | null>>();
  for (let i = 0; i < boardIds.length; i += 25) {
    let pending = boardIds.slice(i, i + 25);
    for (let page = 1; pending.length && page < 200; page++) {
      const r = await gql<{ boards: { id: string; updates: { id: string; creator_id: string | null }[] }[] }>(
        'query ($b: [ID!], $p: Int!, $f: ISO8601DateTime, $t: ISO8601DateTime) { boards(ids: $b, limit: 100) { id updates(limit: 100, page: $p, from_date: $f, to_date: $t) { id creator_id } } }',
        { b: pending, p: page, f: from, t: to });
      const next: string[] = [];
      r.boards.forEach((b) => {
        const m = out.get(String(b.id)) ?? new Map<string, string | null>();
        b.updates.forEach((u) => m.set(String(u.id), u.creator_id ? String(u.creator_id) : null));
        out.set(String(b.id), m);
        if (b.updates.length === 100) next.push(String(b.id));
      });
      pending = next;
    }
  }
  return new Map([...out].map(([k, m]) => [k, [...m].map(([id, creator_id]) => ({ id, creator_id }))]));
}

async function repliesOf(boardIds: string[], from: string, to: string): Promise<{ id: string; creator_id: string | null }[]> {
  const seen = new Map<string, string | null>();
  for (let i = 0; i < boardIds.length; i += 100) {
    const b = boardIds.slice(i, i + 100);
    for (let page = 1; page < 200; page++) {
      const r = await gql<{ replies: { id: string; creator_id: string | null }[] }>(
        'query ($b: [ID!]!, $f: String!, $t: String!, $p: Int!) { replies(board_ids: $b, created_at_from: $f, created_at_to: $t, limit: 100, page: $p) { id creator_id } }',
        { b, f: from, t: to, p: page });
      const before = seen.size;
      r.replies.forEach((x) => seen.set(String(x.id), x.creator_id ? String(x.creator_id) : null));
      if (r.replies.length < 100 || seen.size === before) break;
    }
  }
  return [...seen].map(([id, creator_id]) => ({ id, creator_id }));
}

// ---------- consolidação ----------
export async function consolidateWeek(weekStartArg?: string): Promise<{ week: string; weekStart: string; weekEnd: string; numberSource: string; projects: number; updates: number; replies: number; board: { created: number; updated: number } }> {
  const weekStart = sundayOf(weekStartArg || lastCompleteWeek());
  const weekEnd = addDays(weekStart, 6);
  const { n, source } = await weekNumberFor(weekStart);
  const week = `Semana ${n}`;
  // Limites em Brasília (UTC-3)
  const from = `${weekStart}T03:00:00Z`;
  const to = `${addDays(weekEnd, 1)}T02:59:59Z`;

  const wss = await projectWorkspaces();
  const boards = await boardsByWorkspace(wss.map((w) => w.id));
  const allBoards = [...new Set([...boards.values()].flat())];
  const ups = await updatesByBoard(allBoards, from, to);

  const computedAt = new Date().toISOString();
  const rows: CommWeekRow[] = [];
  for (const w of wss) {
    const bids = boards.get(w.id) ?? [];
    const u = bids.flatMap((b) => ups.get(b) ?? []);
    const uniq = new Map(u.map((x) => [x.id, x.creator_id]));
    const reps = bids.length ? await repliesOf(bids, from.replace('Z', '+00:00'), to.replace('Z', '+00:00')) : [];
    const authors = new Set([...uniq.values(), ...reps.map((r) => r.creator_id)].filter(Boolean));
    const total = uniq.size + reps.length;
    rows.push({
      _id: `${weekStart}|${w.id}`, weekStart, weekEnd, week, weekNumber: n, workspaceId: w.id, project: w.name, code: w.code,
      updates: uniq.size, replies: reps.length, total, authors: authors.size, members: w.members,
      msgsPerMember: w.members ? Math.round((total / w.members) * 100) / 100 : 0, computedAt,
    });
  }

  const col = (await mongo()).collection<CommWeekRow>(COMM_COLLECTION);
  // A semana é refeita por inteiro: remove linhas antigas da mesma semana
  await col.deleteMany({ weekStart });
  if (rows.length) await col.insertMany(rows);
  await (await mongo()).collection('comm_runs').insertOne({ at: computedAt, week, weekStart } as never);

  const board = COMM_BOARD_ID === '0' ? { created: 0, updated: 0 } : await writeToBoard(rows, week, weekStart, weekEnd);
  return {
    week, weekStart, weekEnd, numberSource: source, projects: rows.length,
    updates: rows.reduce((s, r) => s + r.updates, 0), replies: rows.reduce((s, r) => s + r.replies, 0), board,
  };
}

async function writeToBoard(rows: CommWeekRow[], week: string, weekStart: string, weekEnd: string): Promise<{ created: number; updated: number }> {
  const title = `${week} · ${brDate(weekStart)} a ${brDate(weekEnd)}`;
  const g = await gql<{ boards: { groups: { id: string; title: string }[] }[] }>('query ($b: [ID!]) { boards(ids: $b) { groups { id title } } }', { b: [COMM_BOARD_ID] });
  const groups = g.boards[0]?.groups ?? [];
  let groupId = groups.find((x) => x.title === title || x.title.startsWith(`${week} ·`))?.id;
  if (!groupId) {
    const c = await gql<{ create_group: { id: string } }>('mutation ($b: ID!, $t: String!) { create_group(board_id: $b, group_name: $t, position_relative_method: before_at, relative_to: null) { id } }', { b: COMM_BOARD_ID, t: title })
      .catch(() => gql<{ create_group: { id: string } }>('mutation ($b: ID!, $t: String!) { create_group(board_id: $b, group_name: $t) { id } }', { b: COMM_BOARD_ID, t: title }));
    groupId = c.create_group.id;
  } else {
    const cur = groups.find((x) => x.id === groupId);
    if (cur && cur.title !== title) await gql('mutation ($b: ID!, $g: String!, $v: String!) { update_group(board_id: $b, group_id: $g, group_attribute: title, new_value: $v) { id } }', { b: COMM_BOARD_ID, g: groupId, v: title });
  }

  // Itens já existentes da semana, pela chave
  const existing = new Map<string, string>();
  let cursor: string | null = null;
  do {
    const r: { boards?: { groups: { items_page: { cursor: string | null; items: { id: string; column_values: { text: string }[] }[] } }[] }[]; next_items_page?: { cursor: string | null; items: { id: string; column_values: { text: string }[] }[] } } = cursor
      ? await gql('query ($c: String!) { next_items_page(cursor: $c, limit: 200) { cursor items { id column_values(ids: ["chave"]) { text } } } }', { c: cursor })
      : await gql('query ($b: [ID!], $g: [String]) { boards(ids: $b) { groups(ids: $g) { items_page(limit: 200) { cursor items { id column_values(ids: ["chave"]) { text } } } } } }', { b: [COMM_BOARD_ID], g: [groupId] });
    const page: { cursor: string | null; items: { id: string; column_values: { text: string }[] }[] } = cursor ? r.next_items_page! : r.boards![0].groups[0].items_page;
    page.items.forEach((it) => existing.set(it.column_values[0]?.text ?? '', String(it.id)));
    cursor = page.cursor;
  } while (cursor);

  let created = 0, updated = 0;
  for (const r of rows) {
    const vals = JSON.stringify({
      semana: week, inicio: { date: r.weekStart }, updates: r.updates, respostas: r.replies, total_msgs: r.total,
      autores: r.authors, membros: r.members, msgs_membro: r.msgsPerMember, fonte_equipe: 'Assinantes do workspace',
      workspace_id: r.workspaceId, chave: r._id,
    });
    const id = existing.get(r._id);
    if (id) {
      await gql('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', { b: COMM_BOARD_ID, i: id, v: vals });
      updated++;
    } else {
      await gql('mutation ($b: ID!, $g: String!, $n: String!, $v: JSON!) { create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $v) { id } }', { b: COMM_BOARD_ID, g: groupId, n: r.project.slice(0, 250), v: vals });
      created++;
    }
  }
  return { created, updated };
}
