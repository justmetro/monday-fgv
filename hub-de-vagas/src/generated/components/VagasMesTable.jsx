import { useMemo, useState } from 'react';
import { monthKey } from '@generated/lib/data';
import { canon, clean, normKey } from '@generated/lib/normalize';
import { cn } from '@lib/utils';

const SEM_MES = 'Sem mês';
const mesOf = (v) => clean(v.msRefIncioPrevistoVaga) ?? SEM_MES;
const sortMes = (a, b) => (a === SEM_MES ? 1 : b === SEM_MES ? -1 : monthKey(a) - monthKey(b));

// Item 4: preenchidas × pendentes por mês de referência (geral e por modalidade de contratação).
export default function VagasMesTable({ vagas, onOpen }) {
  const [mode, setMode] = useState('geral');
  const { meses, mods, cell } = useMemo(() => {
    const list = vagas.filter((v) => normKey(v.statusDaVaga) !== 'cancelada');
    const c = new Map();
    const ms = new Set(); const md = new Set();
    list.forEach((v) => {
      const m = mesOf(v); const mod = canon(v.modalidadeDeContratao) ?? 'Sem modalidade';
      ms.add(m); md.add(mod);
      [`${m}|*`, `${m}|${mod}`].forEach((k) => { const x = c.get(k) ?? { p: 0, n: 0 }; if (v._alocada) x.p += 1; else x.n += 1; c.set(k, x); });
    });
    return { meses: [...ms].sort(sortMes), mods: [...md].sort((a, b) => a.localeCompare(b, 'pt')), cell: (m, mod) => c.get(`${m}|${mod}`) ?? { p: 0, n: 0 } };
  }, [vagas]);
  const cols = mode === 'geral' ? ['*'] : mods;
  const tot = (mod) => meses.reduce((s, m) => { const x = cell(m, mod); return { p: s.p + x.p, n: s.n + x.n }; }, { p: 0, n: 0 });
  const Num = ({ x, m }) => (
    <>
      <td className="border-l border-border px-2 py-1.5 text-right tabular-nums text-[hsl(var(--success))]">{x.p || '—'}</td>
      <td className="px-2 py-1.5 text-right tabular-nums"><button disabled={!m || !x.n} onClick={() => onOpen(m)} className={cn(x.n ? 'font-medium text-destructive hover:underline' : 'text-muted-foreground')}>{x.n || '—'}</button></td>
    </>
  );
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Vagas por mês de referência · preenchidas × pendentes</h2>
        <div className="flex rounded-full border border-border p-0.5 text-xs" aria-label="Visão">
          {[['geral', 'Visão geral'], ['mod', 'Por modalidade']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={cn('h-7 rounded-full px-3', mode === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
          ))}
        </div>
      </div>
      <div className="max-h-96 overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[420px] text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr><th rowSpan={2} className="px-2 py-1.5 text-left font-normal">Mês de referência</th>{cols.map((c) => <th key={c} colSpan={2} className="border-l border-border px-2 py-1.5 text-center font-medium">{c === '*' ? 'Total' : c}</th>)}</tr>
            <tr>{cols.map((c) => [<th key={`${c}p`} className="border-l border-border px-2 py-1 text-right font-normal">Preench.</th>, <th key={`${c}n`} className="px-2 py-1 text-right font-normal">Pend.</th>])}</tr>
          </thead>
          <tbody>
            {meses.map((m) => <tr key={m} className="border-t border-border"><th scope="row" className="px-2 py-1.5 text-left font-normal">{m}</th>{cols.map((c) => <Num key={c} x={cell(m, c)} m={m === SEM_MES ? null : m} />)}</tr>)}
            <tr className="border-t-2 border-border font-medium"><th scope="row" className="px-2 py-1.5 text-left">Total</th>{cols.map((c) => <Num key={c} x={tot(c)} m={null} />)}</tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Preenchida = vaga fechada (status Preenchida, data de preenchimento ou forma de preenchimento concluída). Pendente = demais, exceto canceladas. Clique em um número pendente para abrir as vagas do mês.</p>
    </section>
  );
}
