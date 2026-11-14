import { useState } from 'react';
import { BookMarked, ExternalLink, Loader2, RefreshCw, Search, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import type { listProjects } from '@generated/server/importer';
import { refreshHistoryMeta, type getHistoryConfig } from '@generated/server/history';
import { AMBIGUOUS } from '@generated/lib/history';
import { fmtDateTime } from '@generated/lib/format';
import { HistoryConfigDialog } from './HistoryConfigDialog';
import { MatchPreviewDialog } from './MatchPreviewDialog';

type Project = Awaited<ReturnType<typeof listProjects>>[number];
type Cfg = Awaited<ReturnType<typeof getHistoryConfig>>;

export function HistorySection({ cfg, projects, onChanged, onManual }: { cfg: Cfg; projects: Project[]; onChanged: () => void; onManual: (boardId: string) => void }) {
  const [cfgOpen, setCfgOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const linked = projects.filter((p) => p.hLink === 'confirmed');
  const amb = projects.filter((p) => p.hLink !== 'confirmed' && AMBIGUOUS.includes(p.hPendingReason ?? ''));
  const pend = projects.length - linked.length - amb.length;
  const failed = linked.filter((p) => p.hLastOk === false).length;

  const refreshAll = async () => {
    setBusy(true);
    try {
      const r = await refreshHistoryMeta({ data: {} });
      const bad = r.results.filter((x) => !x.ok);
      if (r.error && !r.results.length) toast.error(r.error);
      else if (bad.length) toast.error(`${bad.length} de ${r.results.length} cadastro(s) não atualizados`, { description: 'Os dados anteriores foram preservados.' });
      else toast.success(`${r.results.length} cadastro(s) atualizados`);
    } catch (e) { console.error(e); toast.error('Não foi possível atualizar o cadastro dos projetos.'); }
    finally { setBusy(false); onChanged(); }
  };

  const stats = [
    { l: 'Vinculados', n: linked.length, cls: 'text-[hsl(var(--ok))]' },
    { l: 'Pendentes', n: pend, cls: 'text-muted-foreground' },
    { l: 'Ambíguos', n: amb.length, cls: 'text-[hsl(var(--warn))]' },
    { l: 'Falha de atualização', n: failed, cls: 'text-destructive' },
  ];

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><BookMarked className="size-5 text-primary" aria-hidden />Cadastro de referência dos projetos</h2>
          {cfg ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Fonte: <a href={cfg.boardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline">{cfg.boardName}<ExternalLink className="size-3" /></a> · Status do Projeto, gerente e eixos · configurado em <span className="font-mono">{fmtDateTime(cfg.savedAt)}</span>
            </p>
          ) : <p className="mt-1 text-sm text-muted-foreground">Vincule cada projeto ao quadro "Histórico de Projetos" para trazer Status do Projeto, gerente e eixos de atuação.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCfgOpen(true)} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"><Settings2 className="size-4" />Configurar Histórico de Projetos</button>
          {cfg && <>
            <button onClick={() => setMatchOpen(true)} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"><Search className="size-4" />Buscar correspondências pendentes</button>
            <button onClick={() => void refreshAll()} disabled={busy || linked.length === 0} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Atualizar cadastro dos projetos
            </button>
          </>}
        </div>
      </div>
      {cfg && (
        <dl className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="border-border p-3 [&:not(:last-child)]:border-r">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.l}</dt>
              <dd className={`font-mono text-2xl ${s.cls}`}>{s.n}</dd>
            </div>
          ))}
        </dl>
      )}
      <HistoryConfigDialog open={cfgOpen} onOpenChange={setCfgOpen} onSaved={onChanged} />
      <MatchPreviewDialog open={matchOpen} onOpenChange={setMatchOpen} onDone={onChanged} onManual={(id) => { setMatchOpen(false); onManual(id); }} />
    </section>
  );
}
