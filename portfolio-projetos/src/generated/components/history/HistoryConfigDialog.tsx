import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { listBoards, listWorkspaces } from '@generated/server/importer';
import { inspectHistoryBoard, saveHistoryConfig } from '@generated/server/history';

type Info = Awaited<ReturnType<typeof inspectHistoryBoard>>;
type Opt = { id: string; name: string };

const selCls = 'h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm';

function ColSel({ label, hint, value, cols, onChange, optional }: { label: string; hint?: string; value: string | null; cols: Info['columns']; onChange: (v: string | null) => void; optional?: boolean }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium">{label}{optional && <span className="font-normal text-muted-foreground"> · opcional</span>}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={selCls}>
        <option value="">{optional ? 'Não mapear (extrair do nome)' : 'Não mapeada'}</option>
        {cols.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.type}</option>)}
      </select>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function HistoryConfigDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [ws, setWs] = useState<Opt[]>([]);
  const [wsId, setWsId] = useState('');
  const [boards, setBoards] = useState<Opt[]>([]);
  const [ref, setRef] = useState('');
  const [info, setInfo] = useState<Info | null>(null);
  const [map, setMap] = useState<Info['suggested']>({ statusCol: null, managerCol: null, axesCol: null, codeCol: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    listWorkspaces({ data: {} }).then((r) => setWs(r ?? [])).catch((e) => console.error(e));
  }, [open]);
  useEffect(() => {
    if (!wsId) return setBoards([]);
    listBoards({ data: { workspaceId: wsId } }).then((r) => setBoards(r ?? [])).catch((e) => { console.error(e); setBoards([]); });
  }, [wsId]);

  const inspect = async (r: string) => {
    if (!r.trim()) return;
    setBusy(true); setErr(null); setInfo(null);
    try { const x = await inspectHistoryBoard({ data: { ref: r.trim() } }); setInfo(x); setMap(x.suggested); }
    catch (e) { console.error(e); setErr(e instanceof Error ? e.message : 'Não foi possível acessar o quadro.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!info) return;
    setBusy(true);
    try {
      await saveHistoryConfig({ data: { boardId: info.id, boardName: info.name, boardUrl: info.url, ...map } });
      toast.success('Histórico de Projetos configurado', { description: 'Use "Buscar correspondências pendentes" para revisar os vínculos.' });
      onSaved(); onOpenChange(false);
    } catch (e) { console.error(e); toast.error('Não foi possível salvar a configuração.'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar Histórico de Projetos</DialogTitle>
          <DialogDescription>Fonte complementar de cadastro. Somente leitura: nada é escrito no quadro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium">Área de trabalho</span>
              <select value={wsId} onChange={(e) => setWsId(e.target.value)} className={selCls}>
                <option value="">Selecione</option>{ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium">Quadro</span>
              <select disabled={!wsId} value="" onChange={(e) => { setRef(e.target.value); void inspect(e.target.value); }} className={selCls}>
                <option value="">{wsId ? 'Selecione o quadro' : '—'}</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ou informe o ID / URL do quadro" aria-label="ID ou URL do quadro" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
            <button onClick={() => void inspect(ref)} disabled={busy || !ref.trim()} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm disabled:opacity-50">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Validar acesso
            </button>
          </div>
          {err && <p className="rounded-md bg-[hsl(var(--bad-soft))] p-3 text-sm text-destructive">{err}</p>}
          {info && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm"><b>{info.name}</b> <span className="text-muted-foreground">· {info.workspaceName} · {info.columns.length} colunas</span></p>
              <p className="text-xs text-muted-foreground">Nome do elemento → nome do projeto no Histórico.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ColSel label="Status do Projeto" value={map.statusCol} cols={info.columns} onChange={(v) => setMap({ ...map, statusCol: v })} />
                <ColSel label="Gerente" value={map.managerCol} cols={info.columns} onChange={(v) => setMap({ ...map, managerCol: v })} />
                <ColSel label="Eixo(s) de atuação" value={map.axesCol} cols={info.columns} onChange={(v) => setMap({ ...map, axesCol: v })} />
                <ColSel label="Código do projeto" optional hint="Se mapeada, tem prioridade; divergências com o nome são sinalizadas." value={map.codeCol} cols={info.columns} onChange={(v) => setMap({ ...map, codeCol: v })} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="min-h-10 rounded-md border border-border px-4 text-sm">Cancelar</button>
          <button onClick={() => void save()} disabled={!info || busy} className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Salvar configuração</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
