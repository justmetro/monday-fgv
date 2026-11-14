import { useMemo, useState } from 'react';
import type { WeekSummary } from '@generated/lib/engagementMetrics';
import { formatBR } from '@generated/lib/dates';

const PAGE = 50;

export function WeeklyMatrix({ weeks }: { weeks: WeekSummary[] }) {
  const [visible, setVisible] = useState(PAGE);
  const recent = weeks.slice(-8);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    recent.forEach((w) => w.people.forEach((p) => { if (!map.has(p.key)) map.set(p.key, p.name); }));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [recent]);

  const lookup = useMemo(() => recent.map((w) => new Map(w.people.map((p) => [p.key, p]))), [recent]);

  return (
    <section className="bg-card rounded-lg soft-stack-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-normal tracking-[-0.025em] text-foreground">Progressão semana a semana</h3>
        <p className="text-xs text-muted-foreground">Último acesso registrado em cada análise · cheio = engajado (ao menos um acesso na semana, de domingo a sábado)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2.5 px-3 font-normal sticky left-0 bg-muted">Pessoa</th>
              {recent.map((w) => (
                <th key={w.weekKey} className="py-2.5 px-3 font-normal whitespace-nowrap">{w.refDate.toLocaleDateString('pt-BR')}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.slice(0, visible).map(([key, name]) => (
              <tr key={key} className="hover:bg-muted/40">
                <td className="py-2 px-3 text-foreground whitespace-nowrap sticky left-0 bg-card">{name}</td>
                {lookup.map((m, i) => {
                  const p = m.get(key);
                  const wk = recent[i]?.weekKey ?? String(i);
                  if (!p) return <td key={wk} className="py-2 px-3 text-muted-foreground">fora da base</td>;
                  return (
                    <td key={wk} className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded tabular-nums whitespace-nowrap ${p.engaged ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                        {p.lastAccess ? formatBR(p.lastAccess) : 'sem acesso'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible < people.length && (
        <div className="p-3 border-t border-border text-center">
          <button onClick={() => setVisible((v) => v + PAGE)} className="h-10 px-4 text-xs rounded border border-border hover:bg-muted text-foreground">Mostrar mais</button>
        </div>
      )}
    </section>
  );
}
