import { useEffect, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import BatchConfirm from '@generated/components/automatch/BatchConfirm';
import { Cobertura, Distribuicao } from '@generated/components/automatch/DiagSections';
import { diagnosticoAsync } from '@generated/lib/diagnostico';
import { familiaLabels } from '@generated/lib/compatibilidadeArea';
import { normKey, clean } from '@generated/lib/normalize';
import { cn } from '@lib/utils';

const LEVELS = [
  ['2', 'Compatível', 'bg-[hsl(var(--success))]'], ['1', 'Parcial', 'bg-[hsl(var(--warning))]'],
  ['0', 'Incompatível', 'bg-destructive'], ['sem', 'Sem informação', 'bg-muted-foreground/50'],
];
const pct = (n, t) => (t ? `${Math.round((n / t) * 100)}%` : '0%');
const txt = (v) => (Array.isArray(clean(v)) ? clean(v).join(', ') : clean(v)) || '—';

function SemInfo({ title, rows, cols }) {
  const [q, setQ] = useState('');
  const f = rows.filter((x) => !q || normKey(x.item.name).includes(normKey(q)));
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title} ({rows.length})</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label={`Buscar em ${title}`} className="h-8 w-48 rounded-full border border-border bg-background px-3 text-xs outline-none focus:border-primary/60" />
      </div>
      <div className="max-h-56 overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="p-2 text-left font-normal">Nome</th>{cols.map(([, l]) => <th key={l} className="p-2 text-left font-normal">{l}</th>)}<th className="p-2 text-left font-normal">Motivo</th></tr></thead>
          <tbody>
            {f.map((x) => <tr key={x.item.id} className="border-t border-border"><td className="p-2 font-medium">{x.item.name}</td>{cols.map(([k, l]) => <td key={l} className="p-2">{txt(x.item[k])}</td>)}<td className="p-2 text-muted-foreground">{x.a.kind === 'generalista' ? `Generalista · ${x.a.motivo}` : x.a.motivo}</td></tr>)}
            {!f.length && <tr><td colSpan={cols.length + 2} className="p-4 text-center text-muted-foreground">Nada aqui.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Diagnostico({ vagas, perfis, loading }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(null);
  const [prog, setProg] = useState(null);
  useEffect(() => {
    if (!open || loading) return undefined;
    let cancelled = false;
    setProg({ d: 0, t: 1 });
    diagnosticoAsync(vagas, perfis, (dd, t) => !cancelled && setProg({ d: dd, t }), () => cancelled)
      .then((r) => { if (!cancelled && r) { setD(r); setProg(null); } })
      .catch((e) => { console.error('[diagnostico]', e); if (!cancelled) setProg(null); });
    return () => { cancelled = true; };
  }, [open, loading, vagas, perfis]);
  const total = d ? Object.values(d.totals).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:border-primary/50"><Activity className="h-4 w-4" />Diagnóstico de compatibilidade</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Diagnóstico de compatibilidade</DialogTitle>
            <DialogDescription>Somente leitura (exceto “Confirmar sugestões”). Todos os perfis elegíveis × vagas abertas de qualquer mês.</DialogDescription>
          </DialogHeader>
          {prog || !d ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-sm text-muted-foreground">Calculando… {prog ? `${prog.d} de ${prog.t} vagas` : ''}</p>
              <div className="h-1.5 w-64 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full bg-primary transition-[width]" style={{ width: pct(prog?.d ?? 0, prog?.t ?? 1) }} /></div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {d.pctPerfisSem > 0.3 && (
                <p className="flex items-start gap-2 rounded-md border border-[hsl(var(--warning)/0.5)] bg-[hsl(var(--warning)/0.1)] p-3 text-sm text-[hsl(var(--warning))]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A trava está operando sem informação suficiente — preencha a Família de área. ({pct(d.perfisSem.length, d.nPerfis)} dos perfis sem informação ou generalistas)</p>
              )}
              {d.explicitasDemais.length > 0 && (
                <p className="flex items-start gap-2 rounded-md border border-[hsl(var(--warning)/0.5)] bg-[hsl(var(--warning)/0.1)] p-3 text-xs"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" /><span><span className="font-medium">{d.explicitasDemais.length} item(ns) com mais de 2 famílias na coluna explícita</span> — reduz a precisão da trava: {d.explicitasDemais.map((x) => `${x.item.name} (${familiaLabels(x.a.fams).join(', ')})`).join('; ')}</span></p>
              )}
              <Cobertura c={d.cobertura} nPerfis={d.nPerfis} nVagas={d.nVagas} />
              <Distribuicao d={d} />
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Pares por nível de área · {d.nPerfis} perfis × {d.nVagas} vagas = {total} pares</h3>
                <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {LEVELS.map(([k, l, c]) => d.totals[k] > 0 && <div key={k} className={c} style={{ width: pct(d.totals[k], total) }} title={`${l}: ${d.totals[k]}`} />)}
                </div>
                <table className="w-full max-w-md text-xs"><tbody>
                  {LEVELS.map(([k, l, c]) => <tr key={k} className="border-t border-border"><td className="p-1.5"><span className={cn('mr-2 inline-block h-2.5 w-2.5 rounded-full', c)} />{l}</td><td className="p-1.5 text-right tabular-nums">{d.totals[k]}</td><td className="p-1.5 text-right tabular-nums text-muted-foreground">{pct(d.totals[k], total)}</td></tr>)}
                </tbody></table>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Por vaga</h3>
                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="p-2 text-left font-normal">Vaga</th><th className="p-2 text-right font-normal">Compatíveis</th><th className="p-2 text-right font-normal">Parciais</th><th className="p-2 text-right font-normal">Incompatíveis</th><th className="p-2 text-right font-normal">Sem info</th><th className="p-2 text-right font-normal">Em “Indicar”</th></tr></thead>
                    <tbody>{d.porVaga.map((r) => (
                      <tr key={r.vaga.id} className={cn('border-t border-border', !r.indicar && 'bg-destructive/5 text-destructive')}>
                        <td className="max-w-[280px] truncate p-2" title={r.vaga.name}>{r.vaga.name} <span className="opacity-60">· {r.vaga.id}</span></td>
                        <td className="p-2 text-right tabular-nums">{r[2]}</td><td className="p-2 text-right tabular-nums">{r[1]}</td><td className="p-2 text-right tabular-nums">{r[0]}</td><td className="p-2 text-right tabular-nums">{r.sem}</td><td className="p-2 text-right font-medium tabular-nums">{r.indicar}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
              <SemInfo title="Perfis sem família de área (sem informação ou generalistas)" rows={d.perfisSem} cols={[['papelDeOrigem', 'Papel de origem'], ['perfilReasDeAtuao', 'Áreas de atuação']]} />
              <SemInfo title="Vagas sem informação de área" rows={d.vagasSem} cols={[['eixoDeAtuao', 'Eixo'], ['cargoPapel', 'Cargo/Papel']]} />
              <BatchConfirm inferidos={d.inferidos} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
