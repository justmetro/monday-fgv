import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { SelectField } from '@generated/components/painel/Fields';
import type { Row } from '@generated/lib/painel';
import type { Extras, ResultadoExtras } from '@generated/hooks/useSalvarExtras';

const PARALELO = 4;

/** Aplica o mesmo Status a vários projetos selecionados (grava em Decisões do Vibe, um item por projeto). */
export function BulkStatusBar({ rows, opcoes, onSalvar, onLimpar }: {
  rows: Row[]; opcoes: string[]; onSalvar: (r: Row, x: Extras) => Promise<ResultadoExtras>; onLimpar: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const aplicar = async () => {
    setSaving(true); setProgresso(0);
    const falhas: string[] = [];
    let i = 0;
    const worker = async () => {
      while (i < rows.length) {
        const r = rows[i++];
        if (!r) break;
        const res = await onSalvar(r, { cat: status }).catch(() => ({ ok: false, gravado: [], falhas: ['status'] }));
        if (!res.ok) falhas.push(r.projeto.name);
        setProgresso((p) => p + 1);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALELO, rows.length) }, worker));
    setSaving(false);
    const ok = rows.length - falhas.length;
    if (falhas.length) toast.error(`Status aplicado em ${ok} de ${rows.length} projeto(s). Falhou: ${falhas.slice(0, 3).join('; ')}${falhas.length > 3 ? '…' : ''}`);
    else { toast.success(`Status “${status ?? 'Sem status'}” aplicado em ${ok} projeto(s).`); onLimpar(); }
  };

  return (
    <section aria-label="Ações em massa" className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-[hsl(var(--info-soft))] px-4 py-2.5 text-sm text-[hsl(var(--info-ink))] sm:px-5">
      <span className="tnum font-medium">{rows.length} selecionado(s)</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none">
        <span className="text-xs">Status</span>
        <div className="w-[220px] max-w-full text-foreground">
          <SelectField id="bulk-status" value={status} onChange={setStatus} options={opcoes} placeholder="Escolher status" />
        </div>
        <button type="button" onClick={() => void aplicar()} disabled={saving} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {saving ? `Aplicando ${progresso}/${rows.length}` : 'Aplicar aos selecionados'}
        </button>
      </div>
      <button type="button" onClick={onLimpar} disabled={saving} className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs hover:underline disabled:opacity-50">
        <X className="size-3.5" aria-hidden /> Limpar seleção
      </button>
    </section>
  );
}
