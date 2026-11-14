import { AlertTriangle } from 'lucide-react';
import { cn } from '@lib/utils';

const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);

function CovList({ title, rows }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const p = pct(r.n, r.N);
          const zero = r.n === 0;
          return (
            <li key={r.prop} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-xs', zero && 'text-destructive')}>
              <span className="truncate" title={r.title}>{r.title}</span>
              <span className="tabular-nums">{r.n}/{r.N} · {p}%</span>
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><span className={cn('block h-full', zero ? 'bg-destructive' : p < 50 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--success))]')} style={{ width: `${Math.max(p, zero ? 0 : 2)}%` }} /></span>
              {zero && <span className="col-span-2 flex items-center gap-1 text-[11px]"><AlertTriangle className="h-3 w-3" />vazio no quadro ou não carregado</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Cobertura({ c, nPerfis, nVagas }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Cobertura de dados</h3>
      <p className="text-xs text-muted-foreground">Percentual preenchido nos itens elegíveis ({nPerfis} perfis, {nVagas} vagas).</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <CovList title="Perfis elegíveis" rows={c.perfis} />
        <CovList title="Vagas elegíveis" rows={c.vagas} />
      </div>
    </section>
  );
}

function Bars({ title, entries, total }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-3">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <table className="mt-1 w-full text-xs"><tbody>
        {entries.map(([l, n]) => (
          <tr key={l} className="border-t border-border first:border-t-0">
            <th scope="row" className="py-1 pr-2 text-left font-normal">{l}</th>
            <td className="w-full py-1" aria-label={`${pct(n, total)}%`}><span className="block h-1.5 rounded-full bg-primary/70" style={{ width: `${pct(n, total)}%` }} aria-hidden /></td>
            <td className="py-1 pl-2 text-right tabular-nums">{n}</td>
            <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">{pct(n, total)}%</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

export function Distribuicao({ d }) {
  const { dist, origem } = d;
  const oe = (o) => [['Explícita', o.explicita], ['Inferida', o.inferida], ['Generalista', o.generalista], ['Sem informação', o.sem]];
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Distribuição · {dist.pares} pares ({dist.eliminados} eliminados pelas regras)</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Bars title="Faixa quantitativa (viabilidade)" total={dist.pares} entries={[['Alto', dist.quant.alto], ['Médio', dist.quant.medio], ['Baixo', dist.quant.baixo]]} />
        <Bars title="Faixa qualitativa" total={dist.pares} entries={[['Alta', dist.qual.alta], ['Média', dist.qual.media], ['Baixa', dist.qual.baixa]]} />
        <Bars title="Quadrante" total={dist.pares} entries={[['Indicar', dist.quad.indicar], ['Potencial', dist.quad.potencial], ['Verificar', dist.quad.verificar], ['Descartar', dist.quad.descartar]]} />
        <Bars title="Origem da família · perfis" total={d.nPerfis} entries={oe(origem.perfis)} />
        <Bars title="Origem da família · vagas" total={d.nVagas} entries={oe(origem.vagas)} />
      </div>
    </section>
  );
}
