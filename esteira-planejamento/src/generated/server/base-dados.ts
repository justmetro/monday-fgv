import { Board0201ProjetosEmPlanejamentoBoard } from '@api/BoardSDK';
import { GROUP_ESTEIRA, GROUP_HISTORICO } from '@generated/lib/grupos';

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
  return items;
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
        return f && f.v > v0 ? f.item : i;
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
  const fresh = await new Board0201ProjetosEmPlanejamentoBoard().item(id).withColumns([...COLUMNS]).execute();
  if (fresh) {
    frescos.set(fresh.id, { v, item: fresh });
    if (cache) cache = { ...cache, items: cache.items.map((i) => (i.id === fresh.id ? fresh : i)) };
  }
  return fresh;
}
