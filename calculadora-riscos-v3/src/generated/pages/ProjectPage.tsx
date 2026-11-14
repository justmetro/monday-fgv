import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from '@/router';
import { ArrowLeft } from 'lucide-react';
import { getProject } from '@generated/data/projects';
import { getAplicCounts } from '@generated/data/risks';
import { Skeleton } from '@components/ui/skeleton';
import { ReadOnlyBanner } from '@generated/components/ReadOnlyBanner';
import { ProjectHeader } from '@generated/components/project/ProjectHeader';
import { ProjectTabs } from '@generated/components/project/ProjectTabs';



type Project = NonNullable<Awaited<ReturnType<typeof getProject>>['item']>;

export function ProjectPage() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([getProject({ data: { id } }), getAplicCounts({ data: { projectId: id } }).catch((e: unknown) => {
      console.error('Erro ao contar riscos', e);
      return null;
    })])
      .then(([p, c]) => {
        if (!active) return;
        if (!p?.item) setError('Projeto não encontrado no quadro 08.01.');
        setProject(p?.item ?? null);
        setCounts(c?.counts ?? {});
        setTotal(c?.total ?? null);
      })
      .catch((e: unknown) => {
        console.error('Erro ao carregar projeto', e);
        if (active) setError('Não foi possível carregar este projeto.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  /** Ajusta as contagens localmente quando a aplicabilidade de um risco muda. */
  const onAplicChange = useCallback((from: string | null, to: string | null) => {
    setCounts((prev) => {
      const next = { ...prev };
      const f = from || 'Identificado';
      const t = to || 'Identificado';
      next[f] = Math.max(0, (next[f] ?? 0) - 1);
      next[t] = (next[t] ?? 0) + 1;
      return next;
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
      <ReadOnlyBanner />
      <nav aria-label="Trilha" className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground hover:text-[hsl(var(--sky))] lg:min-h-0">
          <ArrowLeft className="size-4" aria-hidden /> Projetos
        </Link>
        {project && <span className="truncate text-[hsl(var(--text-dim))]">/ {project.name}</span>}
      </nav>

      {loading ? (
        <div className="glass space-y-4 p-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !project ? (
        <div className="glass p-8 text-center">
          <p className="text-base font-medium">{error ?? 'Projeto indisponível.'}</p>
          <Link to="/" className="ghost-pill mt-4">
            Voltar aos projetos
          </Link>
        </div>
      ) : (
        <>
          <ProjectHeader project={project} />
          <ProjectTabs projectId={project.id} counts={counts} total={total ?? project.riscosGerados ?? 0} onAplicChange={onAplicChange} />
        </>
      )}
    </div>
  );
}
