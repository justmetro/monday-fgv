import { useState } from 'react';
import { ChevronDown, MessageSquareWarning } from 'lucide-react';
import type { getReviewRisks } from '@generated/data/risks';
import { GrauBlock, Pill } from '@generated/components/kit';
import { AplicSegment } from '@generated/components/review/AplicSegment';
import { JustificationEditor } from '@generated/components/review/JustificationEditor';
import { isCritico, type Aplicabilidade } from '@generated/lib/config';
import { cn } from '@lib/utils';

export type ReviewRisk = Awaited<ReturnType<typeof getReviewRisks>>['items'][number];

export function riskTitle(r: { name: string; idDoRisco: string | null }) {
  const parts = r.name.split(' | ');
  return parts.length > 1 ? parts.slice(1).join(' | ') : r.name;
}

function Block({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="min-w-0">
      <p className="mono-label mb-1.5 text-[hsl(var(--text-dim))]">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{text?.trim() || <span className="text-muted-foreground">Não informado</span>}</p>
    </div>
  );
}

export function ReviewRow({
  risk: r,
  readOnly,
  onAplic,
  onSaveJustif,
}: {
  risk: ReviewRisk;
  readOnly: boolean;
  onAplic: (next: Aplicabilidade) => void;
  onSaveJustif: (text: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const critico = isCritico(r.grauDeRisco);
  const naoRevisado = !r.aplicabilidade || r.aplicabilidade === 'Identificado';

  return (
    <li className={cn('rounded-xl border bg-[hsl(var(--card)/0.6)] transition-colors', open ? 'glass-active border-[hsl(var(--cobalt)/0.6)]' : 'border-[hsl(var(--border))]')}>
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-4 text-left focus-visible:outline-none"
        >
          <GrauBlock grau={r.grauDeRisco} nivel={r.nvelDeRisco} compact />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mono text-xs text-[hsl(var(--sky))]">{r.idDoRisco ?? '—'}</span>
              {critico && <Pill tone="danger">Crítico</Pill>}
              {naoRevisado && <Pill tone="neutral">Não revisado</Pill>}
              {r.sinalizaesDoMotor?.trim() && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(var(--warning))]" title={r.sinalizaesDoMotor}>
                  <MessageSquareWarning className="size-3.5" aria-hidden /> Sinalização
                </span>
              )}
            </div>
            <p className={cn('mt-1 text-sm text-foreground', !open && 'line-clamp-2')}>{riskTitle(r)}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{r.categoria?.join(', ') || 'Sem categoria'}</span>
              <span className="mono text-[11px]">{r.gruposDeOrigem?.join(' · ') || 'Sem grupo'}</span>
            </div>
          </div>
          <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform md:hidden', open && 'rotate-180')} aria-hidden />
        </button>
        <div className="flex items-center gap-2 md:w-[340px] md:shrink-0">
          <div className="flex-1">
            <AplicSegment value={r.aplicabilidade} disabled={readOnly} onChange={onAplic} label={r.idDoRisco ?? r.name} />
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Recolher detalhes' : 'Ver detalhes e justificar'}
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--accent))] hover:text-foreground md:inline-flex"
          >
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[hsl(var(--border))] px-4 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Block label="Causa / problema" text={r.causaproblema} />
            <Block label="Efeito / impacto" text={r.efeitoimpacto} />
            <div className="space-y-4">
              <Block label="Sinalizações do motor" text={r.sinalizaesDoMotor} />
              <Block label="Referência base (P / I)" text={r.refernciaBasePI} />
            </div>
          </div>
          <div className="mt-5">
            <JustificationEditor initial={r.justificativaDaAplicabilidade} disabled={readOnly} onSave={onSaveJustif} />
          </div>
        </div>
      )}
    </li>
  );
}
