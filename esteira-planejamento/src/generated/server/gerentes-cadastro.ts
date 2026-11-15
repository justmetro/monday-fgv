import { MapaDeGerentesDeProjetoBoard } from '@api/BoardSDK';
import { normNome } from '@generated/lib/nomes';
import { GRUPO_CADASTRO_MAPA as GRUPO_CADASTRO } from '@generated/lib/grupos';

export interface GerenteOpcao {
  id: string;
  name: string;
}

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; value: GerenteOpcao[] } | null = null;

/**
 * Items of group "Gerentes" whose Atividade Atual is GERENTE (case/accent-insensitive).
 * READ ONLY — this board is never written to. Cached ~10 min.
 */
export async function listarGerentesCadastro(force = false): Promise<GerenteOpcao[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const board = new MapaDeGerentesDeProjetoBoard();
  const first = await board
    .items()
    .withColumns(['atividadeAtual'])
    .where({ group: [GRUPO_CADASTRO] })
    .withPagination({ limit: 500 })
    .execute();
  const items = [...(first?.items ?? [])];
  let cursor = first?.cursor ?? null;
  while (cursor) {
    const next = await board.items().withColumns(['atividadeAtual']).withPagination({ limit: 500, cursor }).execute();
    items.push(...(next?.items ?? []));
    cursor = next?.cursor ?? null;
  }
  const value = items
    .filter((i) => i.group?.id === GRUPO_CADASTRO && normNome(i.atividadeAtual) === 'gerente')
    .map((i) => ({ id: String(i.id), name: i.name?.trim() ?? '' }))
    .filter((g) => g.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  cache = { at: Date.now(), value };
  return value;
}

/**
 * Valid manager ids among `ids`. Uses the cache, but if any id is missing it re-reads the Mapa (force)
 * before refusing — a manager registered minutes ago is accepted right away.
 */
export async function gerentesValidos(ids: string[]): Promise<Set<string>> {
  let validos = new Set((await listarGerentesCadastro()).map((g) => g.id));
  if (ids.some((id) => !validos.has(id))) validos = new Set((await listarGerentesCadastro(true)).map((g) => g.id));
  return validos;
}
