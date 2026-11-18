import { Board0201ProjetosEmPlanejamentoBoard } from '@api/BoardSDK';
import { GROUP_ESTEIRA, GROUP_HISTORICO } from '@generated/lib/grupos';
import getServerApiClient from '@api/api-client.server';
import { BOARD_ID } from '@generated/lib/links';

/** Avanço do planejamento pelos subitens: Concluído ÷ (subitens − Despriorizado). */
export interface Avanco { concluidos: number; total: number; pct: number | null }

type PaginaSub = { items: { id: string; subitems: { column_values: { text: string | null }[] }[] | null }[]; cursor: string | null };
const CAMPOS_SUB = 'cursor items { id subitems { column_values(ids: ["status"]) { text } } }';

async function buscarAvanco(): Promise<Map<string, Avanco>> {
  const { client } = await getServerApiClient();
  const mapa = new Map<string, Avanco>();
  const somar = (pg: PaginaSub | undefined) => {
    for (const it of pg?.items ?? []) {
      const st = (it.subitems ?? []).map((s) => (s.column_values[0]?.text ?? '').trim());
      const validos = st.filter((t) => t !== 'Despriorizado');
      const concluidos = validos.filter((t) => t === 'Concluído').length;
      mapa.set(String(it.id), { concluidos, total: validos.length, pct: validos.length ? Math.round((concluidos / validos.length) * 100) : null });
    }
  };
  const r = await client.request<{ boards: { items_page: PaginaSub }[] }>(
    `query($b:[ID!]){ boards(ids:$b){ items_page(limit:100){ ${CAMPOS_SUB} } } }`, { b: [String(BOARD_ID)] });
  let pg: PaginaSub | undefined = r.boards?.[0]?.items_page;
  somar(pg);
  while (pg?.cursor) {
    const n = await client.request<{ next_items_page: PaginaSub }>(
      `query($c:String!){ next_items_page(limit:100, cursor:$c){ ${CAMPOS_SUB} } }`, { c: pg.cursor });
    pg = n.next_items_page;
    somar(pg);
  }
  return mapa;
}

/**
 * Server-side data module for board 02.01 — imported by server functions and used ONLY inside
 * their handlers (so the client build drops the import entirely).
 */
export const COLUMNS = [
  'gerente', 'gerente1', 'statusPlanejamento', 'statusSgi', 'status', 'pontoFocal', 'vignciaContratual',
  'eixo', 'tipoPlanejamento', 'prioridade', 'uf', 'cliente', 'cdigoProjeto',
  'quadroDoPlanejamento', 'painelSgi', 'planilhaPlanejamento',
  'incioPlanejamento', 'dataValidaoSgi', 'msRefernciaResultado',
  'calcPrazoDeConcluso', 'prazoDeConcluso', 'conclusoDoPlanejamento', 'resultadoConclusoPlanejamento', 'tempoDePlanejamento',
  'calcPrazoRegistroSgi', 'prazoRegistroSgi', 'conclusoRegistroSgi', 'resultadoSgi', 'tempoRegistroSgi',
  'prazoDimensionamento', 'conclusoDoDimensionamento', 'diasDimensionamento', 'io211NoPrazo', 'dimensionamentoConcludo',
  'valorDoContrato', 'equipeOr', 'equipePlan', 'oradoInsumos', 'planejadoInsumos', 'oradoTotal', 'planejadoTotal',
  'rSaldoEquipe', 'SaldoEquipe', 'rSaldoInsumos', 'SaldoInsumos', 'rSaldoTotal', 'SaldoTotal',
  'radarMonitoramento', 'alocaoDeEquipe', 'it11', 'it12', 'it13', 'it14',
  // Alocação de Gerentes
  'statusProspeco', 'dataDeAssinatura', 'faixaDeComplexidadeEspelho', 'ltimoProdutoPrevisto', 'alocaoGerente',
  'statusHistricoDeProjetos', 'prazoIncioExecuo', 'prazoTrminoExecuo',
] as const;

