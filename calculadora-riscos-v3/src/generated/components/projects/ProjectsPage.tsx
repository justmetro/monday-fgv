import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { Loader2, Search } from 'lucide-react';
import { getProjects } from '@generated/data/projects';
import { Eyebrow } from '@generated/components/kit';
import { ReadOnlyBanner } from '@generated/components/ReadOnlyBanner';
import { ProjectRow, ProjectRowSkeleton } from '@generated/components/projects/ProjectRow';

type Project = Awaited<ReturnType<typeof getProjects>>['items'][number];

export function ProjectsPage() {
  const [search, setSearch] = useState('');
  const term = useDebounce(search, 300);
  const [items, setItems] = useState<Project[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    let active = true;
    if (loadedOnce.current) setRefetching(true);
    else setLoading(true);
    setError(null);
    getProjects({ data: { search: term || undefined } })
      .then((res) => {
        if (!active) return;
        setItems(res?.items ?? []);
        setCursor(res?.cursor ?? null);
        loadedOnce.current = true;
      })
      .catch((e: unknown) => {
        console.error('Erro ao carregar projetos', e);
        if (active) setError('Não foi possível carregar os projetos do quadro 09.1.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefetching(false);
      });
    return () => {
      active = false;
    };
  }, [term]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await getProjects({ data: { search: term || undefined, cursor } });
      setItems((prev) => [...prev, ...(res?.items ?? [])]);
      setCursor(res?.cursor ?? null);
    } catch (e) {
      console.error('Erro ao carregar mais projetos', e);
      setError('Não foi possível carregar mais projetos.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 pb-16 pt-6 sm:px-6 lg:pt-10">
      <ReadOnlyBanner />
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Eyebrow>09.1 · Projetos com riscos gerados pelo motor</Eyebrow>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.025em] text-foreground sm:text-4xl">Projetos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Escolha um projeto para revisar a aplicabilidade dos riscos gerados e registrar o tratamento. Este app
            não gera riscos: o motor externo cria os itens quando a Calculadora vai para “Executar”.
          </p>
        </div>
        <label className="relative block w-full md:w-80">
          <span className="sr-only">Buscar projeto pelo nome</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar projeto pelo nome"
            className="h-11 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] pl-9 pr-9 text-base text-foreground placeholder:text-[hsl(var(--text-dim))] focus-visible:border-[hsl(var(--cobalt))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring)/0.35)] md:text-sm"
          />
          {refetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[hsl(var(--sky))]" aria-label="Atualizando" />}
        </label>
      </div>

      <section className="glass mt-6 overflow-hidden" aria-label="Lista de projetos">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_150px_90px_minmax(0,1.6fr)_minmax(0,1.8fr)_130px] gap-4 border-b border-[hsl(var(--border))] px-5 py-3 lg:grid">
          {['Projeto', 'Calculadora', 'Riscos', 'Grupos de risco', 'Avisos do motor', 'Planejamento'].map((h) => (
            <span key={h} className="mono-label text-[hsl(var(--text-dim))]">
              {h}
            </span>
          ))}
        </div>

        {error && <p className="px-5 py-4 text-sm text-[hsl(var(--destructive))]">{error}</p>}

        {loading ? (
          <div>{Array.from({ length: 5 }).map((_, i) => <ProjectRowSkeleton key={i} />)}</div>
        ) : items.length === 0 && !error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-base font-medium">{term ? 'Nenhum projeto com esse nome' : 'Nenhum projeto cadastrado'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {term ? 'Tente outro termo de busca.' : 'Cadastre o projeto no quadro 09.1 e execute a calculadora para gerar os riscos.'}
            </p>
          </div>
        ) : (
          <ul className={refetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {items.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </ul>
        )}
      </section>

      {cursor && !loading && (
        <div className="mt-5 flex justify-center">
          <button type="button" className="cta-pill" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {loadingMore ? 'Carregando' : 'Carregar mais projetos'}
          </button>
        </div>
      )}
    </div>
  );
}
