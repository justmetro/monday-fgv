import { useState } from 'react';
import { Bookmark, Pencil, Trash2, Eye, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem,
} from '@components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@components/ui/dialog';

const KEY = 'indicadores-visualizacoes';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { console.error(e); toast.error('Não foi possível salvar no navegador.'); return false; } };

/** "Visualizações" menu: save current report state, reopen, rename, delete; choose visible indicators */
export default function SavedViews({ current, onApply, indicators, hidden, setHidden, className }) {
  const [views, setViews] = useState(read);
  const [dlg, setDlg] = useState(null); // { mode: 'new' | 'rename', id?, name }
  const persist = (next) => { if (write(next)) setViews(next); };
  const submit = () => {
    const name = dlg.name.trim();
    if (!name) return;
    if (dlg.mode === 'new') { persist([...views, { id: String(Date.now()), name, state: current }]); toast.success(`Visualização "${name}" salva`); }
    else persist(views.map((v) => (v.id === dlg.id ? { ...v, name } : v)));
    setDlg(null);
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Visualizações salvas" className={className}><Bookmark className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => setDlg({ mode: 'new', name: '' })}><Save className="h-4 w-4" /> Salvar visualização…</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Eye className="h-4 w-4" /> Indicadores visíveis</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
              {indicators.map((i) => (
                <DropdownMenuCheckboxItem key={i.id} checked={!hidden.includes(i.id)} onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) => setHidden(on ? hidden.filter((x) => x !== i.id) : [...hidden, i.id])}>
                  <span className="font-semibold">{i.code}</span>&nbsp;<span className="truncate">{i.curto}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Visualizações salvas</DropdownMenuLabel>
          {!views.length && <p className="px-2 pb-2 text-xs text-muted-foreground">Nenhuma ainda.</p>}
          {views.map((v) => (
            <DropdownMenuSub key={v.id}>
              <DropdownMenuSubTrigger><span className="truncate">{v.name}</span></DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => { onApply(v.state); toast.success(`"${v.name}" aberta`); }}><Bookmark className="h-4 w-4" /> Abrir</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDlg({ mode: 'rename', id: v.id, name: v.name })}><Pencil className="h-4 w-4" /> Renomear</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => persist(views.filter((x) => x.id !== v.id))}><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dlg?.mode === 'rename' ? 'Renomear visualização' : 'Salvar visualização'}</DialogTitle>
            <DialogDescription>Guarda o filtro de período (granularidade, período e ano base), nível, alertas e indicadores visíveis.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label htmlFor="view-name" className="text-sm font-medium">Nome</label>
            <input id="view-name" value={dlg?.name ?? ''} onChange={(e) => setDlg({ ...dlg, name: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm" placeholder="Ex.: Relatório 3º trimestre" />
            <DialogFooter className="mt-4">
              <button type="submit" disabled={!dlg?.name?.trim()} className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">Salvar</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
