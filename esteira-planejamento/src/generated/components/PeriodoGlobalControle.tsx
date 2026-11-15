import { useState } from 'react';
import { CalendarRange, ChevronDown, TriangleAlert, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { cn } from '@lib/utils';
import { type PeriodoGlobal, anoDoPeriodo, atalho, mesesDoAno, rotuloPeriodoGlobal, MESES_CURTOS } from '@generated/lib/periodo';
import { InfoDica } from '@generated/components/ui-bits';

const campo = 'h-11 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 md:h-8';
const pill = (on: boolean) => cn('h-11 rounded-[var(--radius-sm)] border px-2 text-xs transition-colors md:h-7',
  on ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--accent-soft))] text-foreground' : 'border-input text-muted-foreground hover:text-foreground');
const titulo = 'mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground';

/**
 * Global period filter: year (default = current year; "Todos os anos") → quarter → months, plus interval and shortcuts.
 * `referencia` explains the date used by the tab; `semData` = projects of the tab without that date.
 */
export function PeriodoGlobalControle({ valor, onChange, referencia, semData }: {
  valor: PeriodoGlobal | null; onChange: (p: PeriodoGlobal | null) => void; referencia: string; semData?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const atual = new Date().getFullYear();
  const anoSel = anoDoPeriodo(valor);
  const anoBase = anoSel ?? atual;
  const anos = [...new Set([atual + 1, ...Array.from({ length: 6 }, (_, i) => atual - i), ...(anoSel ? [anoSel] : [])])].sort((a, b) => b - a);
  const mesesSel = valor?.tipo === 'meses' ? valor.meses : [];
  const toggleMes = (m: string) => {
    const n = mesesSel.includes(m) ? mesesSel.filter((x) => x !== m) : [...mesesSel, m].sort();
    onChange(n.length ? { tipo: 'meses', meses: n } : { tipo: 'ano', ano: anoBase });
  };
  const de = valor?.tipo === 'intervalo' ? valor.de : '';
  const ate = valor?.tipo === 'intervalo' ? valor.ate : '';
  const refinado = !!valor && valor.tipo !== 'ano';

  return (
    <div className="flex flex-wrap items-center gap-1">
      <label htmlFor="per-ano" className="sr-only">Ano</label>
      <select id="per-ano" value={valor ? String(anoSel ?? '') : 'todos'} onChange={(e) => onChange(e.target.value === 'todos' ? null : { tipo: 'ano', ano: Number(e.target.value) })}
        className={cn(campo, 'font-medium', valor && 'border-[hsl(var(--primary)/0.6)]')}>
        <option value="todos">Todos os anos</option>
        {anoSel === null && valor && <option value="">Vários anos</option>}
        {anos.map((a) => <option key={a} value={a}>{a}{a === atual ? ' (corrente)' : ''}</option>)}
      </select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={cn(campo, 'inline-flex items-center gap-1.5', refinado && 'border-[hsl(var(--primary)/0.6)]')}>
            <CalendarRange className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Período:</span> <span className="max-w-[180px] truncate">{refinado ? rotuloPeriodoGlobal(valor) : 'ano inteiro'}</span>
            <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} className="w-[340px] max-w-[calc(100vw-24px)] rounded-[var(--radius-lg)] border-border p-3 shadow-none">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Atalhos</p>
          <div className="flex flex-wrap gap-1">
            {([['mes', 'Mês atual'], ['3m', 'Últimos 3 meses'], ['6m', 'Últimos 6 meses'], ['ano', 'Ano corrente']] as const).map(([k, l]) => (
              <button key={k} type="button" className={pill(false)} onClick={() => { onChange(atalho(k)); setOpen(false); }}>{l}</button>
            ))}
          </div>
          <p className={titulo}>Trimestre de {anoBase}</p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" className={pill(valor?.tipo === 'ano')} onClick={() => onChange({ tipo: 'ano', ano: anoBase })}>Ano inteiro</button>
            {([1, 2, 3, 4] as const).map((t) => (
              <button key={t} type="button" className={pill(valor?.tipo === 'trimestre' && valor.ano === anoBase && valor.t === t)}
                onClick={() => onChange({ tipo: 'trimestre', ano: anoBase, t })}>T{t}</button>
            ))}
          </div>
          <p className={titulo}>Meses de {anoBase} (um ou mais)</p>
          <div className="grid grid-cols-6 gap-1">
            {mesesDoAno(anoBase).map((m, i) => <button key={m} type="button" className={pill(mesesSel.includes(m))} onClick={() => toggleMes(m)}>{MESES_CURTOS[i]}</button>)}
          </div>
          <p className={titulo}>Intervalo</p>
          <div className="flex items-center gap-1">
            <input type="date" aria-label="De" value={de} max={ate || undefined} className={cn(campo, 'min-w-0 flex-1')}
              onChange={(e) => onChange(e.target.value || ate ? { tipo: 'intervalo', de: e.target.value, ate } : { tipo: 'ano', ano: anoBase })} />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date" aria-label="Até" value={ate} min={de || undefined} className={cn(campo, 'min-w-0 flex-1')}
              onChange={(e) => onChange(de || e.target.value ? { tipo: 'intervalo', de, ate: e.target.value } : { tipo: 'ano', ano: anoBase })} />
          </div>
          <p className="mt-3 text-[11px] text-[hsl(var(--fg-subtle))]">Data de referência nesta aba: {referencia}.</p>
        </PopoverContent>
      </Popover>
      <InfoDica texto={`Filtra pela ${referencia}. Padrão: ano corrente (muda sozinho na virada do ano). Projetos sem essa data aparecem em “Todos os anos”; nas abas por Data de Assinatura, os não assinados também aparecem no ano corrente.`} />
      {refinado && (
        <button type="button" aria-label="Voltar para o ano inteiro" onClick={() => onChange({ tipo: 'ano', ano: anoBase })}
          className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-accent hover:text-foreground md:size-7">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      {!!semData && (
        valor ? (
          <button type="button" onClick={() => onChange(null)} title="Projetos sem a data de referência desta aba"
            className="inline-flex h-11 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-[11px] text-[hsl(var(--warning))] hover:underline md:h-7">
            <TriangleAlert className="size-3" aria-hidden /> Sem data: {semData} fora do filtro · ver em Todos os anos
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 text-[11px] text-muted-foreground">
            <TriangleAlert className="size-3 text-[hsl(var(--warning))]" aria-hidden /> inclui {semData} sem data
          </span>
        )
      )}
    </div>
  );
}
