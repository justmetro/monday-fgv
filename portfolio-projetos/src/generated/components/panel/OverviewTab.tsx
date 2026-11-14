import { useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import { GROUP_LABEL, type GroupKey } from '@generated/lib/fields';
import { fmtDateTime } from '@generated/lib/format';
import { LIGHT_RULE, type AreaLight, type Light, type ProjectRow } from '@generated/lib/overview';
import { cn } from '@lib/utils';
import { Panel } from '../ui-bits';

const DOT: Record<Light, string> = { ok: 'bg-[hsl(var(--ok))]', warn: 'bg-[hsl(var(--warn))]', bad: 'bg-destructive', none: 'bg-muted-foreground/30' };
const WORD: Record<Light, string> = { ok: 'Em dia', warn: 'Atenção', bad: 'Crítico', none: 'Sem avaliação' };
export type AreaTab = 'indicadores' | 'cronograma' | 'produtos' | 'riscos' | 'checklist';
const AREAS: { key: 'ind' | 'sched' | 'prod' | 'risk'; label: string; tab: AreaTab }[] = [
  { key: 'ind', label: 'Indicadores', tab: 'indicadores' }, { key: 'sched', label: 'Cronograma', tab: 'cronograma' },
  { key: 'prod', label: 'Produtos', tab: 'produtos' }, { key: 'risk', label: 'Riscos', tab: 'riscos' },
];

function Lamp({ a }: { a: AreaLight }) {
  return (
    <span className="flex min-w-0 items-start gap-2" title={`${WORD[a.light]} · ${a.text}`}>
      <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', DOT[a.light])} aria-label={WORD[a.light]} />
      <span className="min-w-0 text-xs leading-snug text-muted-foreground">{a.text}</span>
    </span>
  );
}

type GS = Partial<Record<string, { status: string; message: string; at: string }>>;
const gsOf = (raw: string | undefined): GS => { try { return raw ? (JSON.parse(raw) as GS) : {}; } catch { return {}; } };

/** Visão geral: uma linha por projeto com o semáforo de cada área e acesso ao detalhe. */
export function OverviewTab({ rows, onOpenArea }: { rows: ProjectRow[]; onOpenArea: (boardId: string, tab: AreaTab) => void }) {
  const [sel, setSel] = useState<ProjectRow | null>(null);
  const tally = (key: 'ind' | 'sched' | 'prod' | 'risk', l: Light) => rows.filter((r) => r[key].light === l).length;
  if (rows.length === 0) return <Panel><p className="py-8 text-center text-sm text-muted-foreground">Nenhum projeto no recorte dos filtros.</p></Panel>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        {AREAS.map((a) => (
          <div key={a.key} className="bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{a.label}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {(['bad', 'warn', 'ok'] as Light[]).map((l) => <span key={l} className="flex items-center gap-1.5"><span className={cn('size-2.5 rounded-full', DOT[l])} /><span className="font-mono">{tally(a.key, l)}</span><span className="text-xs text-muted-foreground">{WORD[l]}</span></span>)}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{LIGHT_RULE} Indicadores reúne as checagens de Indicadores e Medições.</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2 font-medium">Projeto</th>{AREAS.map((a) => <th key={a.key} className="px-3 py-2 font-medium">{a.label}</th>)}<th className="px-3 py-2 text-right font-medium">Inconsistências / verificações</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.p.boardId} onClick={() => setSel(r)} className="cursor-pointer align-top hover:bg-muted/40">
                <td className="max-w-72 px-3 py-3">
                  <p className="font-medium leading-snug">{r.p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.p.workspaceName}{r.p.hStatus ? ` · ${r.p.hStatus}` : ''}</p>
                  {r.p.syncStatus === 'error' && <p className="mt-0.5 text-xs text-destructive">Última tentativa falhou — exibindo a versão anterior.</p>}
                </td>
                {AREAS.map((a) => <td key={a.key} className="max-w-56 px-3 py-3"><Lamp a={r[a.key]} /></td>)}
                <td className="whitespace-nowrap px-3 py-3 text-right">{r.total.pct == null ? <span className="text-xs text-muted-foreground">—</span> : <><span className={cn("font-mono text-base tabular-nums", r.total.pct > 10 ? "text-destructive" : r.total.pct > 0 ? "text-[hsl(var(--warn))]" : "text-[hsl(var(--ok))]")}>{r.total.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span><span className="block text-[11px] text-muted-foreground">{r.total.n} de {r.total.d}</span></>}</td>
                <td className="px-2 py-3"><button onClick={(e) => { e.stopPropagation(); setSel(r); }} aria-label={`Detalhe de ${r.p.name}`} className="flex size-9 items-center justify-center rounded hover:bg-muted"><ChevronRight className="size-4" aria-hidden /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {sel && (() => {
            const gs = gsOf(sel.p.groupSync);
            return (
              <>
                <SheetHeader className="border-b border-border">
                  <SheetTitle className="leading-snug">{sel.p.name}</SheetTitle>
                  <SheetDescription>{sel.p.workspaceName} · última atualização bem-sucedida {fmtDateTime(sel.p.lastSuccessAt)}</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4 pb-8">
                  {sel.p.syncStatus === 'error' && <p className="rounded-md bg-[hsl(var(--bad-soft))] p-3 text-xs text-destructive">Última tentativa falhou — exibindo a versão anterior. {sel.p.syncMessage}</p>}
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Gerente</dt><dd>{sel.p.hManagers?.join(', ') || '—'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Eixo</dt><dd>{sel.p.hAxes?.join(', ') || '—'}</dd></div>
                  </dl>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {AREAS.map((a) => {
                      const g = gs[a.key as GroupKey];
                      return (
                        <li key={a.key} className="space-y-2 p-3">
                          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-medium"><span className={cn('size-2.5 rounded-full', DOT[sel[a.key].light])} />{a.label}</span><span className="text-xs text-muted-foreground">{WORD[sel[a.key].light]}</span></div>
                          <p className="text-xs text-muted-foreground">{sel[a.key].text}</p>
                          {g && <p className={cn('text-[11px]', g.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{GROUP_LABEL[a.key]}: {g.status === 'error' ? 'falha' : 'atualizado'} em {fmtDateTime(g.at)}</p>}
                          {sel[a.key].light !== 'none' && <button onClick={() => { onOpenArea(sel.p.boardId, a.tab); setSel(null); }} className="min-h-9 rounded-md border border-border px-3 text-xs hover:bg-muted">Ver {a.label.toLowerCase()} deste projeto</button>}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { onOpenArea(sel.p.boardId, 'checklist'); setSel(null); }} className="flex min-h-10 items-center rounded-md border border-border px-3 text-sm hover:bg-muted">Ver inconsistências no Checklist</button>
                    <a href={sel.p.boardUrl} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm"><ExternalLink className="size-4" aria-hidden />Quadro do projeto</a>
                    {sel.p.hItemUrl && <a href={sel.p.hItemUrl} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm"><ExternalLink className="size-4" aria-hidden />Histórico</a>}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