/** Every item of Esteira + Histórico with all columns the panel uses (paginated). */
async function buscarBase() {
  const board = new Board0201ProjetosEmPlanejamentoBoard();
  const first = await board
    .items()
    .withColumns([...COLUMNS])
    .where({ group: [GROUP_ESTEIRA, GROUP_HISTORICO] })
    .orderBy({ column: 'name', direction: 'asc' })
    .withPagination({ limit: 500 })
    .execute();
  const items = [...(first?.items ?? [])];
  let cursor = first?.cursor ?? null;
  while (cursor) {
    const next = await board.items().withColumns([...COLUMNS]).withPagination({ limit: 500, cursor }).execute();
    items.push(...(next?.items ?? []));
    cursor = next?.cursor ?? null;
  }
  const avanco = await buscarAvanco().catch((e: unknown) => {
    console.error('Leitura dos subitens (avanço) falhou', e);
    return new Map<string, Avanco>();
  });
  return items.map((i) => ({ ...i, avanco: avanco.get(String(i.id)) ?? null }));
}

export type BaseItem = Awaited<ReturnType<typeof buscarBase>>[number];

/** In-memory cache: 60 s fresh, then served stale while revalidating in the background. */
const TTL_MS = 60 * 1000;
let cache: { at: number; items: BaseItem[] } | null = null;
/** In-flight read and the `versao` it started at (a read started before a write is never reused after it). */
let emVoo: { v: number; p: Promise<BaseItem[]> } | null = null;
/** Bumped after every write to 02.01; a read that started at an older version never fills the cache. */
let versao = 0;
/** True after a write: obterBase waits for a fresh read instead of serving the old cache. */
let sujo = false;
/** Items re-read after a write (fresh), re-applied over any full read that lands later. */
const frescos = new Map<string, { v: number; item: BaseItem }>();

/** Call after ANY write to 02.01 (updateProjeto / gravarAlocacao). */
export function invalidarBase() {
  versao++;
  sujo = true;
}

function recarregar(): Promise<BaseItem[]> {
  if (emVoo && emVoo.v === versao) return emVoo.p;
  const v0 = versao;
  const p = buscarBase()
    .then((items) => {
      // Race with a write: discard (don't cache) a read that started before it.
      if (versao !== v0) return items;
      // Fresh single-item re-reads newer than this read's start win over it.
      const merged = items.map((i) => {
        const f = frescos.get(i.id);
        return f && f.v > v0 ? { ...f.item, avanco: i.avanco } : i;
      });
      for (const [id, f] of frescos) if (f.v <= v0) frescos.delete(id);
      cache = { at: Date.now(), items: merged };
      sujo = false;
      return merged;
    })
    .finally(() => {
      if (emVoo?.p === p) emVoo = null;
    });
  emVoo = { v: v0, p };
  return p;
}

export async function obterBase(force: boolean): Promise<{ items: BaseItem[]; atualizadoEm: string }> {
  if (!force && !sujo && cache) {
    if (Date.now() - cache.at > TTL_MS) {
      recarregar().catch((e: unknown) => console.error('Revalidação da base 02.01 falhou', e));
    }
    return { items: cache.items, atualizadoEm: new Date(cache.at).toISOString() };
  }
  const v = versao;
  let items = await recarregar();
  // A write landed during the read: read once more so the caller never gets pre-write data.
  if (versao !== v) items = await recarregar();
  return { items, atualizadoEm: new Date(cache?.at ?? Date.now()).toISOString() };
}

/** Re-reads one item (fresh formulas) and applies it to the cache; an older revalidation can't overwrite it. */
export async function relerItem(id: string) {
  const v = versao;
  const lido = await new Board0201ProjetosEmPlanejamentoBoard().item(id).withColumns([...COLUMNS]).execute();
  const fresh: BaseItem | null = lido ? { ...lido, avanco: cache?.items.find((i) => i.id === lido.id)?.avanco ?? null } : null;
  if (fresh) {
    frescos.set(fresh.id, { v, item: fresh });
    if (cache) cache = { ...cache, items: cache.items.map((i) => (i.id === fresh.id ? fresh : i)) };
  }
  return fresh;
}
