import { useState } from 'react';
import type { Cell, Report } from '@generated/lib/intel';
import { fp } from './report-parts';
import { cn } from '@lib/utils';

export const METRICS = [
  ['indicators', 'Indicadores'], ['projects', 'Projetos'], ['pct', '% projetos do eixo'], ['meds', 'Medições'], ['rate', 'Taxa c/ atrasos'],
] as const;
export type Metric = (typeof METRICS)[number][0];

export function cellText(c: Cell, mt: Metric): { v: string; base: string } {
  if (c.state === 'absent') return { v: 'Ausente', base: 'família ausente no recorte' };
  switch (mt) {
    case 'indicators': return { v: String(c.indicators), base: `${c.projects} proj.` };
    case 'projects': return { v: String(c.projects), base: `de ${c.denom} proj.` };
    case 'pct': return { v: fp(c.pct), base: `${c.projects}/${c.denom} proj.` };
    case 'meds': return { v: String(c.meds), base: `${c.ev} avaliáveis` };
    default:
      if (c.state === 'nobase') return { v: 'Sem base', base: 'sem medições avaliáveis' };
      return { v: fp(c.rate), base: `${c.B}/${c.ev} · ${c.D} atras.${c.state === 'reduced' ? ' · base reduzida' : ''}` };
  }
}

export function Matrix({ report }: { report: Report }) {
  const [mt, setMt] = useState<Metric>('pct');
  if (report.axes.length === 0) return <p className="text-sm text-muted-foreground">Nenhum eixo no recorte.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Métrica da matriz">
        {METRICS.map(([v, l]) => <button key={v} onClick={() => setMt(v)} aria-pressed={mt === v} className={cn('min-h-9 rounded-md px-3 text-sm', mt === v ? 'bg-primary text-primary-foreground' : 'border border-border')}>{l}</button>)}
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
        <table className="text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="sticky left-0 min-w-56 bg-muted p-2">Família</th>{report.axes.map((a) => <th key={a.axis} className="min-w-32 p-2">{a.label}<span className="block normal-case">{a.sec.projects.length} proj.</span></th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.matrix.map((r) => (
              <tr key={r.familia}>
                <td className="sticky left-0 bg-card p-2 font-medium">{r.familia}</td>
                {r.cells.map((c, i) => {
                  const t = cellText(c, mt);
                  return (
                    <td key={i} className={cn('p-2 align-top', c.state === 'absent' && 'text-muted-foreground/60', c.state === 'reduced' && mt === 'rate' && 'italic')}>
                      <span className="font-mono">{t.v}</span><span className="block text-[11px] text-muted-foreground">{t.base}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">“Ausente” = família sem indicador no recorte do eixo · “Sem base” = presente sem medições avaliáveis · itálico = base reduzida · 0% = resultado efetivamente igual a zero.</p>
    </div>
  );
}
