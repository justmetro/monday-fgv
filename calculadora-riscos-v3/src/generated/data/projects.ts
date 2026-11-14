import { readProjects, readByIds, PROJ_FIELDS } from '@generated/lib/fields';

type Project = Awaited<ReturnType<typeof readProjects>>[number];
let cache: { at: number; items: Project[] } | null = null;

/** Lista de projetos (09.1), busca por nome, 25 por vez. */
export async function getProjects({ data }: { data: { search?: string; cursor?: string | null } }) {
  if (!cache || Date.now() - cache.at > 60_000 || !data.cursor) cache = { at: Date.now(), items: await readProjects() };
  const term = data.search?.trim().toLowerCase();
  const all = cache.items
    .filter((p) => !term || p.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const start = Number(data.cursor ?? 0);
  const items = all.slice(start, start + 25);
  return { items, cursor: start + 25 < all.length ? String(start + 25) : null };
}

/** Ficha completa de um projeto. */
export async function getProject({ data }: { data: { id: string } }) {
  const [item] = await readByIds([data.id], PROJ_FIELDS);
  return { item: item ?? null };
}
