// Atualizações por usuário por semana (APUS), lidas do quadro "Relatórios dos projetos - Monday"
// (grupo "Equipes - Por Semana"), o mesmo usado nos gráficos do quadro. Cada item é um projeto numa semana,
// com o total acumulado de atualizações e o número de usuários.
import { gql } from './monday';
import { mongo } from './mongo';

export const APUS_BOARD_ID = (process.env.APUS_BOARD_ID || '18420326098').trim();
const WEEKS_GROUP = 'group_mkzj2gt8'; // Equipes - Por Semana
const PROJECTS_GROUP = 'group_mm3a6mqg'; // Projetos
const CACHE_MIN = 30;

export interface ApusRow {
  team: string; // nome do item (equipe do projeto)
  project: string; // projeto conectado
  code: string; // AAAA/NNN do projeto conectado
  managers: string[]; // Gerente Real
  weekNumber: number;
  weekLabel: string; // "39 Sem 15/11 a 21/11"
  updates: number; // N° atualizações (acumulado)
  users: number; // Usuários totais
  weeksOnPlatform: number | null;
  apus: number | null; // (atualizações ÷ usuários) ÷ semanas na plataforma, igual à fórmula do quadro
}

export interface ApusData {
  rows: ApusRow[];
  weeks: { weekNumber: number; weekLabel: string }[]; // mais recente primeiro
  boardId: string;
  readAt: string;
}

type Cv = { id: string; text: string | null; display_value?: string; linked_item_ids?: string[] };
type Item = { id: string; name: string; column_values: Cv[] };

async function readGroup(group: string, cols: string[]): Promise<Item[]> {
  const fields = '{ id name column_values(ids: $c) { id text ... on FormulaValue { display_value } ... on MirrorValue { display_value } ... on BoardRelationValue { linked_item_ids } } }';
  const out: Item[] = [];
  const first = await gql<{ boards: { groups: { items_page: { cursor: string | null; items: Item[] } }[] }[] }>(
    `query ($b: [ID!], $g: [String], $c: [String!]) { boards(ids: $b) { groups(ids: $g) { items_page(limit: 500) { cursor items ${fields} } } } }`,
    { b: [APUS_BOARD_ID], g: [group], c: cols });
  let page = first.boards[0]?.groups[0]?.items_page;
  while (page) {
    out.push(...page.items);
    if (!page.cursor) break;
    const r = await gql<{ next_items_page: { cursor: string | null; items: Item[] } }>(
      `query ($k: String!, $c: [String!]) { next_items_page(cursor: $k, limit: 500) { cursor items ${fields} } }`, { k: page.cursor, c: cols });
    page = r.next_items_page;
  }
  return out;
}

const n = (v: string | null | undefined) => {
  if (v === null || v === undefined || String(v).trim() === '' || v === 'null') return null;
  const x = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};

async function readBoard(): Promise<ApusData> {
  const [projects, items] = await Promise.all([
    readGroup(PROJECTS_GROUP, ['text_mkyg1502']),
    readGroup(WEEKS_GROUP, ['color_mm4wwfr5', 'numeric_mm4w7f8e', 'numeric_mm4wrmjz', 'lookup_mm4xdrwf', 'formula_mm4xx5rq', 'board_relation_mm4xzvhq', 'dropdown_mm6tr0v2']),
  ]);
  const proj = new Map(projects.map((p) => [String(p.id), { name: p.name, code: (p.column_values[0]?.text ?? '').trim() || (p.name.match(/(\d{4}\/\d{3})/)?.[1] ?? '') }]));
  const all: ApusRow[] = [];
  for (const it of items) {
    const cv = (id: string) => it.column_values.find((c) => c.id === id);
    const weekLabel = (cv('color_mm4wwfr5')?.text ?? '').trim();
    const wn = weekLabel.match(/^(\d+)/);
    if (!wn) continue;
    const linked = proj.get(String(cv('board_relation_mm4xzvhq')?.linked_item_ids?.[0] ?? ''));
    const updates = n(cv('numeric_mm4w7f8e')?.text) ?? 0;
    const users = n(cv('numeric_mm4wrmjz')?.text) ?? 0;
    const fromBoard = n(cv('formula_mm4xx5rq')?.display_value);
    // O espelho nem sempre vem pela API: sem ele, deduz as semanas da própria fórmula
    const weeksOnPlatform = n(cv('lookup_mm4xdrwf')?.display_value) ?? (fromBoard && users ? Math.round(updates / users / fromBoard) : null);
    const apus = fromBoard ?? (users && weeksOnPlatform ? updates / users / weeksOnPlatform : null);
    all.push({
      team: it.name.trim(), project: linked?.name ?? '', code: linked?.code ?? '',
      managers: (cv('dropdown_mm6tr0v2')?.text ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      weekNumber: Number(wn[1]), weekLabel: weekLabel.replace(/\s+/g, ' '), updates, users, weeksOnPlatform,
      apus: apus === null ? null : Math.round(apus * 100) / 100,
    });
  }
  // Últimas 26 semanas bastam para os gráficos e mantêm o documento pequeno
  const maxWeek = Math.max(0, ...all.map((r) => r.weekNumber));
  const rows = all.filter((r) => r.weekNumber > maxWeek - 26);
  const weeks = [...new Map(rows.map((r) => [r.weekNumber, r.weekLabel])).entries()]
    .sort((a, b) => b[0] - a[0]).map(([weekNumber, weekLabel]) => ({ weekNumber, weekLabel }));
  return { rows, weeks, boardId: APUS_BOARD_ID, readAt: new Date().toISOString() };
}

/** Lê o quadro no máximo a cada 30 minutos (ou na hora, com force). */
export async function apusData(force = false): Promise<ApusData> {
  const col = (await mongo()).collection<{ _id: string; data: ApusData }>('apus_cache');
  if (!force) {
    const c = await col.findOne({ _id: 'last' });
    if (c && Date.now() - new Date(c.data.readAt).getTime() < CACHE_MIN * 60000) return c.data;
  }
  const data = await readBoard();
  await col.replaceOne({ _id: 'last' }, { data }, { upsert: true });
  return data;
}
