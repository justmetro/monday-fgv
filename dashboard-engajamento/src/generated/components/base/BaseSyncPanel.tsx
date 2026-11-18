import { useMemo, useState } from 'react';
import { KeyRound, Loader2, RefreshCw, AlertTriangle, CheckCircle2, X, Send } from 'lucide-react';
import { applyBaseFromBoard, compareBoardAndBase } from '@generated/server/baseManagement';
import type { BaseSyncStatusDoc, MirrorQueueDoc } from '@generated/models';
import { usePanelUploadRunner } from '@generated/hooks/usePanelUploadRunner';
import { ITEMS_PER_CALL_DEFAULT, PARALLEL_CALLS_DEFAULT } from '@generated/lib/panelUploadLimits';

type Claim = { email?: string; id?: string; name?: string; isAdmin?: boolean } | undefined;
interface Props { clientClaim: Claim; sync: BaseSyncStatusDoc | null; queues: MirrorQueueDoc[]; onChanged: () => void }
type Preview = Awaited<ReturnType<typeof compareBoardAndBase>>['preview'];

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function BaseSyncPanel({ clientClaim, sync, queues, onChanged }: Props) {
  const token = 'app';
  const [busy, setBusy] = useState<'compare' | 'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const runner = usePanelUploadRunner(clientClaim, onChanged);

  const needToken = () => false;
  const run = async (kind: 'compare' | 'preview', after?: (p: Preview) => void) => {
    if (needToken()) return;
    setBusy(kind); setError(null); setOk(null);
    try {
      const res = await compareBoardAndBase({ data: { token: token.trim(), clientClaim } });
      onChanged();
      if (after) after(res.preview);
      else setOk(res.status.inSync ? 'Quadro e Base estão em sincronia.' : `${res.status.differencesCount} divergências encontradas.`);
    } catch (e) {
      setError((e as Error).message || 'Erro sem mensagem retornado pela leitura do quadro.');
    } finally { setBusy(null); }
  };
  const apply = async (mode: 'all' | 'diff') => {
    setBusy('apply'); setError(null);
    try {
      const r = await applyBaseFromBoard({ data: { token: token.trim(), mode, clientClaim } });
      setPreview(null);
      setOk(`Base atualizada do quadro: ${r.created} criadas · ${r.updated} atualizadas · ${r.unchanged} iguais${mode === 'all' ? ` · ${r.removed} removidas (só existiam na Base)` : ''}.`);
      onChanged();
    } catch (e) {
      setError((e as Error).message || 'Erro sem mensagem retornado pela leitura do quadro.');
    } finally { setBusy(null); }
  };
  const resend = async (group: string) => {
    if (needToken()) return;
    setError(null);
    const blocked = await runner.resend(token.trim(), group, { itemsPerCall: ITEMS_PER_CALL_DEFAULT, parallelCalls: PARALLEL_CALLS_DEFAULT });
    if (blocked) setError(blocked);
  };

  const byWeek = useMemo(() => {
    const m = new Map<string, NonNullable<typeof sync>['differences']>();
    (sync?.differences ?? []).forEach((d) => { const k = d.group || '—'; m.set(k, [...(m.get(k) ?? []), d]); });
    return Array.from(m.entries());
  }, [sync]);
  const locked = Boolean(busy) || runner.running;
  const r = runner.run;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={locked} onClick={() => void run('compare')} className="h-11 px-4 rounded-xl border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy === 'compare' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Conferir sincronia
          </button>
          <button type="button" disabled={locked} onClick={() => void run('preview', setPreview)} className="h-11 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy === 'preview' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar Base do Quadro
          </button>
        </div>
      </div>

      {error && <p className="text-xs rounded-xl p-3 bg-destructive/10 text-destructive flex items-start gap-2 break-words"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</p>}
      {ok && <p className="text-xs rounded-xl p-3 bg-primary/10 text-primary flex items-start gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {ok}</p>}

      {r && (
        <p className="text-xs rounded-xl p-3 bg-muted/60 text-foreground break-words">
          {runner.running ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" /> : null}
          “{r.groupName}” Base → quadro: {r.created}/{r.toCreate} itens criados · {r.checksConfirmed}/{r.checksExpected} checks confirmados por leitura de volta
          {!runner.running && r.stopReason ? ` · ${r.stopReason}` : ''}
          {!runner.running && (r.metrics?.rawErrors?.length ?? 0) > 0 ? ` · Erro do monday: ${r.metrics?.rawErrors?.[0]}` : ''}
        </p>
      )}

      {queues.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <p className="text-xs font-medium text-foreground">Fila: dados na Base ainda não confirmados no quadro</p>
          {queues.map((q) => (
            <div key={q.group} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-foreground">{q.group}: {q.pendingCount} pessoas · {q.checksPending} checks <span className="text-muted-foreground break-words">{q.lastError ? `· ${q.lastError}` : ''}</span></span>
              <button type="button" disabled={locked} onClick={() => void resend(q.group)} className="h-9 px-3 rounded-lg bg-card border border-border hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Reenviar</button>
            </div>
          ))}
        </div>
      )}

      {sync && (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
            <span className="font-semibold text-foreground flex items-center gap-2">
              {sync.inSync ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {sync.inSync ? 'Em sincronia' : `${sync.differencesCount} divergências`} · quadro {sync.boardRows} linhas · Base {sync.baseRows} linhas
            </span>
            <span className="text-muted-foreground">Última conferência: {when(sync.checkedAt)} por {sync.checkedByName}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-1.5 pr-3">Semana</th><th className="pr-3">Pessoas quadro / Base</th><th className="pr-3">Checks quadro / Base</th><th><span className="sr-only">Ação</span></th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {sync.weeks.map((w) => {
                  const differs = w.boardPeople !== w.basePeople || w.boardChecks !== w.baseChecks;
                  return (
                    <tr key={w.group}>
                      <td className="py-1.5 pr-3 font-medium text-foreground">{w.group || '—'}</td>
                      <td className={`pr-3 tabular-nums ${w.boardPeople !== w.basePeople ? 'text-amber-700' : ''}`}>{w.boardPeople} / {w.basePeople}</td>
                      <td className={`pr-3 tabular-nums ${w.boardChecks !== w.baseChecks ? 'text-amber-700' : ''}`}>{w.boardChecks} / {w.baseChecks}</td>
                      <td className="text-right">
                        {differs && w.group && (
                          <button type="button" disabled={locked} onClick={() => void resend(w.group)} className="h-8 px-2.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50">Base → quadro</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {byWeek.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {byWeek.map(([g, list]) => (
                <details key={g} className="rounded-xl bg-muted/50 p-2">
                  <summary className="cursor-pointer font-medium text-foreground">{g} · {list.length} divergências</summary>
                  <ul className="mt-1.5 space-y-1">
                    {list.map((d) => <li key={`${d.email || d.name}-${d.type}`} className="text-[11px]"><span className="text-foreground">{d.name}</span> <span className="text-muted-foreground">{d.email} · {d.detail}</span></li>)}
                  </ul>
                </details>
              ))}
            </div>
          )}
          {!sync.inSync && (
            <p className="text-[11px] text-muted-foreground">Para reconciliar com o quadro como referência, use “Atualizar Base do Quadro”. Para usar a Base como referência, use “Base → quadro” na semana (cria itens e marca checks que faltam; nada é desmarcado no quadro).</p>
          )}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-foreground">Prévia: Base a partir do quadro</h3>
              <button type="button" aria-label="Fechar" onClick={() => setPreview(null)} className="w-8 h-8 rounded-full hover:bg-muted grid place-items-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[['A criar', preview.toCreate], ['A atualizar', preview.toUpdate], ['Iguais', preview.unchanged], ['Só na Base', preview.onlyInBase]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{l}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
              ))}
            </div>
            {preview.boardDuplicates > 0 && <p className="text-xs text-amber-700">{preview.boardDuplicates} itens duplicados no quadro serão unidos em uma linha por pessoa e semana.</p>}
            <div className="flex flex-col gap-2">
              <button type="button" disabled={busy === 'apply'} onClick={() => void apply('diff')} className="h-11 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                {busy === 'apply' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Só as diferenças ({preview.toCreate + preview.toUpdate}) · mantém o que só existe na Base
              </button>
              <button type="button" disabled={busy === 'apply'} onClick={() => void apply('all')} className="h-11 rounded-xl border border-border text-xs font-medium hover:bg-muted disabled:opacity-50">
                Sobrescrever tudo (espelho exato · remove {preview.onlyInBase} só da Base)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
