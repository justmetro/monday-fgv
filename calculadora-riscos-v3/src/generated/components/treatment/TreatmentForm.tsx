import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import { ESCALA, ESTRATEGIAS, STATUS_TRATAMENTO } from '@generated/lib/config';
import { PersonPicker, type PersonRef } from '@generated/components/treatment/PersonPicker';

export type Draft = {
  probabilidade: string | null;
  impacto: string | null;
  estrategia: string | null;
  resposta: string;
  responsaveis: PersonRef[];
  prazo: string;
  periodicidade: string;
  statusTratamento: string | null;
};

const NONE = '__none';
const inputCls =
  'h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] px-3 text-base text-foreground focus-visible:border-[hsl(var(--cobalt))] focus-visible:outline-none disabled:opacity-50 md:text-sm';

function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <span className="mono-label mb-1.5 block text-[hsl(var(--text-dim))]">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function LabelSelect({ label, value, options, onChange, disabled }: { label: string; value: string | null; options: readonly string[]; onChange: (v: string | null) => void; disabled: boolean }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger aria-label={label} className="h-10 w-full rounded-md border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Não definido</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TreatmentForm({ draft, setDraft, disabled, refPI }: { draft: Draft; setDraft: (d: Draft) => void; disabled: boolean; refPI: string | null }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Probabilidade" hint={refPI ? `Referência: ${refPI}` : undefined}>
        <LabelSelect label="Probabilidade" value={draft.probabilidade} options={ESCALA} onChange={(v) => set({ probabilidade: v })} disabled={disabled} />
      </Field>
      <Field label="Impacto">
        <LabelSelect label="Impacto" value={draft.impacto} options={ESCALA} onChange={(v) => set({ impacto: v })} disabled={disabled} />
      </Field>
      <Field label="Estratégia">
        <LabelSelect label="Estratégia" value={draft.estrategia} options={ESTRATEGIAS} onChange={(v) => set({ estrategia: v })} disabled={disabled} />
      </Field>
      <Field label="Status do tratamento">
        <LabelSelect label="Status do tratamento" value={draft.statusTratamento} options={STATUS_TRATAMENTO} onChange={(v) => set({ statusTratamento: v })} disabled={disabled} />
      </Field>
      <Field label="Responsável pelo monitoramento" className="sm:col-span-2">
        <PersonPicker value={draft.responsaveis} onChange={(v) => set({ responsaveis: v })} disabled={disabled} />
      </Field>
      <Field label="Prazo">
        <input type="date" value={draft.prazo} onChange={(e) => set({ prazo: e.target.value })} disabled={disabled} className={inputCls} aria-label="Prazo" />
      </Field>
      <Field label="Periodicidade">
        <input
          value={draft.periodicidade}
          onChange={(e) => set({ periodicidade: e.target.value })}
          disabled={disabled}
          placeholder="Ex.: mensal, a cada entrega"
          className={inputCls}
          aria-label="Periodicidade"
        />
      </Field>
      <Field label="Resposta / plano de ação" className="sm:col-span-2 lg:col-span-4">
        <Textarea
          value={draft.resposta}
          onChange={(e) => set({ resposta: e.target.value })}
          disabled={disabled}
          rows={4}
          placeholder="Descreva as ações de resposta ao risco."
          className="rounded-md border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] text-base md:text-sm"
        />
      </Field>
    </div>
  );
}
