import { Presentation as PresentIcon, Loader2, Monitor, Sun, Moon, RefreshCw, FileDown, Search } from 'lucide-react';
import { cn } from '@lib/utils';
import { Switch } from '@components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/tooltip';
import { Segmented } from '@generated/bits';
import PeriodFilter from '@generated/PeriodFilter';
import SavedViews from '@generated/SavedViews';
import LoadInfo from '@generated/LoadInfo';

const THEME_LABEL = { auto: 'Tema: automático (clique para claro)', light: 'Tema: claro (clique para escuro)', dark: 'Tema: escuro (clique para automático)' };
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const ICON = cn(FOCUS, 'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-60');

function IconBtn({ label, children, ...rest }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><button type="button" aria-label={label} {...rest} className={ICON}>{children}</button></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** header: tabs + actions (row 1) and filters (row 2) */
export default function Header({ s }) {
  const busy = s.loading || !!s.error;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="overflow-x-auto"><Segmented value={s.tab} onChange={s.setTab} options={s.tabs} /></div>
          <LoadInfo carga={s.carga} updatedAt={s.updatedAt} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconBtn label="Buscar (Ctrl+K)" onClick={s.openSearch}><Search className="h-4 w-4" /></IconBtn>
          <IconBtn label="Atualizar dados" onClick={s.reload} disabled={s.loading || s.refetching}>
            {s.refetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </IconBtn>
          <IconBtn label={THEME_LABEL[s.theme.mode]} onClick={s.theme.cycle}>
            {s.theme.mode === 'auto' ? <Monitor className="h-4 w-4" /> : s.theme.mode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconBtn>
          <SavedViews className={ICON} current={s.viewState} onApply={s.applyView} indicators={s.nivelInd} hidden={s.hidden} setHidden={s.setHidden} />
          <button type="button" disabled={busy || !!s.pdf || !s.slideCount} onClick={s.exportPdf}
            className={cn(FOCUS, 'inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60')}>
            {s.pdf ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF {s.pdf.n}/{s.pdf.total}…</> : <><FileDown className="h-4 w-4" /> Exportar PDF</>}
          </button>
          <button type="button" disabled={busy} onClick={s.present}
            className={cn(FOCUS, 'group inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-transform active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100')}>
            <PresentIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" /> Apresentar
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Nível" value={s.nivel} onChange={s.setNivel} options={[['tat', 'Táticos'], ['op', 'Operacionais'], ['all', 'Todos']]} />
        <PeriodFilter f={s.f} onChange={s.setFiltro} years={s.years} lastClosed={s.lastClosed} partialMonths={s.partialMonths} />
        <span className="text-sm font-semibold text-[hsl(var(--goal))]">{s.f.label}</span>
        {s.tab === 'report' && (
          <div className="ml-1 flex items-center gap-2 text-sm text-[hsl(var(--goal))]">
            <Switch id="alerts-screen" checked={s.showAlerts} onCheckedChange={s.setShowAlerts} /><label htmlFor="alerts-screen">Mostrar alertas</label>
          </div>
        )}
      </div>
    </header>
  );
}
