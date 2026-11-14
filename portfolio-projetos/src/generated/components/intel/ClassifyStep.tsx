import { useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { IndicatorClassDoc, IndicatorDoc } from '@generated/models';
import { classifyBatch } from '@generated/server/intel';
import { ikey, signatureOf } from '@generated/lib/intel-sig';

export function classStatus(i: IndicatorDoc, c: IndicatorClassDoc | undefined) {
  if (!c) return 'none' as const;
  if (c.assinatura !== signatureOf(i)) return c.revisado ? ('changedReviewed' as const) : ('changed' as const);
  return c.revisado ? ('reviewed' as const) : ('ok' as const);
}

export function ClassifyStep({ scope, classes, onChanged, onNext }: { scope: IndicatorDoc[]; classes: IndicatorClassDoc[]; onChanged: () => Promise<void>; onNext: () => void }) {
  const by = useMemo(() => new Map(classes.map((c) => [c.key, c])), [classes]);
  const st = scope.map((i) => ({ i, s: classStatus(i, by.get(ikey(i.projectBoardId, i.itemId))) }));
  const n = (s: string) => st.filter((x) => x.s === s).length;
  const need = st.filter((x) => x.s === 'none' || x.s === 'changed' || x.s === 'changedReviewed').map((x) => ikey(x.i.projectBoardId, x.i.itemId));
  const [run, setRun] = useState<{ done: number; total: number } | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const classify = async () => {
    setAiErr(null);
    setRun({ done: 0, total: need.length });
    const tot = { classified: 0, reused: 0, flagged: 0, rejected: 0 };
    try {
      for (let x = 0; x < need.length; x += 20) {
        const r = await classifyBatch({ data: { keys: need.slice(x, x + 20) } });
        tot.classified += r.classified; tot.reused += r.reused; tot.flagged += r.flagged; tot.rejected += r.rejected;
        setRun({ done: Math.min(x + 20, need.length), total: need.length });
      }
      toast.success('Classificação concluída', { description: `${tot.classified} classificados · ${tot.reused} reaproveitados · ${tot.flagged} revisados com texto alterado (sinalizados) · ${tot.rejected} rejeitados na validação` });
    } catch (e) {
      console.error(e);
      setAiErr('O recurso de IA não respondeu ou não está disponível agora. Você pode tentar novamente ou classificar manualmente na próxima etapa.');
    } finally { setRun(null); await onChanged(); }
  };

  const tiles = [
    { l: 'Indicadores no recorte', v: scope.length },
    { l: 'Revisados', v: n('reviewed') },
    { l: 'Classificados (sugestão da IA)', v: n('ok') },
    { l: 'Texto alterado após classificação', v: n('changed') + n('changedReviewed') },
    { l: 'Não classificados', v: n('none') },
  ];
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-5">
        {tiles.map((t) => <div key={t.l} className="bg-card p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.l}</p><p className="mt-1 font-mono text-2xl">{t.v}</p></div>)}
      </div>
      <p className="text-sm text-muted-foreground">
        A IA classifica cada indicador em <b className="text-foreground">tema → subtema → família</b> com base em nome, descrição, objetivo, unidade, fórmula, tipo, temporalidade e polaridade. Desempenho e eixo não são usados.
        Classificações com textos inalterados são reaproveitadas sem nova chamada; classificações revisadas nunca são sobrescritas — se o texto mudar, são apenas sinalizadas.
      </p>
      {aiErr && <p className="rounded-md bg-[hsl(var(--bad-soft))] p-3 text-sm text-destructive">{aiErr}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={() => void classify()} disabled={!!run || need.length === 0} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-4 text-sm disabled:opacity-50">
          {run ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {run ? `Classificando ${run.done}/${run.total}…` : need.length ? `Classificar ${need.length} indicador(es) com IA` : 'Nada novo para classificar'}
        </button>
        <button onClick={onNext} disabled={!!run} className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Revisar agrupamentos</button>
      </div>
    </section>
  );
}
