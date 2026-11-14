import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { OpsModel, OpsScope } from '@generated/lib/ops';
import { productRisks, scheduleSpan, type ProductRisk, type RiskLevel } from '@generated/lib/product-risk';
import { Panel, SectionTitle } from '../ui-bits';

const LEVELS: RiskLevel[] = ['Crítico', 'Alto', 'Médio', 'Baixo'];
const TONE: Record<RiskLevel, string> = {
  Crítico: 'bg-[hsl(var(--pal-5))] text-white',
  Alto: 'bg-[hsl(var(--pal-4))] text-foreground',
  Médio: 'bg-[hsl(var(--pal-3))] text-white',
  Baixo: 'bg-[hsl(var(--pal-2))] text-foreground',
};
const fmtD = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');

function Factor({ label, pts, max, note }: { label: string; pts: number; max: number; note: string }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between gap-2 text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono tabular-nums">{pts}/{max}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(var(--pal-1))]" style={{ width: `${(pts / max) * 100}%` }} /></div>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

function Row({ r, m, open, toggle }: { r: ProductRisk; m: OpsModel; open: boolean; toggle: () => void }) {
  return (
    <Fragment>
      <tr className="border-t align-top">
        <td className="p-2">
          <button type="button" onClick={toggle} aria-label={open ? 'Recolher tarefas' : 'Ver tarefas'} className="flex min-h-[44px] items-start gap-1 text-left font-medium hover:underline">
            {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{r.product.name}<span className="block text-xs font-normal text-muted-foreground">{m.projectBy.get(r.product.projectBoardId)?.name ?? ''} · {(() => { const sp = scheduleSpan(r); return sp.from || sp.to ? <>atividades vinculadas {fmtD(sp.from)} a {fmtD(sp.to)}</> : <>sem atividades vinculadas</>; })()} · {r.tasks.length} tarefa(s)</span></span>
          </button>
        </td>
        <td className="p-2 text-sm">{r.product.status ?? 'Sem status'}</td>
        <td className="whitespace-nowrap p-2 text-xs tabular-nums">{r.product.planInicio || r.product.planEntrega ? <>{fmtD(r.product.planInicio ?? null)}<span className="text-muted-foreground"> a </span>{fmtD(r.product.planEntrega ?? null)}</> : <span className="text-muted-foreground">Sem "Planejado Início - Entrega"</span>}</td>
        <td className="p-2 text-right font-mono text-lg tabular-nums">{r.index}</td>
        <td className="p-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE[r.level]}`}>{r.level}</span></td>
        <td className="p-2">
          {r.special ? <p className="text-xs text-muted-foreground">Previsto em até 30 dias sem cronograma vinculado.</p> : (
            <div className="grid min-w-[420px] grid-cols-3 gap-3">
              <Factor label="Planejamento" pts={r.plan.pts} max={35} note={r.plan.note} />
              <Factor label="Atrasos" pts={r.late.pts} max={35} note={r.late.note} />
              <Factor label="Ritmo" pts={r.pace.pts} max={30} note={r.pace.note} />
            </div>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/40"><td colSpan={6} className="p-3">
          {r.tasks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma atividade do cronograma vinculada a este produto.</p> : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {r.tasks.map((t) => (
                <li key={`${t.kind}-${t.name}-${t.fim ?? ''}`} className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1">
                  <span className="min-w-0 truncate"><span className="text-xs text-muted-foreground">{t.kind === 'atividade' ? 'Ativ.' : 'Subativ.'} </span>{t.name}</span>
                  <span className="shrink-0 text-xs">{t.status ?? '—'} · {fmtD(t.inicio)} a {fmtD(t.fim)}{t.late && <span className="ml-1 font-medium text-destructive">atrasada</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </td></tr>
      )}
    </Fragment>
  );
}

/** Índice de Risco por produto em aberto (cronograma × produto). */
export function ProductRiskPanel({ m, s }: { m: OpsModel; s: OpsScope }) {
  const rows = useMemo(() => productRisks(m, s), [m, s]);
  const [lvl, setLvl] = useState<RiskLevel | ''>('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [help, setHelp] = useState(false);
  const [monthOnly, setMonthOnly] = useState(false);
  const [page, setPage] = useState(0);
  const ym = m.today.slice(0, 7);
  const monthLabel = `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
  // Produtos cujo "Planejado Início - Entrega" termina no mês atual.
  const base = monthOnly ? rows.filter((r) => (r.product.planEntrega ?? '').slice(0, 7) === ym) : rows;
  const filtered = lvl ? base.filter((r) => r.level === lvl) : base;
  const PAGE = 20;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = filtered.slice(cur * PAGE, cur * PAGE + PAGE);
  const id = (r: ProductRisk) => `${r.product.projectBoardId}:${r.product.itemId}`;
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Índice de risco dos produtos em aberto</SectionTitle>
        <button type="button" onClick={() => setHelp(!help)} className="inline-flex min-h-[44px] items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Info className="h-4 w-4" />Metodologia</button>
      </div>
      {help && (
        <div className="mb-3 rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
          <p><b>Planejamento incompatível (35)</b>: margem entre a entrega prevista e o último término das tarefas — negativa 35 · 0-2 dias 25 · 3-7 dias 15 · 8-14 dias 5 · &gt;14 dias 0.</p>
          <p><b>Tarefas atrasadas (35)</b>: % de tarefas com saúde "Atrasado" — &gt;50% 35 · 30-50% 25 · 15-30% 15 · 5-15% 5 · &lt;5% 0.</p>
          <p><b>Gap de ritmo (30)</b>: conclusões/dia desde o início × necessárias até a entrega — &gt;80% 30 · 50-80% 20 · 25-50% 10 · suficiente 0.</p>
          <p><b>Níveis</b>: ≥70 Crítico · 45-69 Alto · 20-44 Médio · &lt;20 Baixo. Produto previsto em ≤30 dias sem cronograma = 100.</p>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => { setLvl(''); setPage(0); }} className={`min-h-[36px] rounded-full border px-3 text-xs ${lvl === '' ? 'bg-foreground text-background' : ''}`}>Todos ({base.length})</button>
        {LEVELS.map((l) => (
          <button key={l} type="button" onClick={() => { setLvl(l); setPage(0); }} className={`min-h-[36px] rounded-full border px-3 text-xs ${lvl === l ? 'bg-foreground text-background' : ''}`}>{l} ({base.filter((r) => r.level === l).length})</button>
        ))}
        <label className="ml-auto inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3 text-xs">
          <input type="checkbox" checked={monthOnly} onChange={(e) => { setMonthOnly(e.target.checked); setPage(0); }} className="h-4 w-4 accent-[hsl(var(--pal-1))]" />
          Entrega planejada em {monthLabel}
        </label>
      </div>
      {shown.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum produto em aberto neste recorte.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-muted-foreground"><tr><th className="p-2">Produto</th><th className="p-2">Status</th><th className="p-2">Cronograma</th><th className="p-2 text-right">Índice</th><th className="p-2">Nível</th><th className="p-2">Fatores de risco</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <Row key={id(r)} r={r} m={m} open={open.has(id(r))} toggle={() => setOpen((o) => { const n = new Set(o); if (n.has(id(r))) n.delete(id(r)); else n.add(id(r)); return n; })} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > PAGE && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{cur * PAGE + 1}–{Math.min(filtered.length, (cur + 1) * PAGE)} de {filtered.length} produtos</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="min-h-[36px] rounded-md border px-3 disabled:opacity-40">Anterior</button>
            <span className="px-2 tabular-nums">Página {cur + 1} de {pages}</span>
            <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="min-h-[36px] rounded-md border px-3 disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}
    </Panel>
  );
}
