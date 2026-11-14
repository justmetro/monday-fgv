import { useState } from 'react';
import { Search, Table2, LayoutGrid, Columns3, GanttChart, Sparkles, Bookmark, Trash2, Download, ChevronsDown, ChevronsUp, SlidersHorizontal, Grid3x3 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import FilterMenu, { ctl } from '@generated/components/FilterMenu';
import { resolveField, VAGA_GROUP } from '@generated/lib/modules';
import { cn } from '@lib/utils';

const VIEWS = [
  { id: 'table', label: 'Tabela', icon: Table2 },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
  { id: 'timeline', label: 'Linha do tempo', icon: GanttChart },
  { id: 'matrix', label: 'Matriz', icon: Grid3x3, only: 'vagas' },
];

export default function ControlBar({ mod, state, set, onPreset, saved, onApplySaved, items, matches, onExpand, onCollapse, onExport }) {
  const [name, setName] = useState('');
  const [g1, g2] = state.groupBy ?? [];
  const label = (k) => resolveField(mod, k)?.label ?? k;
  const setGroup = (i, v) => {
    const next = [g1 ?? '', g2 ?? ''];
    next[i] = v;
    if (next[0] === VAGA_GROUP || !next[0]) next[1] = '';
    if (next[1] === next[0]) next[1] = '';
    set({ groupBy: next.filter(Boolean), presetId: null });
  };
  const cols = state.columns ?? mod.defaultColumns;
  const mine = saved.views.filter((v) => v.module === mod.id);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(ctl, 'flex items-center gap-2 border-primary/40 shadow-[var(--glow-stack)]')}><Sparkles className="h-4 w-4 text-primary" /> Atalhos</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Visualizações prontas</DropdownMenuLabel>
            {mod.presets.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => onPreset(p.id)} className="flex-col items-start gap-0">
                <span className={cn('text-sm', state.presetId === p.id && 'font-medium text-primary')}>{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild><button className={cn(ctl, 'flex items-center gap-2')}><Bookmark className="h-4 w-4" /> Minhas visualizações</button></PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { saved.save(name.trim(), mod.id, state); setName(''); } }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da visualização" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
              <button type="submit" disabled={!name.trim()} className="h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">Salvar</button>
            </form>
            <div className="mt-3 space-y-1">
              {mine.length === 0 && <p className="text-xs text-muted-foreground">Salve a combinação atual de agrupamentos e filtros para reutilizar depois.</p>}
              {mine.map((v) => (
                <div key={v.id} className="flex items-center gap-1">
                  <button onClick={() => onApplySaved(v)} className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted">{v.name}</button>
                  
                  <button onClick={() => saved.remove(v.id)} aria-label="Excluir" className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex rounded-full border border-input bg-background p-0.5">
          {VIEWS.filter((v) => !v.only || v.only === mod.id).map(({ id, label: l, icon: Icon }) => (
            <button key={id} onClick={() => set({ view: id })} title={l} aria-label={l}
              className={cn('flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs', state.view === id ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className="h-4 w-4" /><span className="hidden lg:inline">{l}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={state.search} onChange={(e) => set({ search: e.target.value })} placeholder={mod.id === 'vagas' ? 'Buscar vaga, projeto ou pessoa' : 'Buscar'} className={cn(ctl, 'w-full pl-9')} />
        </label>
        <FilterMenu mod={mod} state={state} set={set} items={items} matches={matches} />
        {(state.view === 'table' || state.view === 'cards') && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Agrupar por
            <select value={g1 ?? ''} onChange={(e) => setGroup(0, e.target.value)} className={cn(ctl, 'max-w-[190px]')}>
              <option value="">Nenhum</option>
              {mod.groupOptions.map((k) => <option key={k} value={k}>{label(k)}</option>)}
            </select>
            {g1 && g1 !== VAGA_GROUP && (
              <>→<select value={g2 ?? ''} onChange={(e) => setGroup(1, e.target.value)} className={cn(ctl, 'max-w-[190px]')}>
                <option value="">Nenhum</option>
                {mod.groupOptions.filter((k) => k !== g1).map((k) => <option key={k} value={k}>{label(k)}</option>)}
              </select></>
            )}
          </span>
        )}
        {state.view === 'kanban' && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">Colunas por
            <select value={state.kanbanBy ?? mod.kanbanKeys[0]} onChange={(e) => set({ kanbanBy: e.target.value })} className={ctl}>
              {mod.kanbanKeys.map((k) => <option key={k} value={k}>{k.startsWith('m:') ? `Match · ${label(k)}` : label(k)}</option>)}
            </select>
          </span>
        )}
        {state.view === 'timeline' && mod.id !== 'vagas' && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">Data
            <select value={state.dateKey ?? mod.dateKeys[0]} onChange={(e) => set({ dateKey: e.target.value })} className={ctl}>
              {mod.dateKeys.map((k) => <option key={k} value={k}>{label(k)}</option>)}
            </select>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {state.view === 'table' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button className={cn(ctl, 'flex items-center gap-1.5')} aria-label="Colunas"><SlidersHorizontal className="h-4 w-4" /><span className="hidden xl:inline">Colunas</span></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-y-auto">
                <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {mod.fields.filter((fl) => fl.key !== 'temDias').map((fl) => (
                  <DropdownMenuCheckboxItem key={fl.key} checked={cols.includes(fl.key)} disabled={fl.key === 'name'} onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(on) => set({ columns: on ? mod.fields.map((x) => x.key).filter((k) => k === fl.key || cols.includes(k)) : cols.filter((k) => k !== fl.key) })}>
                    {fl.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button onClick={onExpand} className={cn(ctl, 'px-2.5')} title="Expandir tudo" aria-label="Expandir tudo"><ChevronsDown className="h-4 w-4" /></button>
          <button onClick={onCollapse} className={cn(ctl, 'px-2.5')} title="Recolher tudo" aria-label="Recolher tudo"><ChevronsUp className="h-4 w-4" /></button>
          <button onClick={onExport} className={cn(ctl, 'flex items-center gap-1.5')}><Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button>
        </div>
      </div>
    </div>
  );
}
