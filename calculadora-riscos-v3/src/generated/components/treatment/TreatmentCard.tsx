import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { getTreatmentRisks } from '@generated/data/risks';
import { GrauBlock, Pill, tratTone } from '@generated/components/kit';
import { riskTitle } from '@generated/components/review/ReviewRow';
import { TreatmentForm, type Draft } from '@generated/components/treatment/TreatmentForm';
import { formatDate, isCritico, toDateInput } from '@generated/lib/config';
import { cn } from '@lib/utils';

export type TreatmentRisk = Awaited<ReturnType<typeof getTreatmentRisks>>['items'][number];

export function draftFrom(r: TreatmentRisk): Draft {
  return {
    probabilidade: r.probabilidade ?? null,
    impacto: r.impacto ?? null,
    estrategia: r.estratgia ?? null,
    resposta: r.respostaPlanoDeAo ?? '',
    responsaveis: (r.responsvelPeloMonitoramento ?? []).map((p) => ({ id: String(p.id), name: p.name ?? '' })),
    prazo: toDateInput(r.prazo),
    periodicidade: r.periodicidade ?? '',
    statusTratamento: r.statusDoTratamento ?? null,
  };
}

export function flagsOf(r: TreatmentRisk) {
  return {
    semEstrategia: !r.estratgia,
    semResponsavel: !(r.responsvelPeloMonitoramento?.length ?? 0),
    semPrazo: !r.prazo,
    semPlano: !r.respostaPlanoDeAo?.trim(),
  };
}

export function TreatmentCard({ risk: r, readOnly, onSave }: { risk: TreatmentRisk; readOnly: boolean; onSave: (d: Draft) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const base = useMemo(() => draftFrom(r), [r]);
  const [draft, setDraft] = useState<Draft>(base);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(base), [base]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const piChanged = draft.probabilidade !== base.probabilidade || draft.impacto !== base.impacto;
  const critico = isCritico(r.grauDeRisco);
  const f = flagsOf(r);

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <li className={cn('rounded-xl border bg-[hsl(var(--card)/0.6)]', critico ? 'border-[hsl(var(--destructive)/0.45)]' : 'border-[hsl(var(--border))]', open && 'glass-active')}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-4 p-4 text-left focus-visible:outline-none">
        <GrauBlock grau={r.grauDeRisco} nivel={r.nvelDeRisco} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mono text-xs text-[hsl(var(--sky))]">{r.idDoRisco ?? '—'}</span>
            {critico && <Pill tone="danger">Crítico</Pill>}
            <Pill tone={tratTone(r.statusDoTratamento)}>{r.statusDoTratamento ?? 'Sem status'}</Pill>
            {r.estratgia && <Pill tone="active">{r.estratgia}</Pill>}
          </div>
          <p className={cn('mt-1 text-sm text-foreground', !open && 'line-clamp-2')}>{riskTitle(r)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {f.semEstrategia && <Pill tone="warn">Sem estratégia</Pill>}
            {f.semResponsavel && <Pill tone="warn">Sem responsável</Pill>}
            {f.semPrazo && <Pill tone="warn">Sem prazo</Pill>}
            {f.semPlano && (critico ? <Pill tone="danger">Crítico sem plano de ação</Pill> : <Pill tone="warn">Sem plano de ação</Pill>)}
            {!f.semResponsavel && (
              <span className="text-xs text-muted-foreground">{r.responsvelPeloMonitoramento?.map((p) => p.name).filter(Boolean).join(', ')}</span>
            )}
            {!f.semPrazo && <span className="text-xs text-muted-foreground">· prazo {formatDate(r.prazo)}</span>}
          </div>
        </div>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-[hsl(var(--border))] px-4 pb-5 pt-4">
          <TreatmentForm draft={draft} setDraft={setDraft} disabled={readOnly || saving} refPI={r.refernciaBasePI} />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {piChanged
                ? 'Grau e Nível serão recalculados pelo próprio quadro 09.4 depois de salvar.'
                : 'Grau e Nível exibidos são os calculados pelo quadro 09.4.'}
            </p>
            <div className="flex gap-2">
              <button type="button" className="ghost-pill" onClick={() => setDraft(base)} disabled={!dirty || saving}>
                Descartar
              </button>
              <button type="button" className="cta-pill" onClick={save} disabled={!dirty || saving || readOnly}>
                {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {saving ? 'Salvando' : 'Salvar tratamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
