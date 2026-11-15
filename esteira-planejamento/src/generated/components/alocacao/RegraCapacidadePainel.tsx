import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { inputCls } from '@generated/components/edit-fields';
import type { useRegraCapacidade } from '@generated/hooks/useRegraCapacidade';
import { btnNeutro } from '@generated/components/alocacao/cards';

const PADRAO = { curtoDias: 30, medioDias: 60, longoDias: 90 };

/** "Regra de capacidade" (engrenagem): edits the Curto/Médio/Longo thresholds, in days. */
export function RegraCapacidadePainel({ regraState }: { regraState: ReturnType<typeof useRegraCapacidade> }) {
  const { regra, salvar, restaurarPadrao } = regraState;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(regra);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (open) setForm(regra); }, [open, regra]);

  const valido = form.curtoDias > 0 && form.curtoDias < form.medioDias && form.medioDias < form.longoDias;
  const campo = (k: keyof typeof form, label: string) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input type="number" min={1} max={3650} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: Math.max(1, Math.round(Number(e.target.value) || 0)) }))}
        className={inputCls} />
    </label>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={btnNeutro} aria-label="Regra de capacidade">
          <Settings2 className="size-3.5" aria-hidden /> Regra de capacidade
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-[var(--radius-lg)] border-border p-3 shadow-none">
        <p className="mb-2 text-xs font-medium text-foreground">Faixas de capacidade (dias até o término mais próximo)</p>
        <div className="flex flex-col gap-2">
          {campo('curtoDias', 'Curto prazo até (dias)')}
          {campo('medioDias', 'Médio prazo até (dias)')}
          {campo('longoDias', 'Longo prazo até (dias)')}
        </div>
        {!valido && <p className="mt-1.5 text-[11px] text-[hsl(var(--danger))]">As faixas devem ser crescentes: Curto &lt; Médio &lt; Longo.</p>}
        <p className="mt-2 text-[11px] leading-snug text-[hsl(var(--fg-subtle))]">Acima do Longo prazo (ou sem data) = “Não”. Ajustes manuais por gerente continuam valendo por cima.</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => void restaurarPadrao().then((ok) => ok && setOpen(false))}
            disabled={salvando} className="h-11 rounded-[var(--radius-md)] px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 md:h-7"
            title={`Volta para ${PADRAO.curtoDias} / ${PADRAO.medioDias} / ${PADRAO.longoDias} dias`}>
            Voltar à regra padrão
          </button>
          <button type="button" disabled={!valido || salvando} onClick={() => void (async () => {
            setSalvando(true);
            const ok = await salvar(form);
            setSalvando(false);
            if (ok) setOpen(false);
          })()} className="h-11 rounded-[var(--radius-md)] bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--primary)/0.88)] disabled:opacity-60 md:h-8">
            Salvar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
