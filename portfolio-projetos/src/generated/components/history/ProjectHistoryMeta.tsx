import { useState } from 'react';
import { BookMarked, ExternalLink, Link2, Link2Off, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { listProjects } from '@generated/server/importer';
import { refreshHistoryMeta, unlinkProject } from '@generated/server/history';
import { CASE_LABEL, extractCodes, type MatchCase } from '@generated/lib/history';
import { fmtDateTime } from '@generated/lib/format';
import { cn } from '@lib/utils';

type Project = Awaited<ReturnType<typeof listProjects>>[number];

export function StatusPill({ label, color }: { label: string; color: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px]">
      {/* Cor de origem do rótulo na Monday (valor dinâmico). */}
      <span className="size-2 rounded-full bg-muted-foreground" style={color ? { backgroundColor: color } : undefined} aria-hidden />{label}
    </span>
  );
}

const fieldTxt = (state: string | null | undefined, v: string) => (state === 'unmapped' ? 'coluna não mapeada' : state === 'unavailable' && !v ? 'indisponível' : v || 'não informado');

export function linkLabel(p: Project) {
  if (p.hLink === 'confirmed') return { txt: p.hOrigin === 'manual' ? 'Vínculo confirmado · manual' : 'Vínculo confirmado · por código', cls: 'bg-[hsl(var(--ok-soft))] text-[hsl(var(--ok))]' };
  if (p.hPendingReason === 'unlinked') return { txt: 'Desvinculado · pendente', cls: 'bg-muted text-muted-foreground' };
  if (p.hLink === 'pending') return { txt: `Pendente · ${CASE_LABEL[(p.hPendingReason ?? 'notFound') as MatchCase] ?? p.hPendingReason}`, cls: 'bg-[hsl(var(--warn-soft))] text-[hsl(var(--warn))]' };
  return { txt: 'Vínculo não avaliado', cls: 'bg-muted text-muted-foreground' };
}

/** Cadastro de referência do projeto — separado visualmente da sincronização de indicadores. */
export function ProjectHistoryMeta({ p, configured, onLink, onChanged }: { p: Project; configured: boolean; onLink: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<'refresh' | 'unlink' | null>(null);
  const lk = linkLabel(p);
  const linked = p.hLink === 'confirmed';
  const code = p.hCode ?? (extractCodes(p.name).join(', ') || null);

  const refresh = async () => {
    setBusy('refresh');
    try {
      const r = await refreshHistoryMeta({ data: { boardIds: [p.boardId] } });
      const x = r.results[0];
      if (x?.ok) toast.success('Cadastro atualizado', { description: x.summary });
      else toast.error('Cadastro não atualizado', { description: x?.summary ?? r.error ?? undefined });
    } catch (e) { console.error(e); toast.error('Falha ao atualizar o cadastro. Dados anteriores preservados.'); }
    finally { setBusy(null); onChanged(); }
  };
  const unlink = async () => {
    setBusy('unlink');
    try { await unlinkProject({ data: { boardId: p.boardId } }); toast.success('Vínculo removido', { description: 'Indicadores e medições não foram alterados.' }); }
    catch (e) { console.error(e); toast.error('Não foi possível desvincular.'); }
    finally { setBusy(null); onChanged(); }
  };

  if (!configured) return null;
  return (
    <div className="mt-3 rounded-md border border-dashed border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <BookMarked className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="font-medium uppercase tracking-wide text-muted-foreground">Cadastro de referência</span>
        <span className="font-mono">{code ?? 'sem código'}</span>
        <span className={cn('rounded-sm px-1.5 py-0.5 text-[11px]', lk.cls)}>{lk.txt}</span>
        {p.hShared && <span className="rounded-sm bg-[hsl(var(--warn-soft))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--warn))]">Associação compartilhada</span>}
        {linked && p.hLastOk === false && <span className="rounded-sm bg-[hsl(var(--bad-soft))] px-1.5 py-0.5 text-[11px] text-destructive">{p.hValidation === 'not_returned' ? 'Vínculo não validado' : 'Falha na atualização'}</span>}
      </div>
      {linked && (
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="min-w-0"><span className="text-muted-foreground">Status do Projeto: </span>{p.hStatus ? <StatusPill label={p.hStatus} color={p.hStatusColor ?? null} /> : fieldTxt(p.hStatusState, '')}</div>
          <div className="min-w-0"><span className="text-muted-foreground">Gerente: </span>{fieldTxt(p.hManagerState, (p.hManagers ?? []).join(', '))}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-1"><span className="text-muted-foreground">Eixos: </span>
            {(p.hAxes ?? []).length ? (p.hAxes ?? []).map((a) => <span key={a} className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground">{a}</span>) : fieldTxt(p.hAxesState, '')}
          </div>
          <p className="min-w-0 break-words text-muted-foreground sm:col-span-3">
            No Histórico: {p.hItemName ?? '—'} · última atualização do cadastro <span className="font-mono">{fmtDateTime(p.hLastSuccessAt ?? null)}</span>
            {p.hLastAttemptAt && p.hLastAttemptAt !== p.hLastSuccessAt && <> · última tentativa <span className="font-mono">{fmtDateTime(p.hLastAttemptAt)}</span></>}
          </p>
          {(p.hConflict || p.hLastOk === false) && <p className="text-[hsl(var(--warn))] sm:col-span-3">{p.hConflict ?? p.hLastMessage}</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {linked ? (<>
          <button onClick={() => void refresh()} disabled={!!busy} className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs disabled:opacity-50">{busy === 'refresh' ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}Atualizar cadastro deste projeto</button>
          <button onClick={onLink} className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs"><Link2 className="size-3.5" />Revisar / trocar vínculo</button>
          <button onClick={() => void unlink()} disabled={!!busy} className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs disabled:opacity-50"><Link2Off className="size-3.5" />Desvincular</button>
          {p.hItemUrl && <a href={p.hItemUrl} target="_blank" rel="noreferrer" className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs"><ExternalLink className="size-3.5" />Elemento no Histórico</a>}
        </>) : (
          <button onClick={onLink} className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs"><Link2 className="size-3.5" />Vincular manualmente</button>
        )}
      </div>
    </div>
  );
}
