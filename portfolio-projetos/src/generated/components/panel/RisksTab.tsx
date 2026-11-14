import { isActive } from '@generated/lib/risk-period';
import type { RiskDoc } from '@generated/models';
import type { OpsModel, OpsScope } from '@generated/lib/ops';
import { useState } from 'react';
import { cn } from '@lib/utils';
import { BarCard, countBy, KpiRow } from './ChartCard';
import type { OpsDrill } from './OpsDrillSheet';
import { Panel, SectionTitle } from '../ui-bits';


/** Ordem global dos rótulos: posição média normalizada nas escalas configuradas por projeto. */
function globalOrder(m: OpsModel, list: RiskDoc[], kind: 'probability' | 'impact' | 'levels', get: (r: RiskDoc) => string | null) {
  const acc = new Map<string, { s: number; n: number }>();
  list.forEach((r) => {
    const v = get(r); if (!v) return;
    const sc = m.scaleOf(r.projectBoardId, kind); const i = sc.indexOf(v);
    const a = acc.get(v) ?? { s: 0, n: 0 };
    if (i >= 0) { a.s += sc.length > 1 ? i / (sc.length - 1) : 0; a.n++; }
    acc.set(v, a);
  });
  return [...acc.entries()].sort((a, b) => (a[1].n ? a[1].s / a[1].n : 2) - (b[1].n ? b[1].s / b[1].n : 2)).map(([k]) => k);
}

/** Aba Riscos do Painel gerencial. */
export function RisksTab({ m, s, onDrill }: { m: OpsModel; s: OpsScope; onDrill: (d: OpsDrill) => void }) {
  const [onlyActive, setOnlyActive] = useState(false);
  const activeList = s.risks.filter((r) => isActive(r.periodo, m.today));
  const all = onlyActive ? activeList : s.risks;
  const probs = globalOrder(m, all, 'probability', (r) => r.probabilidadeStatus);
  const imps = globalOrder(m, all, 'impact', (r) => r.impactoStatus);
  const levels = globalOrder(m, all, 'levels', (r) => r.nivel);
  const stale = all.filter((r) => r.flagAtualizacaoAntiga);
  const noResp = all.filter((r) => r.flagSemResponsavel);
  const outside = all.filter((r) => !r.probabilidadeStatus || !r.impactoStatus);
  const sev = (pi: number, ii: number) => { const t = (pi / Math.max(1, probs.length - 1) + ii / Math.max(1, imps.length - 1)) / 2; return t >= 0.67 ? 'bg-[hsl(var(--pal-5)/0.75)]' : t >= 0.34 ? 'bg-[hsl(var(--pal-4)/0.55)]' : 'bg-[hsl(var(--pal-2)/0.45)]'; };
  const lvlColor = (name: string) => { const i = levels.indexOf(name); const t = levels.length > 1 ? i / (levels.length - 1) : 0; return i < 0 ? '#8A93C6' : t >= 0.67 ? '#EE6184' : t >= 0.34 ? '#D0CB00' : '#5CBCD0'; };

  const toggle = (
    <div className="flex flex-wrap items-center gap-3">
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 text-sm">
        <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="size-4 accent-[hsl(var(--pal-1))]" />
        Somente riscos ativos <span className="font-mono text-xs text-muted-foreground">({activeList.length})</span>
      </label>
      <span className="text-xs text-muted-foreground">Ativo = a data de hoje está dentro do Período do Risco.</span>
    </div>
  );
  if (s.risks.length === 0) return <Panel><p className="py-8 text-center text-sm text-muted-foreground">Nenhum risco no recorte. Configure o grupo Riscos dos projetos na tela de Importação.</p></Panel>;
  if (all.length === 0) return <div className="space-y-5">{toggle}<Panel><p className="py-8 text-center text-sm text-muted-foreground">Nenhum risco com período vigente hoje.</p></Panel></div>;
  return (
    <div className="space-y-5">
      {toggle}
      <KpiRow items={[
        { label: 'Riscos', value: String(all.length), onClick: () => onDrill({ title: 'Riscos', risks: all }) },
        { label: 'Riscos ativos', value: String(activeList.length), tone: activeList.length ? 'warn' : undefined, hint: 'período inclui hoje', onClick: () => onDrill({ title: 'Riscos ativos (período vigente)', risks: activeList }) },
        { label: 'Sem atualização recente', value: String(stale.length), tone: stale.length ? 'warn' : undefined, onClick: () => onDrill({ title: 'Riscos sem atualização recente', risks: stale }) },
        { label: 'Sem responsável', value: String(noResp.length), tone: noResp.length ? 'warn' : undefined, hint: 'pelo monitoramento', onClick: () => onDrill({ title: 'Riscos sem responsável pelo monitoramento', risks: noResp }) },
        { label: 'Fora da matriz', value: String(outside.length), hint: 'sem probabilidade ou impacto', onClick: () => onDrill({ title: 'Riscos sem probabilidade ou impacto', risks: outside }) },
      ]} />
      <Panel>
        <SectionTitle>Matriz probabilidade × impacto</SectionTitle>
        {probs.length === 0 || imps.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Sem probabilidade e impacto preenchidos.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-1 text-sm">
              <tbody>
                {[...probs].reverse().map((p) => {
                  const pi = probs.indexOf(p);
                  return (
                    <tr key={p}>
                      <th scope="row" className="w-36 pr-2 text-right text-xs font-normal text-muted-foreground">{p}</th>
                      {imps.map((im, ii) => {
                        const items = all.filter((r) => r.probabilidadeStatus === p && r.impactoStatus === im);
                        return (
                          <td key={im} className="p-0">
                            <button disabled={!items.length} onClick={() => onDrill({ title: `Probabilidade ${p} × Impacto ${im}`, risks: items })}
                              className={cn('flex h-14 w-full items-center justify-center rounded font-mono text-lg tabular-nums text-foreground enabled:hover:ring-2 enabled:hover:ring-ring', items.length ? sev(pi, ii) : 'bg-muted/50 text-muted-foreground')}>
                              {items.length || '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr><th /><>{imps.map((im) => <th key={im} className="pt-1 text-center text-xs font-normal text-muted-foreground">{im}</th>)}</></tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Linhas: probabilidade (status). Colunas: impacto (status). A fórmula é usada apenas como checagem.</p>
          </div>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        <BarCard title="Por nível" data={countBy(all, (r) => r.nivel ?? 'Sem nível').sort((a, b) => levels.indexOf(b.name) - levels.indexOf(a.name))} colorBy={lvlColor} onPick={(d) => onDrill({ title: `Nível: ${d.name}`, risks: d.items })} />
        <BarCard title="Por categoria" data={countBy(all, (r) => r.categoria ?? 'Sem categoria')} onPick={(d) => onDrill({ title: `Categoria: ${d.name}`, risks: d.items })} />
        <BarCard title="Por tema" data={countBy(all, (r) => r.tema ?? 'Sem tema')} onPick={(d) => onDrill({ title: `Tema: ${d.name}`, risks: d.items })} />
      </div>
    </div>
  );
}
