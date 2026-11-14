import { useEffect, useState } from 'react';
import { getProjectSummary } from '@generated/data/summary';
import { Skeleton } from '@components/ui/skeleton';
import { Eyebrow } from '@generated/components/kit';
import { ApplicableCounter } from '@generated/components/summary/ApplicableCounter';
import { Bars, type Count } from '@generated/components/summary/Bars';
import { CriticalList } from '@generated/components/summary/CriticalList';
import { TreatmentProgress } from '@generated/components/summary/TreatmentProgress';
import { ESCALA } from '@generated/lib/config';
import { cn } from '@lib/utils';

type Summary = Awaited<ReturnType<typeof getProjectSummary>>;
type Scope = 'aplic' | 'todos';

const APLIC_ORDER = ['Aplicável', 'Em avaliação', 'Identificado', 'Não aplicável'];
const APLIC_LABEL: Record<string, string> = { Identificado: 'Não revisados' };
const APLIC_COLOR: Record<string, string> = {
  Aplicável: 'bg-[hsl(var(--cobalt))]',
  'Em avaliação': 'bg-[hsl(var(--warning))]',
  Identificado: 'bg-[hsl(var(--chart-5))]',
  'Não aplicável': 'bg-[hsl(var(--border))]',
};

function orderNivel(rows: Count[]): Count[] {
  const map = new Map(rows.map((r) => [r.label, r.total]));
  const ordered: Count[] = [...ESCALA].reverse().map((l) => ({ label: l, total: map.get(l) ?? 0 }));
  for (const r of rows) if (!ESCALA.includes(r.label as (typeof ESCALA)[number])) ordered.push(r);
  return ordered;
}

export function SummaryTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('aplic');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProjectSummary({ data: { projectId } })
      .then((res) => active && setData(res ?? null))
      .catch((e: unknown) => {
        console.error('Erro ao carregar resumo', e);
        if (active) setError('Não foi possível montar o resumo do projeto.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (error || !data) return <p className="text-sm text-[hsl(var(--destructive))]">{error ?? 'Resumo indisponível.'}</p>;

  const byAplic = new Map(data.aplicabilidade.map((r) => [r.label, r.total]));
  const get = (k: string) => byAplic.get(k) ?? 0;
  const total = data.total || [...byAplic.values()].reduce((a, b) => a + b, 0);
  const nivel = orderNivel(scope === 'aplic' ? data.nivelAplic : data.nivelTodos);
  const categoria = [...(scope === 'aplic' ? data.categoriaAplic : data.categoriaTodos)].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <section className="glass grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <ApplicableCounter value={get('Aplicável')} />
        <div className="min-w-0">
          <Eyebrow>Revisão de aplicabilidade</Eyebrow>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Total gerado', total],
              ['Aplicáveis', get('Aplicável')],
              ['Não aplicáveis', get('Não aplicável')],
              ['Em avaliação', get('Em avaliação')],
            ].map(([l, n]) => (
              <div key={l} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{l}</dt>
                <dd className="mono mt-1 text-2xl tabular-nums text-foreground">{n}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-[hsl(var(--border)/0.5)]" role="img" aria-label="Proporção por aplicabilidade">
            {APLIC_ORDER.map((k) =>
              get(k) > 0 ? <span key={k} className={APLIC_COLOR[k]} style={{ width: `${(get(k) / Math.max(1, total)) * 100}%` }} title={`${APLIC_LABEL[k] ?? k}: ${get(k)}`} /> : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {APLIC_ORDER.map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('size-2 rounded-full', APLIC_COLOR[k])} /> {APLIC_LABEL[k] ?? k} <span className="mono text-foreground">{get(k)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 pt-2">
        <h2 className="text-xl font-semibold tracking-tight">Distribuição</h2>
        <div role="group" aria-label="Base da distribuição" className="flex gap-1.5">
          {(['aplic', 'todos'] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={cn('ghost-pill', scope === s && 'border-[hsl(var(--cobalt))] bg-[hsl(var(--surface-deep))] text-[hsl(var(--sky))]')}
            >
              {s === 'aplic' ? 'Aplicáveis' : 'Todos gerados'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass p-5">
          <Eyebrow>Por nível (calculado pelo 09.4)</Eyebrow>
          <div className="mt-4">
            <Bars rows={nivel} highlight={(l) => l === 'Muito Alto'} emptyText="Sem riscos nesta base." />
          </div>
        </section>
        <section className="glass p-5">
          <Eyebrow>Por categoria</Eyebrow>
          <div className="mt-4">
            <Bars rows={categoria} emptyText="Sem riscos nesta base." />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <CriticalList items={data.criticos} />
        <TreatmentProgress rows={data.tratamento} pendencias={data.pendencias} aplicaveis={get('Aplicável')} />
      </div>
    </div>
  );
}
