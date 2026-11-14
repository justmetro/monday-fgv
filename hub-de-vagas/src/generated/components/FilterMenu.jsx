import { useMemo, useState } from 'react';
import { Filter, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { distinctValues } from '@generated/lib/engine';
import { resolveField } from '@generated/lib/modules';
import { colorFor } from '@generated/lib/colors';
import { cn } from '@lib/utils';

export const ctl = 'h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function FilterMenu({ mod, state, set, items, matches }) {
  const keys = [...mod.filterKeys, ...(mod.matchFilterKeys ?? []).map((k) => `m:${k}`)];
  const [active, setActive] = useState(keys[0]);
  const field = resolveField(mod, active);
  const isMatch = active.startsWith('m:');
  const bucket = isMatch ? 'mfilters' : 'filters';
  const fkey = isMatch ? active.slice(2) : active;
  const selected = state[bucket]?.[fkey] ?? [];
  const values = useMemo(() => (field ? distinctValues(field, isMatch ? matches : items) : []), [field, isMatch, items, matches]);
  const total = Object.values(state.filters).flat().length + Object.values(state.mfilters ?? {}).flat().length;

  const toggle = (v) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    set({ [bucket]: { ...state[bucket], [fkey]: next }, presetId: null });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(ctl, 'flex items-center gap-2', total && 'border-primary/60 text-primary')}>
          <Filter className="h-4 w-4" /> Filtros{total ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{total}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,420px)] p-0">
        <div className="flex max-h-[420px]">
          <div className="w-40 shrink-0 overflow-y-auto border-r border-border py-1">
            {keys.map((k) => {
              const fl = resolveField(mod, k);
              const n = (k.startsWith('m:') ? state.mfilters?.[k.slice(2)] : state.filters[k])?.length;
              return (
                <button key={k} onClick={() => setActive(k)} className={cn('flex w-full items-center justify-between gap-1 px-3 py-2 text-left text-xs', active === k ? 'bg-accent text-accent-foreground' : 'hover:bg-muted')}>
                  <span className="truncate">{k.startsWith('m:') ? `Match · ${fl.label}` : fl.label}</span>
                  {n ? <span className="text-primary">{n}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto py-1">
            {values.length === 0 && <p className="p-3 text-xs text-muted-foreground">Sem valores.</p>}
            {values.map(({ value, count }, i) => {
              const on = selected.includes(value);
              const color = field.type === 'status' ? colorFor(field.key, value, i) : null;
              return (
                <button key={value} onClick={() => toggle(value)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted">
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>{on && <Check className="h-3 w-3" />}</span>
                  {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
                  <span className="min-w-0 flex-1 truncate" title={value}>{value}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterChips({ mod, state, set }) {
  const chips = [
    ...Object.entries(state.filters).flatMap(([k, vs]) => (vs ?? []).map((v) => ({ bucket: 'filters', k, v, label: resolveField(mod, k)?.label }))),
    ...Object.entries(state.mfilters ?? {}).flatMap(([k, vs]) => (vs ?? []).map((v) => ({ bucket: 'mfilters', k, v, label: `Match · ${mod.mfmap?.[k]?.label}` }))),
  ];
  if (!chips.length && !state.search) return null;
  const remove = (c) => set({ [c.bucket]: { ...state[c.bucket], [c.k]: state[c.bucket][c.k].filter((x) => x !== c.v) }, presetId: null });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state.search && <Chip onRemove={() => set({ search: '' })}>Busca: “{state.search}”</Chip>}
      {chips.map((c) => <Chip key={`${c.bucket}${c.k}${c.v}`} onRemove={() => remove(c)}><span className="text-muted-foreground">{c.label}:</span> {c.v}</Chip>)}
      <button onClick={() => set({ filters: {}, mfilters: {}, search: '', presetId: null })} className="px-2 text-xs text-primary hover:underline">Limpar tudo</button>
    </div>
  );
}

function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card py-0.5 pl-2.5 pr-1 text-xs">
      <span className="truncate">{children}</span>
      <button onClick={onRemove} aria-label="Remover filtro" className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted">×</button>
    </span>
  );
}
