import { MonitorSmartphone, Sun, Moon } from 'lucide-react';
import { cn } from '@lib/utils';

const OPTS = [
  { id: 'auto', label: 'Automático (monday)', short: 'Auto', icon: MonitorSmartphone },
  { id: 'light', label: 'Claro', short: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', short: 'Escuro', icon: Moon },
];

export default function ThemeToggle({ mode, setMode }) {
  return (
    <div aria-label="Tema" className="flex rounded-full border border-border bg-card p-0.5">
      {OPTS.map(({ id, label, short, icon: Icon }) => (
        <button key={id} aria-pressed={mode === id} title={label} onClick={() => setMode(id)}
          className={cn('flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mode === id ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{short}</span>
        </button>
      ))}
    </div>
  );
}
