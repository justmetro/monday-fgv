import { useState, type ReactNode } from 'react';
import type { GroupStat } from '@generated/lib/intel-stats';
import { evalOf } from '@generated/lib/intel-stats';
import type { Alert, Insight } from '@generated/lib/intel-insights';
import { cn } from '@lib/utils';

export const fp = (n: number | null) => (n === null ? 'Sem base avaliável' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
export const fdate = (s: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString('pt-BR') : '—');

export function GroupTable({ rows, limit = 12, presenceLabel, showParent }: { rows: GroupStat[]; limit?: number; presenceLabel: string; showParent?: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2">Agrupamento</th><th className="p-2 text-right">Projetos · {presenceLabel}</th><th className="p-2 text-right">Indic.</th><th className="p-2 text-right">Medições</th>
              <th className="p-2 text-right">Avaliáveis</th><th className="p-2 text-right">Alcançadas (B)</th><th className="p-2 text-right">Não alc. (C)</th><th className="p-2 text-right">Atrasadas (D)</th>
              <th className="p-2 text-right">Taxa c/ atrasos</th><th className="p-2 text-right">Entre concluídas</th><th className="p-2 text-right">Média p/ projeto</th><th className="p-2">Base</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.length === 0 && <tr><td colSpan={12} className="p-3 text-center text-muted-foreground">Sem dados no recorte.</td></tr>}
            {shown.map((g) => (
              <tr key={`${g.parent}-${g.name}`} className="align-top">
                <td className="p-2"><p className="font-medium">{g.name}</p>{showParent && g.parent && <p className="text-xs text-muted-foreground">{g.parent}</p>}<p className="text-xs text-muted-foreground">Ex.: {g.examples.map((e) => `${e.ind} (${e.proj})`).join('; ')}</p></td>
                <td className="p-2 text-right font-mono">{g.projectIds.length}<span className="block text-xs text-muted-foreground">{fp(g.presencePct)} de {g.denom}</span></td>
                <td className="p-2 text-right font-mono">{g.indicators}</td>
                <td className="p-2 text-right font-mono">{g.meds}</td>
                <td className="p-2 text-right font-mono">{evalOf(g.counts)}</td>
                <td className="p-2 text-right font-mono">{g.counts.B}</td>
                <td className="p-2 text-right font-mono">{g.counts.C}</td>
                <td className="p-2 text-right font-mono">{g.counts.D}</td>
                <td className="p-2 text-right font-mono">{fp(g.rate)}</td>
                <td className="p-2 text-right font-mono">{fp(g.rateConcl)}</td>
                <td className="p-2 text-right font-mono">{fp(g.projMean)}<span className="block text-xs text-muted-foreground">{g.projMeanN} proj.</span></td>
                <td className="p-2 text-xs">{g.eligible ? 'Destaque' : evalOf(g.counts) === 0 ? 'Sem base avaliável' : 'Base reduzida'}{g.topShare && g.topShare.share >= 60 && g.projectIds.length > 1 && <span className="block text-[hsl(var(--warn))]">{fp(g.topShare.share)} em {g.topShare.project}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <button onClick={() => setAll(!all)} className="min-h-9 text-sm text-primary">{all ? 'Mostrar menos' : `Mostrar todos (${rows.length})`}</button>}
    </div>
  );
}

export function RankList({ title, rows, tone }: { title: string; rows: GroupStat[]; tone: 'ok' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-3">
      <h4 className={cn('text-sm font-medium', tone === 'ok' ? 'text-[hsl(var(--ok))]' : 'text-destructive')}>{title}</h4>
      {rows.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nenhum agrupamento atinge os mínimos.</p> : (
        <ol className="mt-2 space-y-1.5 text-sm">
          {rows.map((g) => (
            <li key={`${g.parent}-${g.name}`} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">{g.name}{g.parent && <span className="block text-xs text-muted-foreground">{g.parent}</span>}</span>
              <span className="shrink-0 text-right font-mono">{fp(g.rate)}<span className="block text-xs text-muted-foreground">{g.counts.B}/{evalOf(g.counts)} · {g.counts.D} atras. · {g.projectIds.length} proj.</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function InsightList({ items }: { items: Insight[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nenhum achado atende aos critérios no recorte.</p>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((x, i) => (
        <li key={i} className="rounded-md border border-border p-3 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{x.tipo}{x.eixo ? ` · ${x.eixo}` : ''}</p>
          <p className="mt-1 font-medium">{x.achado}</p>
          <p className="mt-1 font-mono text-xs">{x.evidencia}</p>
          {x.envolvidos.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Envolvidos: {x.envolvidos.slice(0, 6).join('; ')}{x.envolvidos.length > 6 ? ` e mais ${x.envolvidos.length - 6}` : ''}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Limitação: {x.limitacao}</p>
          <p className="mt-1 text-xs text-primary">→ {x.pergunta}</p>
        </li>
      ))}
    </ul>
  );
}

export function AlertList({ items }: { items: Alert[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Sem alertas.</p>;
  return <ul className="space-y-1 text-sm">{items.slice(0, 30).map((a, i) => <li key={i}><b className="font-medium">{a.tipo}:</b> {a.texto} <span className="text-muted-foreground">({a.envolvidos.join('; ')})</span></li>)}</ul>;
}

export function Block({ title, children, sub }: { title: string; sub?: string; children: ReactNode }) {
  return <section className="space-y-3 rounded-lg border border-border bg-card p-4"><div><h2 className="text-lg font-semibold">{title}</h2>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>{children}</section>;
}
