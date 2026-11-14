import { ChevronDown, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Checkbox } from '@components/ui/checkbox';
import { Slider } from '@components/ui/slider';
import { memo, useCallback, useEffect, useState } from 'react';
import { MULTI, DEFAULT_FILTERS, toScore, scoreActive, scoreLabel } from '@generated/lib/autoMatchFilters';
import { cn } from '@lib/utils';

function Multi({ label, options, value, onChange }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button disabled={!options.length} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs disabled:opacity-50', value.length ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border hover:border-primary/40')}>
          {label}{value.length > 0 && <span className="tabular-nums text-primary">{value.length}</span>}<ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-72 overflow-y-auto p-1.5">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
            <Checkbox checked={value.includes(o)} onCheckedChange={() => toggle(o)} />
            <span className="min-w-0 flex-1 truncate" title={o}>{o}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Seg({ value, onChange, items, label }) {
  return (
    <fieldset aria-label={label} className="m-0 inline-flex h-9 min-w-0 items-center rounded-full border border-border p-0.5">
      {items.map(([id, l]) => (
        <button key={id} onClick={() => onChange(id)} aria-pressed={value === id}
          className={cn('h-8 rounded-full px-3 text-xs', value === id ? 'bg-primary/15 font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
      ))}
    </fieldset>
  );
}

// Search is debounced (200 ms); the score value updates visually at once and is applied by the parent via useDeferredValue.
function FilterBar({ filters: f, setFilters, options, view, setView }) {
  const set = useCallback((patch) => setFilters((cur) => ({ ...cur, ...patch })), [setFilters]);
  const [q, setQ] = useState(f.q);
  const [score, setScore] = useState(toScore(f.minScore));
  useEffect(() => { setQ((cur) => (cur === f.q ? cur : f.q)); }, [f.q]);
  useEffect(() => { setScore(toScore(f.minScore)); }, [f.minScore]);
  useEffect(() => { if (q === f.q) return undefined; const t = setTimeout(() => set({ q }), 200); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const setMin = (v) => { const n = toScore(v); setScore(n); set({ minScore: n }); };
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Seg label="Visão" value={view} onChange={setView} items={[['vaga', 'Por vaga'], ['perfil', 'Por perfil'], ['todos', 'Todos os perfis'], ['matriz', 'Matriz 2×2']]} />
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar vaga, projeto ou perfil…" aria-label="Buscar"
            className="h-9 w-full rounded-full border border-border bg-background pl-8 pr-8 text-sm outline-none focus:border-primary/60" />
          {q && <button onClick={() => { setQ(''); set({ q: '' }); }} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {MULTI.map((m) => <Multi key={m.id} label={m.label} options={options?.[m.id] ?? []} value={f[m.id]} onChange={(v) => set({ [m.id]: v })} />)}
        <div className="flex h-9 items-center gap-2 rounded-full border border-border pl-3 pr-1">
          <span className="whitespace-nowrap text-xs tabular-nums">{scoreActive({ minScore: score, scoreDir: f.scoreDir }) ? scoreLabel({ minScore: score, scoreDir: f.scoreDir }) : <span className="text-muted-foreground">Score: sem filtro</span>}</span>
          <select value={f.scoreDir} onChange={(e) => set({ scoreDir: e.target.value })} aria-label="Direção do filtro de score" className="h-7 rounded-full border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"><option value="gte">Acima de (≥)</option><option value="lte">Abaixo de (≤)</option></select>
          <Slider className="w-28" min={0} max={100} step={5} value={[score]} onValueChange={(v) => setMin(v[0])} aria-label="Score mínimo" />
          <input type="number" min={0} max={100} step={5} value={score} onChange={(e) => setMin(e.target.value === '' ? 0 : e.target.value)} aria-label="Score mínimo (número)"
            className="h-7 w-14 rounded-full border border-border bg-background px-2 text-center text-xs tabular-nums outline-none focus:border-primary/60" />
        </div>
        <Seg label="Situação da sugestão" value={f.situacao} onChange={(v) => set({ situacao: v })} items={[['todas', 'Todas'], ['marcadas', 'Marcadas'], ['desmarcadas', 'Desmarcadas']]} />
      </div>
    </div>
  );
}
export default memo(FilterBar);

export function FilterChips({ filters: f, setFilters, card, setCard, cardLabel }) {
  const chips = [];
  if (card) chips.push({ k: 'card', l: cardLabel, rm: () => setCard(null) });
  if (f.q.trim()) chips.push({ k: 'q', l: `“${f.q.trim()}”`, rm: () => setFilters({ ...f, q: '' }) });
  MULTI.forEach((m) => f[m.id].forEach((x) => chips.push({ k: `${m.id}:${x}`, l: `${m.label}: ${x}`, rm: () => setFilters({ ...f, [m.id]: f[m.id].filter((y) => y !== x) }) })));
  if (scoreActive(f)) chips.push({ k: 'score', l: scoreLabel(f), rm: () => setFilters({ ...f, minScore: f.scoreDir === 'lte' ? 100 : 0 }) });
  if (f.situacao !== 'todas') chips.push({ k: 'sit', l: f.situacao === 'marcadas' ? 'Só marcadas' : 'Só desmarcadas', rm: () => setFilters({ ...f, situacao: 'todas' }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.k} className="inline-flex max-w-[280px] items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-3 pr-1 text-xs">
          <span className="truncate" title={c.l}>{c.l}</span>
          <button onClick={c.rm} aria-label={`Remover filtro ${c.l}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/20"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button onClick={() => { setFilters(DEFAULT_FILTERS); setCard(null); }} className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Limpar filtros</button>
    </div>
  );
}
