import { MapaDeGerentesDeProjetoBoard } from '@api/BoardSDK';
import { normNome } from '@generated/lib/nomes';
import { GRUPO_CADASTRO_MAPA as GRUPO_CADASTRO } from '@generated/lib/grupos';

/**
 * Server-side data module for the "Mapa de Gerentes de Projeto" board — READ ONLY, never written.
 * Imported by server functions and used ONLY inside their handlers (dropped from the client build).
 * Structure: group "Gerentes" holds one registration item per manager (perfil, PMI, e-mail…);
 * every other group is named after a manager and holds that manager's project allocations.
 */
const COLS = [
  'perfil', 'certificaoPmi', 'processoDeQualificao', 'status', 'atividadeAtual', 'statusProjeto',
  'projetosGerenciados', 'alocaoNoProjeto', 'fimAtuao', 'sadaDoProjeto', 'perodoNoProjeto',
  'compexidadeDoProjeto', 'avDesempenho', 'totalProjetos', 'email', 'local',
] as const;

const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const media = (v: (number | null)[]) => {
  const n = v.filter((x): x is number => x !== null);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
};

async function montarMapa() {
    const board = new MapaDeGerentesDeProjetoBoard();
    const first = await board.items().withColumns([...COLS]).withPagination({ limit: 500 }).execute();
    const items = [...(first?.items ?? [])];
    let cursor = first?.cursor ?? null;
    while (cursor) {
      const next = await board.items().withColumns([...COLS]).withPagination({ limit: 500, cursor }).execute();
      items.push(...(next?.items ?? []));
      cursor = next?.cursor ?? null;
    }

    const cadastro = items.filter((i) => i.group?.id === GRUPO_CADASTRO);
    const alocacoes = items.filter((i) => i.group?.id !== GRUPO_CADASTRO);
    const hoje = new Date().toISOString().slice(0, 10);

    const aloPorNome = new Map<string, typeof alocacoes>();
    for (const a of alocacoes) {
      const k = normNome(a.group?.title);
      if (k) aloPorNome.set(k, [...(aloPorNome.get(k) ?? []), a]);
    }

    const montar = (c: (typeof items)[number] | null, nome: string, alos: typeof alocacoes) => {
      const fimAlos = alos
        .map((a) => iso(a.fimAtuao?.to ?? a.fimAtuao?.from) ?? iso(a.sadaDoProjeto))
        .filter((d): d is string => !!d)
        .sort();
      // Registration date wins; else nearest upcoming allocation end; else latest past one.
      const fim: string | null = iso(c?.fimAtuao?.to ?? c?.fimAtuao?.from) ?? fimAlos.find((d) => d >= hoje) ?? fimAlos[fimAlos.length - 1] ?? null;
      const projetoIds = new Set<string>();
      for (const x of [c, ...alos]) for (const li of x?.projetosGerenciados?.linkedItems ?? []) projetoIds.add(String(li.id));
      return {
        id: c?.id ?? `grupo:${normNome(nome)}`,
        nome,
        nomeNorm: normNome(nome),
        cadastrado: !!c,
        perfil: c?.perfil ?? [],
        pmi: c?.certificaoPmi ?? [],
        qualificacao: c?.processoDeQualificao ?? [],
        statusQualificacao: c?.status ?? null,
        atividadeAtual: c?.atividadeAtual ?? null,
        email: c?.email?.email ?? null,
        local: c?.local?.city || c?.local?.address || null,
        fimAtuacao: fim as string | null,
        desempenho: num(c?.avDesempenho) ?? media(alos.map((a) => num(a.avDesempenho))),
        complexidade: num(c?.compexidadeDoProjeto) ?? media(alos.map((a) => num(a.compexidadeDoProjeto))),
        totalProjetosMapa: c?.totalProjetos && c.totalProjetos !== 'null' ? c.totalProjetos : null,
        itemIds: [c?.id, ...alos.map((a) => a.id)].filter((x): x is string => !!x),
        projetoIds: [...projetoIds],
        alocacoes: alos.map((a) => ({
          id: a.id,
          nome: a.name,
          statusProjeto: a.statusProjeto ?? null,
          projetoIds: (a.projetosGerenciados?.linkedItems ?? []).map((li) => String(li.id)),
          fim: iso(a.fimAtuao?.to ?? a.fimAtuao?.from),
          inicio: iso(a.fimAtuao?.from),
          projetoNomes: (a.projetosGerenciados?.linkedItems ?? []).map((li) => li.name ?? '').filter(Boolean),
          saida: iso(a.sadaDoProjeto),
          periodo: a.perodoNoProjeto && a.perodoNoProjeto !== 'null' ? a.perodoNoProjeto : null,
        })),
      };
    };

    const gerentes = cadastro.map((c) => montar(c, c.name, aloPorNome.get(normNome(c.name)) ?? []));
    // Allocation groups without a registration item still represent a manager.
    const conhecidos = new Set(gerentes.map((g) => g.nomeNorm));
    for (const [k, alos] of aloPorNome) {
      if (!conhecidos.has(k)) gerentes.push(montar(null, alos[0]?.group?.title ?? k, alos));
    }
    gerentes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      gerentes,
      resumo: { cadastro: cadastro.length, alocacoes: alocacoes.length, grupos: aloPorNome.size },
    };
}

type MapaResultado = Awaited<ReturnType<typeof montarMapa>>;

/** In-memory cache (60 s, stale-while-revalidate) — the Mapa is read-only for this app. */
const TTL_MAPA_MS = 60 * 1000;
let mapaCache: { at: number; value: MapaResultado } | null = null;
let mapaEmVoo: { v: number; p: Promise<MapaResultado> } | null = null;
let mapaVersao = 0;
let mapaSujo = false;

/** Call after a 02.01 write that changes the Gerente relation (it is mirrored on the Mapa). The Mapa itself is never written. */
export function invalidarMapa() {
  mapaVersao++;
  mapaSujo = true;
}

function recarregarMapa(): Promise<MapaResultado> {
  if (mapaEmVoo && mapaEmVoo.v === mapaVersao) return mapaEmVoo.p;
  const v0 = mapaVersao;
  const p = montarMapa()
    .then((value) => {
      // Read started before an invalidation: don't cache it.
      if (mapaVersao === v0) {
        mapaCache = { at: Date.now(), value };
        mapaSujo = false;
      }
      return value;
    })
    .finally(() => {
      if (mapaEmVoo?.p === p) mapaEmVoo = null;
    });
  mapaEmVoo = { v: v0, p };
  return p;
}

export async function obterMapa(force: boolean): Promise<MapaResultado> {
  if (!force && !mapaSujo && mapaCache) {
    if (Date.now() - mapaCache.at > TTL_MAPA_MS) {
      recarregarMapa().catch((e: unknown) => console.error('Revalidação do Mapa de Gerentes falhou', e));
    }
    return mapaCache.value;
  }
  return recarregarMapa();
}
