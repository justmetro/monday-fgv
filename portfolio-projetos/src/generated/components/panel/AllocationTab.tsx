import { useMemo, useState } from 'react';
import type { OpsModel, OpsScope } from '@generated/lib/ops';
import { buildAllocation, unique, type Person } from '@generated/lib/allocation';
import { BarCard, KpiRow, type Datum } from './ChartCard';
import type { OpsDrill } from './OpsDrillSheet';
import type { ScheduleItemDoc } from '@generated/models';
import { Panel } from '../ui-bits';
import { WeeklyLoad } from './WeeklyLoad';

const LOW = 2;
const top = (l: Datum<ScheduleItemDoc>[], n = 15) => l.filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, n);

/** Aba Alocação: capacidade operacional dos responsáveis pelas atividades em aberto dos cronogramas. */
export function AllocationTab({ m, s, onDrill }: { m: OpsModel; s: OpsScope; onDrill: (d: OpsDrill) => void }) {
  const [withSubs, setWithSubs] = useState(true);
  const people = useMemo(() => buildAllocation(m, s, withSubs), [m, s, withSubs]);
  const pName = (b: string) => m.projectBy.get(b)?.name ?? b;
  const items = (p: Person, f: (x: Person['tasks'][number]) => boolean = () => true) => unique(p.tasks.filter(f).map((x) => x.drill));

  const byTotal = top(people.map((p) => ({ name: p.name, value: p.total, items: items(p) })));
  const byProg = top(people.map((p) => ({ name: p.name, value: p.prog, items: items(p, (x) => x.prog) })));
  const multi = people.filter((p) => p.byProject.size >= 2);
  const byMulti = top(multi.map((p) => ({ name: `${p.name} · ${p.byProject.size} projetos`, value: p.byProject.size, items: items(p) })));
  const low = people.flatMap((p) => [...p.byProject.entries()].filter(([, l]) => l.length <= LOW).map(([b, l]) => ({ p, b, l })));
  const byLow = low.sort((a, b) => a.l.length - b.l.length).slice(0, 15)
    .map(({ p, b, l }) => ({ name: `${p.name} · ${pName(b)}`, value: l.length, items: unique(l.map((x) => x.drill)) }));
  const totalTasks = people.reduce((a, p) => a + p.total, 0);

  const toggle = (
    <label className="flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm">
      <input type="checkbox" checked={withSubs} onChange={(e) => setWithSubs(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
      Incluir subatividades
    </label>
  );
  if (people.length === 0) return <div className="space-y-5">{toggle}<Panel><p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade em aberto com responsável no recorte.</p></Panel></div>;
  const drill = (title: string) => (d: Datum<ScheduleItemDoc>) => onDrill({ title: `${title}: ${d.name}`, schedule: d.items });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {toggle}
        <p className="text-xs text-muted-foreground">Considera atividades em aberto (sem concluídas, canceladas, despriorizadas ou excluídas) com responsável. Uma atividade com 2 responsáveis conta para os dois.</p>
      </div>
      <KpiRow items={[
        { label: 'Pessoas alocadas', value: String(people.length), hint: 'com atividade em aberto' },
        { label: 'Atividades em aberto', value: String(totalTasks), hint: 'soma por responsável' },
        { label: 'Média por pessoa', value: (totalTasks / people.length).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
        { label: 'Em progresso', value: String(people.reduce((a, p) => a + p.prog, 0)), tone: 'warn' },
        { label: 'Em 2+ projetos', value: String(multi.length), hint: 'pessoas', onClick: () => onDrill({ title: 'Pessoas em 2 ou mais projetos', schedule: unique(multi.flatMap((p) => p.tasks.map((x) => x.drill))) }) },
        { label: `Baixa carga (≤${LOW})`, value: String(low.length), hint: 'pessoa × projeto' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <BarCard title="Pessoas com mais atividades em aberto" data={byTotal} onPick={drill('Atividades em aberto')} />
        <BarCard title="Pessoas com mais atividades em progresso" data={byProg} onPick={drill('Em progresso')} />
        <BarCard title="Pessoas em mais de um projeto (nº de projetos)" data={byMulti} onPick={drill('Em vários projetos')} />
        <BarCard title={`Baixa carga por projeto (até ${LOW} atividades)`} data={byLow} onPick={drill('Baixa carga')} />
      </div>
      <WeeklyLoad people={people} today={m.today} />
    </div>
  );
}
