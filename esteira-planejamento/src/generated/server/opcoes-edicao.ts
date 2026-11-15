import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { Board0201ProjetosEmPlanejamentoBoard } from '@api/BoardSDK';
import { OPT } from '@generated/lib/board-options';

const BOARD_ID = '18412010674';

/** SDK prop → real column id on board 02.01 (from the board schema). */
const STATUS_COLS = {
  statusPlanejamento: 'color_mm3axm14',
  statusSgi: 'color_mm34f2he',
  prioridade: 'color_mm33f6am',
  radarMonitoramento: 'color_mm3zcq9z',
  alocaoDeEquipe: 'color_mm766rs9',
  dimensionamentoConcludo: 'color_mm7y8hwt',
} as const;
const DROPDOWN_COLS = {
  eixo: 'dropdown_mm38v0xw',
  uf: 'dropdown_mm3815pa',
  tipoPlanejamento: 'dropdown_mm3a5hsg',
  gerente1: 'dropdown_mm6v1tw6',
} as const;

export type OpcaoKey = keyof typeof STATUS_COLS | keyof typeof DROPDOWN_COLS;
export type OpcoesEdicao = Record<OpcaoKey, string[]>;

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; value: OpcoesEdicao } | null = null;

type Json = Record<string, unknown>;
const asObj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

function parseSettings(raw: unknown): Json {
  if (typeof raw === 'string') {
    try { return asObj(JSON.parse(raw)); } catch { return {}; }
  }
  return asObj(raw);
}

function deactivatedIds(s: Json): Set<string> {
  const d = s.deactivated_labels;
  return new Set(Array.isArray(d) ? d.map((x) => String(typeof x === 'object' && x ? asObj(x).id : x)) : []);
}

/** Status labels in board order (labels_positions_v2 / index), skipping deactivated ones. */
function statusLabels(s: Json): string[] {
  const off = deactivatedIds(s);
  const labels = s.labels;
  if (Array.isArray(labels)) {
    return labels
      .map((l) => asObj(l))
      .filter((l) => !l.is_deactivated && !off.has(String(l.id)))
      .map((l) => ({ name: String(l.label ?? l.name ?? '').trim(), pos: Number(l.index ?? l.position ?? 0) }))
      .filter((l) => l.name)
      .sort((a, b) => a.pos - b.pos)
      .map((l) => l.name);
  }
  const map = asObj(labels);
  const pos = asObj(s.labels_positions_v2);
  return Object.entries(map)
    .filter(([id, name]) => typeof name === 'string' && name.trim() && !off.has(id))
    .map(([id, name]) => ({ name: String(name).trim(), pos: Number(pos[id] ?? id) }))
    .sort((a, b) => a.pos - b.pos)
    .map((l) => l.name);
}

/** Dropdown options sorted alphabetically (pt-BR), skipping deactivated ones. */
function dropdownLabels(s: Json): string[] {
  const off = deactivatedIds(s);
  const labels = Array.isArray(s.labels) ? s.labels : [];
  const names = labels
    .map((l) => asObj(l))
    .filter((l) => !l.is_deactivated && !off.has(String(l.id)))
    .map((l) => String(l.name ?? l.label ?? '').trim())
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function lerColunas(field: 'settings_str' | 'settings') {
  const board = new Board0201ProjetosEmPlanejamentoBoard();
  const ids = [...Object.values(STATUS_COLS), ...Object.values(DROPDOWN_COLS)];
  const query = `query ($board: [ID!], $cols: [String]) { boards(ids: $board) { columns(ids: $cols) { id type ${field} } } }`;
  const res = await board.executeGraphQL(query, { board: [BOARD_ID], cols: ids });
  const cols: unknown[] = res?.boards?.[0]?.columns ?? [];
  const byId = new Map(cols.map((c) => { const o = asObj(c); return [String(o.id), parseSettings(o[field])] as const; }));
  if (!byId.size) throw new Error('Configuração das colunas não retornada.');
  return byId;
}

async function carregar(): Promise<OpcoesEdicao> {
  let byId: Map<string, Json>;
  try {
    byId = await lerColunas('settings_str');
  } catch (e) {
    console.error('Leitura via settings_str falhou; tentando settings', e);
    byId = await lerColunas('settings');
  }
  const out = {} as OpcoesEdicao;
  for (const [k, id] of Object.entries(STATUS_COLS) as [keyof typeof STATUS_COLS, string][]) {
    const v = statusLabels(byId.get(id) ?? {});
    out[k] = v.length ? v : OPT[k];
  }
  for (const [k, id] of Object.entries(DROPDOWN_COLS) as [keyof typeof DROPDOWN_COLS, string][]) {
    const v = dropdownLabels(byId.get(id) ?? {});
    out[k] = v.length ? v : [...OPT[k]].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  return out;
}

/** Live status labels / dropdown options from board 02.01 column settings, cached ~10 min. */
export const getOpcoesEdicao = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    if (!data.force && cache && Date.now() - cache.at < TTL_MS) {
      return { fonte: 'quadro' as const, opts: cache.value, atualizadoEm: new Date(cache.at).toISOString() };
    }
    try {
      const value = await carregar();
      cache = { at: Date.now(), value };
      return { fonte: 'quadro' as const, opts: value, atualizadoEm: new Date(cache.at).toISOString() };
    } catch (e) {
      console.error('Falha ao ler opções das colunas do quadro 02.01', e);
      const local = { ...OPT, gerente1: OPT.gerente1 } as OpcoesEdicao;
      return { fonte: 'local' as const, opts: local, atualizadoEm: null };
    }
  });
