import { useEffect } from 'react';
import { BarChart3, CalendarDays, FolderKanban, FileDown, Monitor, Presentation, RefreshCw, ShieldAlert } from 'lucide-react';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from '@components/ui/command';
import { MESES_LONGOS } from '@generated/lib';

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/** Ctrl+K / Cmd+K — ignored while typing in an input/textarea */
export function useCommandShortcut(setOpen) {
  useEffect(() => {
    const on = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !isTyping(document.activeElement)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [setOpen]);
}

export default function CommandPalette({ open, setOpen, ind, year, months, projects = [], onIndicator, onProject, onMonthReport, actions }) {
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Busca rápida" description="Indicadores, meses e ações">
      <CommandInput placeholder="Buscar indicador, código, projeto ou ação…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Indicadores">
          {ind.map((i) => (
            <CommandItem key={i.id} value={`${i.code} ${i.curto}`} onSelect={run(() => onIndicator(i))}>
              <BarChart3 className="h-4 w-4" /><span className="font-semibold">{i.code}</span><span className="truncate">{i.curto}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {projects.length > 0 && (
          <CommandGroup heading="Projetos (02.01)">
            {projects.map((p) => (
              <CommandItem key={p.id} value={`projeto ${p.name}`} onSelect={run(() => onProject(p))}>
                <FolderKanban className="h-4 w-4" /><span className="truncate">{p.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Meses">
          {months.map((m) => (
            <CommandItem key={`r${m}`} value={`mensal ${MESES_LONGOS[m]} ${year}`} onSelect={run(() => onMonthReport(m))}>
              <CalendarDays className="h-4 w-4" /> Mensal · {MESES_LONGOS[m]}/{year} na Visão relatório
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Ações">
          <CommandItem value="apresentar" onSelect={run(actions.present)}><Presentation className="h-4 w-4" /> Apresentar</CommandItem>
          <CommandItem value="exportar pdf" onSelect={run(actions.pdf)}><FileDown className="h-4 w-4" /> Exportar PDF</CommandItem>
          <CommandItem value="atualizar dados" onSelect={run(actions.reload)}><RefreshCw className="h-4 w-4" /> Atualizar dados</CommandItem>
          <CommandItem value="alternar tema" onSelect={run(actions.theme)}><Monitor className="h-4 w-4" /> Alternar tema</CommandItem>
          <CommandItem value="qualidade dos dados" onSelect={run(actions.quality)}><ShieldAlert className="h-4 w-4" /> Abrir Qualidade dos dados<CommandShortcut>{actions.issues || ''}</CommandShortcut></CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
