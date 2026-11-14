import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@components/ui/tabs';
import { ApplicableCounter } from '@generated/components/summary/ApplicableCounter';
import { ReviewTab } from '@generated/components/review/ReviewTab';
import { TreatmentTab } from '@generated/components/treatment/TreatmentTab';
import { SummaryTab } from '@generated/components/summary/SummaryTab';

type TabKey = 'revisao' | 'tratamento' | 'resumo';

export function ProjectTabs({
  projectId,
  counts,
  total,
  onAplicChange,
}: {
  projectId: string;
  counts: Record<string, number>;
  total: number;
  onAplicChange: (from: string | null, to: string | null) => void;
}) {
  const [tab, setTab] = useState<TabKey>('revisao');
  const aplicaveis = counts['Aplicável'] ?? 0;
  const pendentes = (counts['Identificado'] ?? 0) + (counts['Em avaliação'] ?? 0);

  const triggerCls =
    'mono-label h-11 min-w-0 flex-1 gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-muted-foreground shadow-none data-[state=active]:border-[hsl(var(--cobalt))] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--sky))] data-[state=active]:shadow-none sm:flex-none sm:px-4';

  return (
    <section className="mt-6" aria-label="Revisão e tratamento dos riscos">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-0">
        <div className="sticky top-[61px] z-10 -mx-4 flex flex-col gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.92)] px-4 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:top-0">
          <TabsList variant="line" className="h-auto w-full gap-0 p-0 sm:w-auto">
            <TabsTrigger value="revisao" className={triggerCls}>
              Revisão <span className="mono text-[11px] tabular-nums text-[hsl(var(--text-dim))]">{pendentes}</span>
            </TabsTrigger>
            <TabsTrigger value="tratamento" className={triggerCls}>
              Tratamento <span className="mono text-[11px] tabular-nums text-[hsl(var(--text-dim))]">{aplicaveis}</span>
            </TabsTrigger>
            <TabsTrigger value="resumo" className={triggerCls}>
              Resumo
            </TabsTrigger>
          </TabsList>
          <div className="hidden pb-2 sm:block sm:pb-0">
            <ApplicableCounter value={aplicaveis} variant="compact" />
          </div>
        </div>
      </Tabs>

      <div className="pt-5">
        {tab === 'revisao' && <ReviewTab projectId={projectId} total={total} onAplicChange={onAplicChange} />}
        {tab === 'tratamento' && <TreatmentTab projectId={projectId} />}
        {tab === 'resumo' && <SummaryTab projectId={projectId} />}
      </div>
    </section>
  );
}
