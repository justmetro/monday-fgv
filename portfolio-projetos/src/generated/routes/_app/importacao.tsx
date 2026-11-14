import { useCallback, useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink, Loader2, Plus, RefreshCw, Search, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteProject, getSyncLogs, listProjects, refreshProject, setProjectEnabled } from '@generated/server/importer';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { fmtDateTime } from '@generated/lib/format';
import { ImportWizard } from '@generated/components/import/ImportWizard';
import { norm, parseConfig, type GroupKey } from '@generated/lib/fields';
import { stagesOf, type SubMode } from '@generated/lib/stages';
import { runSubitemParts } from '@generated/components/import/subparts';
import { GroupChips } from '@generated/components/import/GroupChips';
import { TokenCard } from '@generated/components/import/TokenCard';
import { ErrorBox } from '@generated/components/States';
import { DailyLog } from '@generated/components/import/DailyLog';
import { Skeleton } from '@components/ui/skeleton';
import { Switch } from '@components/ui/switch';
import { cn } from '@lib/utils';
import { getHistoryConfig } from '@generated/server/history';
import { HistorySection } from '@generated/components/history/HistorySection';
import { ProjectHistoryMeta } from '@generated/components/history/ProjectHistoryMeta';
import { ManualLinkDialog } from '@generated/components/history/ManualLinkDialog';

export const Route = createFileRoute('/_app/importacao')({ component: ImportPage });

type Project = Awaited<ReturnType<typeof listProjects>>[number];
type Log = Awaited<ReturnType<typeof getSyncLogs>>[number];

const STATUS: Record<string, { label: string; cls: string }> = {
  ok: { label: 'Sincronizado', cls: 'bg-[hsl(var(--ok-soft))] text-[hsl(var(--ok))]' },
  error: { label: 'Falha na última atualização', cls: 'bg-[hsl(var(--bad-soft))] text-destructive' },
  running: { label: 'Em atualização', cls: 'bg-[hsl(var(--warn-soft))] text-[hsl(var(--warn))]' },
  never: { label: 'Não sincronizado', cls: 'bg-muted text-muted-foreground' },
};

function ImportPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState<{ boardId?: string } | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const [logs, setLogs] = useState<{ boardId: string; rows: Log[] } | null>(null);
  const [pq, setPq] = useState('');
  const [hCfg, setHCfg] = useState<Awaited<ReturnType<typeof getHistoryConfig>>>(null);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const shownItems = pq.trim() ? items.filter((p) => norm(p.name).includes(norm(pq)) || norm(p.workspaceName).includes(norm(pq))) : items;

  const load = useCallback(async () => {
    setError(null);
    getHistoryConfig({ data: {} }).then((c) => setHCfg(c ?? null)).catch((e) => console.error(e));
    try { setItems((await listProjects({ data: {} })) ?? []); }
    catch (e) { console.error(e); setError('Não foi possível carregar os projetos importados.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = async () => {
    if (!toDelete) return;
    const prev = items;
    const target = toDelete;
    setDeleting(true);
    setItems((s) => s.filter((p) => p.boardId !== target.boardId));
    try {
      const r = await deleteProject({ data: { boardId: target.boardId } });
      toast.success('Projeto excluído do aplicativo', { description: `${r.indicadores} indicadores e ${r.medicoes} medições removidos. O quadro de origem não foi alterado.` });
      setToDelete(null);
    } catch (e) {
      console.error(e);
      setItems(prev);
      toast.error('Não foi possível excluir o projeto. Tente novamente.');
    } finally { setDeleting(false); }
  };

  /** Atualiza em etapas (um grupo por requisição) para não exceder o tempo limite do servidor. */
  const staged = async (boardId: string, groups?: GroupKey[]) => {
    const p = items.find((x) => x.boardId === boardId);
    const cfg = parseConfig(p?.config);
    const list = p?.noIndicators || !cfg ? [] : stagesOf(cfg, groups);
    // Projeto sem indicador elaborado / sem configuração: uma única chamada (o servidor decide).
    const stages: { groups?: GroupKey[]; subMode?: SubMode }[] = list.length ? list : [{ groups }];
    const parts: string[] = [];
    let ok = true;
    let history: { ok: boolean; summary: string } | null = null;
    // Cadastro do Histórico só na última etapa comum (uma vez por projeto).
    const lastCommon = stages.map((s) => s.subMode !== 'only').lastIndexOf(true);
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i]!;
      if (s.subMode === 'only') {
        const sr = await runSubitemParts(boardId, null);
        parts.push(`Subelementos: ${sr.summary}`);
        if (!sr.ok) { ok = false; break; }
        continue;
      }
      const r = await refreshProject({ data: { boardId, groups: s.groups, subMode: s.subMode, history: i === lastCommon } });
      parts.push(r.summary);
      if (r.history) history = r.history;
      if (!r.ok) { ok = false; break; }
    }
    return { ok, summary: parts.join(' · '), history };
  };

  const refresh = async (boardId: string, groups?: GroupKey[]) => {
    setBusy((s) => new Set(s).add(boardId));
    try {
      const r = await staged(boardId, groups);
      const desc = `${r.summary}${r.history ? ` · Cadastro do projeto: ${r.history.summary}` : ''}`;
      if (r.ok && (!r.history || r.history.ok)) toast.success('Dados atualizados', { description: desc });
      else if (r.ok || r.history?.ok) toast.warning('Atualização parcial', { description: desc });
      else toast.error('A atualização falhou', { description: desc });
    } catch (e) { console.error(e); toast.error('A atualização falhou. Os dados anteriores foram preservados.'); }
    finally { setBusy((s) => { const n = new Set(s); n.delete(boardId); return n; }); void load(); }
  };

  const toggleEnabled = async (boardId: string, enabled: boolean) => {
    const prev = items;
    setItems((l) => l.map((p) => (p.boardId === boardId ? { ...p, enabled } : p)));
    try { await setProjectEnabled({ data: { boardId, enabled } }); }
    catch (e) { console.error(e); setItems(prev); toast.error('Não foi possível alterar a situação do projeto.'); }
  };

  const refreshEverything = async () => {
    setAll(true);
    try {
      // Um projeto por requisição, para não exceder o tempo limite do servidor.
      const r: { name: string; ok: boolean }[] = [];
      for (const p of items) {
        setBusy((s) => new Set(s).add(p.boardId));
        try {
          const x = await staged(p.boardId);
          r.push({ name: p.name, ok: !!x?.ok && (!x.history || x.history.ok) });
        } catch (e) { console.error(e); r.push({ name: p.name, ok: false }); }
        finally { setBusy((s) => { const n = new Set(s); n.delete(p.boardId); return n; }); }
      }
      const fails = r.filter((x) => !x.ok);
      if (fails.length) toast.error(`${fails.length} de ${r.length} projeto(s) falharam`, { description: fails.map((f) => f.name).join('; ') });
      else toast.success(`${r.length} projeto(s) atualizados com sucesso`);
    } catch (e) { console.error(e); toast.error('Não foi possível concluir a atualização geral.'); }
    finally { setAll(false); void load(); }
  };

  const showLogs = async (boardId: string) => {
    if (logs?.boardId === boardId) return setLogs(null);
    try { setLogs({ boardId, rows: (await getSyncLogs({ data: { boardId } })) ?? [] }); }
    catch (e) { console.error(e); toast.error('Não foi possível carregar o histórico.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Importação e atualização</h1>
          <p className="mt-1 text-sm text-muted-foreground">Leitura somente da Monday para o aplicativo. Nada é escrito nos quadros de origem.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DailyLog />
          <button onClick={() => void refreshEverything()} disabled={all || items.length === 0} className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50">
            <RefreshCw className={cn('size-4', all && 'animate-spin')} aria-hidden />Atualizar todos os projetos
          </button>
          <button onClick={() => setWizard({})} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Plus className="size-4" aria-hidden />Importar projeto
          </button>
        </div>
      </div>
      <TokenCard />
      <HistorySection cfg={hCfg} projects={items} onChanged={() => void load()} onManual={setLinkFor} />
      <ManualLinkDialog project={items.find((p) => p.boardId === linkFor) ?? null} all={items} onClose={() => setLinkFor(null)} onDone={() => void load()} />
      {wizard && <ImportWizard key={wizard.boardId ?? 'new'} initialBoardId={wizard.boardId} onCancel={() => setWizard(null)} onDone={() => { setWizard(null); void load(); }} />}
      {error && <ErrorBox message={error} onRetry={() => void load()} />}
      {items.length > 0 && (
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Pesquisar projeto pelo nome" aria-label="Pesquisar projeto" className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm" />
        </label>
      )}
      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div> : items.length === 0 && !wizard ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum projeto importado. Clique em <b className="text-foreground">Importar projeto</b> para selecionar a área de trabalho e o quadro.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {shownItems.length === 0 && <li className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">Nenhum projeto encontrado para "{pq}".</li>}
          {shownItems.map((p) => {
            const st = STATUS[busy.has(p.boardId) ? 'running' : p.syncStatus] ?? STATUS.never;
            return (
              <li key={p.boardId} className="p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium leading-snug">{p.name}</h3>
                      <span className={cn('rounded-sm px-1.5 py-0.5 text-[11px]', st?.cls)}>{st?.label}</span>
                      {p.noIndicators && <span className="rounded-sm bg-[hsl(var(--warn-soft))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--warn))]">Sem indicador elaborado</span>}
                      {p.enabled === false && <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Fora do painel e panorama</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.workspaceName} · <span className="font-mono">{p.indicatorCount}</span> indicadores · <span className="font-mono">{p.measurementCount}</span> medições · última atualização bem-sucedida <span className="font-mono">{fmtDateTime(p.lastSuccessAt)}</span>
                    </p>
                    <p className={cn('mt-1 text-xs', p.syncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{p.syncMessage}</p>
                    <GroupChips p={p} busy={busy.has(p.boardId) || all} onConfigure={() => setWizard({ boardId: p.boardId })} onRefresh={(g) => void refresh(p.boardId, [g])} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm">
                      <Switch checked={p.enabled !== false} onCheckedChange={(v) => void toggleEnabled(p.boardId, v)} aria-label="Incluir no painel" />
                      Incluir no painel
                    </label>
                    <button onClick={() => void refresh(p.boardId)} disabled={busy.has(p.boardId) || all} className="flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">
                      {busy.has(p.boardId) ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}Atualizar dados
                    </button>
                    <button onClick={() => setWizard({ boardId: p.boardId })} className="flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm"><Settings2 className="size-4" aria-hidden />Mapeamento</button>
                    <button onClick={() => void showLogs(p.boardId)} className="min-h-10 rounded-md border border-border px-3 text-sm">Histórico</button>
                    <a href={p.boardUrl} target="_blank" rel="noreferrer" aria-label="Abrir quadro de origem" className="flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm"><ExternalLink className="size-4" aria-hidden />Quadro</a>
                    <button onClick={() => setToDelete(p)} disabled={busy.has(p.boardId) || all} className="flex min-h-10 items-center gap-1.5 rounded-md border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="size-4" aria-hidden />Excluir</button>
                  </div>
                </div>
                <ProjectHistoryMeta p={p} configured={!!hCfg} onLink={() => setLinkFor(p.boardId)} onChanged={() => void load()} />
                {logs?.boardId === p.boardId && (
                  <ul className="mt-3 space-y-1 rounded-md bg-muted p-3 text-xs">
                    {logs.rows.length === 0 && <li className="text-muted-foreground">Sem registros.</li>}
                    {logs.rows.map((l, i) => <li key={i} className={cn(!l.ok && 'text-destructive')}><span className="font-mono">{fmtDateTime(l.at)}</span> · {l.ok ? 'Sucesso' : 'Falha'} · {l.summary}</li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o && !deleting) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto do aplicativo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" e todos os seus indicadores, medições, atividades, subatividades, produtos, riscos, mapeamento e histórico de atualizações serão removidos do aplicativo.
              O quadro de origem na Monday não será alterado e poderá ser importado novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <button onClick={() => void confirmDelete()} disabled={deleting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {deleting && <Loader2 className="size-4 animate-spin" aria-hidden />}Excluir projeto
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
