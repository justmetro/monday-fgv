import { useState } from 'react';
import { ExternalLink, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@lib/utils';
import ItemLink from '@generated/ItemLink';

const KEY = 'indicadores-qualidade-recolhidas';
const DEFAULT_COLLAPSED = {};
const load = () => { try { return { ...DEFAULT_COLLAPSED, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULT_COLLAPSED }; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { console.error(e); } };

export default function QualityView({ issues }) {
  const [collapsed, setCollapsed] = useState(load);
  const groups = issues.reduce((acc, x) => { (acc[x.tipo] ??= []).push(x); return acc; }, {});
  const update = (next) => { setCollapsed(next); save(next); };
  const setAll = (v) => update(Object.fromEntries(Object.keys(groups).map((k) => [k, v])));
  if (!issues.length) return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-[hsl(var(--ok-ink))]"><CheckCircle2 className="h-5 w-5" /> Nenhuma pendência de dados encontrada.</div>
  );
  const btn = 'h-9 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted';
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button className={btn} onClick={() => setAll(true)}>Recolher tudo</button>
        <button className={btn} onClick={() => setAll(false)}>Expandir tudo</button>
      </div>
      {Object.entries(groups).map(([tipo, list]) => {
        const closed = !!collapsed[tipo];
        return (
          <section key={tipo} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button type="button" aria-expanded={!closed} onClick={() => update({ ...collapsed, [tipo]: !closed })}
              className={cn('flex w-full items-center gap-2 bg-muted/50 px-4 py-3 text-left hover:bg-muted', !closed && 'border-b border-border')}>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', closed && '-rotate-90')} />
              <h2 className="flex-1 text-sm font-bold">{tipo}</h2>
              <span className="rounded-full bg-[hsl(var(--below))] px-2 text-xs font-bold text-[hsl(var(--on-solid))]">{list.length.toLocaleString("pt-BR")}</span>
            </button>
            {!closed && (
              <ul className="divide-y divide-border">
                {list.map((x) => (
                  <li key={x.key} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-14 shrink-0 font-bold">{x.code ?? '—'}</span>
                    <span className="min-w-0 flex-1 truncate">{x.nome}{x.periodo && <span className="text-[hsl(var(--goal))]"> · {x.periodo}</span>}</span>
                    <span className="text-xs text-[hsl(var(--goal))]">{x.detalhe}</span>
                    <ItemLink board={x.board} view={x.view} id={x.id} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted">
                      {x.view === "ind" ? "Ver na tabela INDICADORES" : x.view === "med" ? "Ver na tabela MEDIÇÃO" : "Abrir no monday"} <ExternalLink className="h-3.5 w-3.5" />
                    </ItemLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
