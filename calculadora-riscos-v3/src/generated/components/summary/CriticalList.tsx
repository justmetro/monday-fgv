import type { getProjectSummary } from '@generated/data/summary';
import { aplicTone, Eyebrow, GrauBlock, Pill, tratTone } from '@generated/components/kit';
import { riskTitle } from '@generated/components/review/ReviewRow';
import { LIMITE_CRITICO } from '@generated/lib/config';
import { cn } from '@lib/utils';

type Critico = Awaited<ReturnType<typeof getProjectSummary>>['criticos'][number];

export function CriticalList({ items }: { items: Critico[] }) {
  const semPlano = items.filter((c) => c.aplicabilidade === 'Aplicável' && c.semPlano).length;
  return (
    <section className="glass p-5">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Críticos · grau ≥ {LIMITE_CRITICO}</Eyebrow>
        <span className="mono text-sm tabular-nums text-[hsl(var(--destructive))]">{items.length}</span>
      </div>
      <p className={cn('mt-1.5 text-sm', semPlano > 0 ? 'text-[hsl(var(--destructive))]' : 'text-muted-foreground')}>
        {semPlano === 1 ? '1 crítico aplicável ainda não tem plano de ação' : `${semPlano} críticos aplicáveis ainda não têm plano de ação`}
      </p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum risco crítico entre os aplicáveis e os ainda em revisão.</p>
      ) : (
        <ul className="mt-3 max-h-[420px] divide-y divide-[hsl(var(--border)/0.7)] overflow-y-auto">
          {items.map((c) => (
            <li key={c.id} className="flex items-start gap-3 py-3">
              <GrauBlock grau={c.grauDeRisco} nivel={c.nvelDeRisco} compact />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mono text-xs text-[hsl(var(--sky))]">{c.idDoRisco ?? '—'}</span>
                  <Pill tone={aplicTone(c.aplicabilidade)}>{c.aplicabilidade || 'Não revisado'}</Pill>
                  {c.aplicabilidade === 'Aplicável' && <Pill tone={tratTone(c.statusDoTratamento)}>{c.statusDoTratamento ?? 'Sem status'}</Pill>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-foreground/90" title={c.name}>
                  {riskTitle(c)}
                </p>
                {c.aplicabilidade === 'Aplicável' && (c.semEstrategia || c.semResponsavel || c.semPrazo || c.semPlano) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.semEstrategia && <Pill tone="warn">Sem estratégia</Pill>}
                    {c.semResponsavel && <Pill tone="warn">Sem responsável</Pill>}
                    {c.semPrazo && <Pill tone="warn">Sem prazo</Pill>}
                    {c.semPlano && <Pill tone="danger">Sem plano de ação</Pill>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
