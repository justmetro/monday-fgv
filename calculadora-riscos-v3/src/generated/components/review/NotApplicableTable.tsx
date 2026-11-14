import { Fragment, useEffect, useState } from 'react';
import { Archive, ChevronDown, RotateCcw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@components/ui/collapsible';
import { Pill } from '@generated/components/kit';
import { JustificationEditor } from '@generated/components/review/JustificationEditor';
import { riskTitle, type ReviewRisk } from '@generated/components/review/ReviewRow';
import { grauOf } from '@generated/lib/config';
import { cn } from '@lib/utils';

/** Não aplicáveis: tabela compacta, sempre visível, nunca apaga itens (rastreabilidade). */
export function NotApplicableTable({
  items,
  readOnly,
  onReevaluate,
  onSaveJustif,
  justifRequest,
}: {
  items: ReviewRisk[];
  readOnly: boolean;
  onReevaluate: (r: ReviewRisk) => void;
  onSaveJustif: (r: ReviewRisk, text: string) => Promise<boolean>;
  justifRequest: { id: string; nonce: number } | null;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  // Ao marcar "Não aplicável" sem justificativa: expande a seção e abre o editor do risco recém-movido.
  useEffect(() => {
    if (!justifRequest || readOnly) return;
    setOpen(true);
    setEditing(justifRequest.id);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`na-editor-${justifRequest.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [justifRequest, readOnly]);
  const semJustif = items.filter((i) => !i.justificativaDaAplicabilidade?.trim()).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="glass mt-8 overflow-hidden">
      <CollapsibleTrigger className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left hover:bg-[hsl(var(--accent)/0.35)]">
        <Archive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Não aplicáveis <span className="mono ml-1 text-muted-foreground">{items.length}</span>
          </p>
          <p className="text-xs text-muted-foreground">Mantidos para rastreabilidade. Nenhum item é apagado do quadro 09.4.</p>
        </div>
        {semJustif > 0 && <Pill tone="warn">{semJustif} sem justificativa</Pill>}
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {items.length === 0 ? (
          <p className="border-t border-[hsl(var(--border))] px-5 py-6 text-sm text-muted-foreground">
            Nenhum risco marcado como não aplicável com os filtros atuais. Ao marcar “Não aplicável”, o risco aparece aqui.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-[hsl(var(--border))]">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left">
                  {['ID', 'Risco', 'Categoria', 'Grupo(s)', 'Grau', 'Justificativa', 'Ações'].map((h) => (
                    <th key={h} className="mono-label px-4 py-2.5 font-medium text-[hsl(var(--text-dim))]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-t border-[hsl(var(--border)/0.7)] align-top">
                      <td className="mono whitespace-nowrap px-4 py-2.5 text-xs text-[hsl(var(--sky))]">{r.idDoRisco ?? '—'}</td>
                      <td className="max-w-[320px] px-4 py-2.5">
                        <p className="line-clamp-2 text-foreground/90" title={r.name}>
                          {riskTitle(r)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.categoria?.join(', ') || '—'}</td>
                      <td className="mono px-4 py-2.5 text-[11px] text-muted-foreground">{r.gruposDeOrigem?.join(' · ') || '—'}</td>
                      <td className="mono px-4 py-2.5 tabular-nums">{grauOf(r.grauDeRisco) ?? '—'}</td>
                      <td className="max-w-[260px] px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setEditing((e) => (e === r.id ? null : r.id))}
                          className="w-full text-left text-xs hover:text-[hsl(var(--sky))]"
                          aria-expanded={editing === r.id}
                        >
                          {r.justificativaDaAplicabilidade?.trim() ? (
                            <span className="line-clamp-2 text-muted-foreground">{r.justificativaDaAplicabilidade}</span>
                          ) : (
                            <span className="text-[hsl(var(--warning))]">Sem justificativa · adicionar</span>
                          )}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <button type="button" className="ghost-pill h-8 min-h-8 px-3" onClick={() => onReevaluate(r)} disabled={readOnly}>
                          <RotateCcw className="size-3.5" aria-hidden /> Reavaliar
                        </button>
                      </td>
                    </tr>
                    {editing === r.id && (
                      <tr id={`na-editor-${r.id}`} className="bg-[hsl(var(--surface-deep)/0.6)]">
                        <td colSpan={7} className="px-4 py-4">
                          <JustificationEditor
                            autoFocus
                            initial={r.justificativaDaAplicabilidade}
                            disabled={readOnly}
                            onSave={(t) => onSaveJustif(r, t)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
