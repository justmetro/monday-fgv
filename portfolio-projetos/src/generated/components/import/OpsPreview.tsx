import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { EMPTY_PRODUCT_STATUS, EMPTY_RISK_STATUS, EMPTY_SCHEDULE_STATUS, type ProjectConfig } from '@generated/lib/fields';
import { fmtDate } from '@generated/lib/format';
import { fmtBRL } from '@generated/lib/money';
import type { Preview } from './ImportWizard';
import { LabelPicker } from './MappingStep';

function OrderPicker({ title, hint, labels, value, onChange }: { title: string; hint: string; labels: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const list = [...value.filter((v) => labels.includes(v)), ...labels.filter((l) => !value.includes(l))];
  const move = (i: number, d: number) => { const n = [...list]; const [x] = n.splice(i, 1); if (x !== undefined) n.splice(i + d, 0, x); onChange(n); };
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      {list.length === 0 ? <p className="text-xs italic text-muted-foreground">Nenhum rótulo encontrado.</p> : (
        <ol className="space-y-1">
          {list.map((l, i) => (
            <li key={l} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
              <span className="w-5 font-mono text-muted-foreground">{i + 1}</span><span className="min-w-0 flex-1 truncate">{l}</span>
              <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="flex size-8 items-center justify-center rounded hover:bg-muted disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
              <button type="button" aria-label="Descer" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="flex size-8 items-center justify-center rounded hover:bg-muted disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Block({ title, count, children }: { title: string; count: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-semibold">{title}</h4><span className="font-mono text-xs text-muted-foreground">{count}</span></div>
      {children}
    </section>
  );
}

const Unav = ({ list }: { list: string[] }) => (list.length ? <p className="text-xs text-[hsl(var(--warn))]">Campos indisponíveis na leitura: {list.join(', ')}</p> : null);

export function OpsPreview({ p, cfg, setCfg, labels }: { p: Preview; cfg: ProjectConfig; setCfg: (c: ProjectConfig) => void; labels: { sched: string[]; health: string[]; prod: string[]; pay: string[]; level: string[]; prob: string[]; imp: string[] } }) {
  const ss = cfg.scheduleStatus ?? EMPTY_SCHEDULE_STATUS;
  const ps = cfg.productStatus ?? EMPTY_PRODUCT_STATUS;
  const rs = cfg.riskStatus ?? EMPTY_RISK_STATUS;
  return (
    <div className="space-y-4">
      {p.sched && (
        <Block title="Cronograma" count={`${p.sched.count} atividades · ${p.sched.subCount} subatividades${p.sched.count > 40 ? ' (amostra das 40 primeiras atividades)' : ''}`}>
          <ul className="space-y-1 text-xs">{p.sched.sample.map((x) => <li key={x.itemId} className="rounded border border-border p-2"><b>{x.name}</b><br /><span className="text-muted-foreground">{x.status ?? 'sem status'} · {x.responsaveis.join(', ') || 'sem responsável'} · {fmtDate(x.inicioPlanejado)} – {fmtDate(x.fimPlanejado)} · {x.produtoIds.length} produto(s)</span></li>)}</ul>
          <Unav list={p.sched.unavailable} />
          <div><p className="mb-1 text-xs font-medium">Itens sem produto vinculado resolvido ({p.sched.unresolved.length})</p>
            {p.sched.unresolved.length > 0 && <ul className="max-h-32 overflow-y-auto rounded-md border border-border text-xs">{p.sched.unresolved.map((u) => <li key={u.itemId} className="flex justify-between gap-2 border-b border-border/60 px-2 py-1.5 last:border-0"><span className="truncate">{u.name}</span><span className="shrink-0 text-[hsl(var(--warn))]">{u.motivo}</span></li>)}</ul>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <LabelPicker title="Status → Concluída" hint="Não contam como atrasadas." labels={labels.sched} value={ss.concluded} onChange={(v) => setCfg({ ...cfg, scheduleStatus: { ...ss, concluded: v } })} />
            <LabelPicker title="Status → Excluída (cancelada/despriorizada)" hint="Fora do % de conclusão e dos atrasos." labels={labels.sched} value={ss.excluded} onChange={(v) => setCfg({ ...cfg, scheduleStatus: { ...ss, excluded: v } })} />
            <LabelPicker title="Saúde → Em dia" hint="Semáforo verde." labels={labels.health} value={ss.healthOk} onChange={(v) => setCfg({ ...cfg, scheduleStatus: { ...ss, healthOk: v } })} />
            <LabelPicker title="Saúde → Atenção" hint="Semáforo amarelo." labels={labels.health} value={ss.healthWarn} onChange={(v) => setCfg({ ...cfg, scheduleStatus: { ...ss, healthWarn: v } })} />
            <LabelPicker title="Saúde → Crítica" hint="Semáforo vermelho." labels={labels.health} value={ss.healthBad} onChange={(v) => setCfg({ ...cfg, scheduleStatus: { ...ss, healthBad: v } })} />
          </div>
        </Block>
      )}
      {p.prods && (
        <Block title="Produtos" count={`${p.prods.count} produtos`}>
          <ul className="space-y-1 text-xs">{p.prods.sample.map((x) => <li key={x.itemId} className="rounded border border-border p-2"><b>{x.name}</b><br /><span className="text-muted-foreground">{x.status ?? 'sem status'} · Valor {fmtBRL(x.valor)} · Entrega planejada {fmtDate(x.entregaPlanejada)} · Pagamento {x.statusPagamento ?? '—'}</span></li>)}</ul>
          <Unav list={p.prods.unavailable} />
          <div className="grid gap-4 md:grid-cols-2">
            <LabelPicker title="Status Produto → Entregue" hint="Entregue mesmo sem Entrega Real preenchida." labels={labels.prod} value={ps.delivered} onChange={(v) => setCfg({ ...cfg, productStatus: { ...ps, delivered: v } })} />
            <LabelPicker title="Status Pagamento → Pago" hint="Demais rótulos de produto entregue = pagamento pendente." labels={labels.pay} value={ps.paid} onChange={(v) => setCfg({ ...cfg, productStatus: { ...ps, paid: v } })} />
          </div>
        </Block>
      )}
      {p.risks && (
        <Block title="Riscos" count={`${p.risks.count} riscos`}>
          <ul className="space-y-1 text-xs">{p.risks.sample.map((x) => <li key={x.itemId} className="rounded border border-border p-2"><b>{x.name}</b><br /><span className="text-muted-foreground">Nível {x.nivel ?? '—'} · Probabilidade {x.probabilidadeStatus ?? '—'} (fórmula {x.probabilidadeFormula ?? '—'}) · Impacto {x.impactoStatus ?? '—'} (fórmula {x.impactoFormula ?? '—'})</span></li>)}</ul>
          <Unav list={p.risks.unavailable} />
          <div className="grid gap-4 md:grid-cols-3">
            <OrderPicker title="Ordem dos níveis" hint="Do menor para o maior." labels={labels.level} value={rs.levels} onChange={(v) => setCfg({ ...cfg, riskStatus: { ...rs, levels: v } })} />
            <OrderPicker title="Ordem da probabilidade" hint="Do menor para o maior (posição = valor da fórmula)." labels={labels.prob} value={rs.probability} onChange={(v) => setCfg({ ...cfg, riskStatus: { ...rs, probability: v } })} />
            <OrderPicker title="Ordem do impacto" hint="Do menor para o maior (posição = valor da fórmula)." labels={labels.imp} value={rs.impact} onChange={(v) => setCfg({ ...cfg, riskStatus: { ...rs, impact: v } })} />
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm">Considerar atualização antiga após
            <input type="number" min={1} max={3650} value={rs.staleDays} onChange={(e) => setCfg({ ...cfg, riskStatus: { ...rs, staleDays: Math.max(1, Number(e.target.value) || 30) } })} className="h-10 w-20 rounded-md border border-input bg-card px-2 text-sm" aria-label="Dias sem atualização" />dias
          </label>
        </Block>
      )}
    </div>
  );
}
