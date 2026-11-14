import { Zap, LayoutDashboard, Briefcase, Users, Search, RefreshCw, Loader2, Wand2 } from 'lucide-react';
import { cn } from '@lib/utils';
import { GlowDot } from '@generated/components/Pill';

export const NAV = [
  { id: 'today', label: 'Ação hoje', icon: Zap },
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'vagas', label: 'Vagas & Matches', icon: Briefcase },
  { id: 'perfis', label: 'Perfis para Realocação', icon: Users },
  { id: 'automatch', label: 'Match Automático', icon: Wand2 },
];

function ago(date, now) {
  if (!date) return 'carregando…';
  const min = Math.floor((now - date) / 60000);
  if (min < 1) return 'atualizado agora';
  if (min < 60) return `atualizado há ${min} min`;
  return `atualizado há ${Math.floor(min / 60)} h`;
}

export default function Sidebar({ active, onNav, counts, onSearch, onRefresh, refetching, updatedAt, now }) {
  return (
    <aside className="flex shrink-0 flex-col gap-1 border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4 md:block">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-primary"><GlowDot /> Ao vivo</div>
          <h1 className="mt-1 text-base font-medium leading-tight">Hub de Realocação,<br className="hidden md:block" /> Vagas e Progressão</h1>
        </div>
        <button onClick={onSearch} className="mt-0 flex h-10 items-center gap-2 rounded-full border border-sidebar-border bg-background/60 px-3 text-sm text-muted-foreground hover:text-foreground md:mt-4 md:w-full">
          <Search className="h-4 w-4" /><span className="hidden sm:inline">Buscar</span>
          <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] md:inline">Ctrl K</kbd>
        </button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pt-2">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onNav(id)}
            className={cn('flex h-10 shrink-0 items-center gap-3 rounded-full px-3 text-sm transition-colors',
              active === id ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[var(--glow-stack)]' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground')}>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            <span className="whitespace-nowrap">{label}</span>
            {counts?.[id] != null && <span className="ml-auto hidden text-xs tabular-nums text-muted-foreground md:inline">{counts[id]}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-auto hidden items-center justify-between gap-2 border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground md:flex">
        <span>{ago(updatedAt, now)}</span>
        <button onClick={onRefresh} disabled={refetching} aria-label="Atualizar dados" className="flex h-8 w-8 items-center justify-center rounded-full border border-sidebar-border hover:text-foreground disabled:opacity-50">
          {refetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>
    </aside>
  );
}

export { ago };
