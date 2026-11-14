import { useState } from 'react';
import { Loader2, Pencil, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { salvarAjusteEquipe } from '@generated/server/ajustes';
import { NumberField } from '@generated/components/painel/Fields';
import { fmtBRL, type Row } from '@generated/lib/painel';
import { valorIgual, type Mudanca } from '@generated/lib/logCampos';
import type { PainelData } from '@generated/hooks/usePainelData';

type Override = { nClt?: number | null; custoMensal?: number | null };

/** Ajuste manual opcional de Nº CLT / custo, guardado só no app (nunca no monday). */
export function EquipeAjuste({ row, data }: { row: Row; data: PainelData }) {
  const p = row.projeto;
  const aj = row.ajuste;
  const autoClt = row.equipe?.nClt ?? null;
  const autoCusto = row.equipe?.custoMensal ?? null;
  const [aberto, setAberto] = useState(false);
  const [clt, setClt] = useState<number | null>(row.clt);
  const [custo, setCusto] = useState<number | null>(row.custoMensal);
  const [busy, setBusy] = useState(false);
  const [erroClt, setErroClt] = useState<string | null>(null);

  const gravar = async (override: Override, changes: Mudanca[], acao: 'alteracao' | 'reversao') => {
    setBusy(true);
    try {
      const res = await salvarAjusteEquipe({ data: { projectId: p.id, projectName: p.name, override, changes, acao } });
      data.setAjuste(p.id, res?.ajuste ?? null);
      if (res?.log) data.addLog(res.log);
      toast.success(acao === 'reversao' ? 'Ajuste removido. Voltou ao cálculo do quadro Equipes Revisadas.' : 'Ajuste guardado no app (o monday não foi alterado).');
      setAberto(false);
    } catch (e) {
      console.error('salvarAjusteEquipe', e);
      toast.error('Não foi possível guardar o ajuste. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const salvar = () => {
    if (clt !== null && (!Number.isInteger(clt) || clt < 0)) { setErroClt('Informe um número inteiro'); return; }
    if (custo !== null && custo < 0) return;
    setErroClt(null);
    const override: Override = {};
    const changes: Mudanca[] = [];
    const jaClt = !!aj?.campos.includes('nClt');
    const jaCusto = !!aj?.campos.includes('custoMensal');
    // Entra no override só o que o usuário alterou (ou já estava ajustado) e difere do automático.
    if ((jaClt || !valorIgual(clt, row.clt)) && !valorIgual(clt, autoClt ?? 0)) override.nClt = clt;
    if ((jaCusto || !valorIgual(custo, row.custoMensal)) && !valorIgual(custo, autoCusto ?? 0)) override.custoMensal = custo;
    const prevClt = jaClt ? aj?.nClt ?? null : null;
    const prevCusto = jaCusto ? aj?.custoMensal ?? null : null;
    if (!valorIgual(override.nClt ?? null, prevClt)) changes.push({ campo: 'ajusteClt', de: prevClt, para: override.nClt ?? null });
    if (!valorIgual(override.custoMensal ?? null, prevCusto)) changes.push({ campo: 'ajusteCusto', de: prevCusto, para: override.custoMensal ?? null });
    if (!changes.length) { setAberto(false); return; }
    void gravar(override, changes, 'alteracao');
  };

  const remover = () => {
    const changes: Mudanca[] = [];
    if (aj?.campos.includes('nClt')) changes.push({ campo: 'ajusteClt', de: aj.nClt ?? null, para: null });
    if (aj?.campos.includes('custoMensal')) changes.push({ campo: 'ajusteCusto', de: aj.custoMensal ?? null, para: null });
    if (changes.length) void gravar({}, changes, 'reversao');
  };

  const btn = 'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={`${btn} text-primary`} onClick={() => { setClt(row.clt); setCusto(row.custoMensal); setErroClt(null); setAberto(true); }}>
          <Pencil className="size-3.5" aria-hidden /> Ajustar no app
        </button>
        {row.ajustado && (
          <button type="button" className={`${btn} text-muted-foreground`} onClick={remover} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Undo2 className="size-3.5" aria-hidden />} Remover ajuste
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 w-full rounded-md border border-border bg-card p-3">
      <p className="mb-3 text-xs text-muted-foreground">
        Sobrepõe o cálculo automático (Equipes Revisadas: {autoClt ?? '—'} pessoas · {fmtBRL(autoCusto)}/mês). Fica guardado só no app.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="aj-clt">
            Nº pessoas (equipe fixa)<NumberField id="aj-clt" value={clt} onChange={(v) => { setClt(v); if (erroClt) setErroClt(null); }} />
          </label>
          {erroClt && <p role="alert" className="text-xs text-[hsl(var(--danger-ink))]">{erroClt}</p>}
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="aj-custo">Custo mensal (equipe fixa)<NumberField id="aj-custo" value={custo} onChange={setCusto} step={100} prefix="R$" /></label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setAberto(false)} disabled={busy} className="min-h-9 rounded-md border border-border bg-card px-3 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
        <button type="button" onClick={salvar} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Guardar no app
        </button>
      </div>
    </div>
  );
}
