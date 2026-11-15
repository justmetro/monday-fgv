import { useMemo } from 'react';
import { cn } from '@lib/utils';
import type { Projeto } from '@generated/lib/format';
import { MESES_CURTOS } from '@generated/lib/periodo';
import { type ResAcumulado, mesReferencia, regraResAcumulado } from '@generated/lib/resAcumulado';
import { tempoPorTrimestre, indicadoresIt, fmtIt } from '@generated/lib/metricas';
import { InfoDica } from '@generated/components/ui-bits';
import { Anel } from '@generated/components/fx/Anel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';

const dia1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmtDias1 = (v: number | null) => (v === null ? '—' : `${dia1.format(v)} dias`);

/** "Tempo de planejamento": year + 1º–4º TRI (Mês Referência Resultado), average in days with one decimal. */
export function TempoBloco({ res }: { res: ResAcumulado }) {
  const t = useMemo(() => tempoPorTrimestre(res.items, mesReferencia), [res.items]);
  const regra = `Média da coluna Tempo de Planejamento (dias) dos projetos da base Res. Acumulado com Mês Referência Resultado diferente de N/A; o trimestre vem do mês de referência (como no dashboard da monday). ${regraResAcumulado(res)}`;
  const celulas = [{ k: 'ano', label: `Ano ${res.ano}`, x: t.ano }, ...t.tri.map((x, i) => ({ k: `t${i}`, label: `${i + 1}º TRI`, x }))];
  return (
    <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-[auto_repeat(5,minmax(0,1fr))]">
      <div className="col-span-2 flex items-center gap-1 px-4 py-2.5 sm:col-span-3 sm:px-5 lg:col-span-1 lg:border-r lg:border-border">
        <div>
          <p className="text-xs font-semibold text-foreground">Tempo de planejamento</p>
          <p className="text-[11px] text-[hsl(var(--fg-subtle))]">média · Res. Acumulado</p>
        </div>
        <InfoDica texto={regra} />
      </div>
      {celulas.map((c, i) => (
        <div key={c.k} className={cn('flex min-w-0 flex-col gap-0.5 border-t border-border px-4 py-2.5 lg:border-t-0', i > 0 && 'border-l')}>
          <span className={cn('text-xs', i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{c.label}</span>
          <span className="tnum text-xl font-light text-foreground">{fmtDias1(c.x.media)}</span>
          <span className="tnum text-[11px] text-[hsl(var(--fg-subtle))]">n = {c.x.n}</span>
        </div>
      ))}
    </div>
  );
}

function LinhaIt({ rotulo, items }: { rotulo: string; items: Projeto[] }) {
  const it = useMemo(() => indicadoresIt(items), [items]);
  return (
    <>
      <div className="col-span-2 flex items-center px-4 py-2 sm:px-5 lg:col-span-1 lg:border-r lg:border-border">
        <span className="text-xs font-medium text-foreground">{rotulo}</span>
      </div>
      {it.map((x, i) => (
        <div key={x.key} className={cn('flex min-w-0 items-center gap-2.5 border-t border-border px-4 py-2 lg:border-t-0', i % 2 === 1 && 'border-l', i > 0 && 'lg:border-l')}>
          <Anel valor={x.media} size={32} espessura={4} label={`${x.label}: ${fmtIt(x.media)}`} />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{x.label}</span>
          <span className="flex items-baseline gap-1.5">
            <span className={cn('tnum text-lg font-light', (x.media ?? 0) < 0 ? 'text-[hsl(var(--danger))]' : 'text-foreground')}>{fmtIt(x.media)}</span>
            <span className="tnum text-[11px] text-[hsl(var(--fg-subtle))]">n = {x.n}</span>
          </span>
        </div>
      ))}
    </>
  );
}

/** IT1.1–IT1.4: selected month (Mês Referência Resultado) on top, January → that month below. */
export function ItLinhas({ res, mes, setMes }: { res: ResAcumulado; mes: number; setMes: (m: number) => void }) {
  const doMes = useMemo(() => res.items.filter((p) => mesReferencia(p) === mes), [res.items, mes]);
  const acumulado = useMemo(() => res.items.filter((p) => { const m = mesReferencia(p); return m !== null && m <= mes; }), [res.items, mes]);
  const ano2 = String(res.ano).slice(2);
  const regra = `Média de cada indicador IT dos projetos da base Res. Acumulado ${res.ano}. Linha de cima: Mês Referência Resultado = mês escolhido. Linha de baixo: Mês Referência de janeiro até o mês escolhido. Projetos com Mês Referência N/A não entram. n = projetos com valor no indicador.`;
  return (
    <div className="border-t border-border">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-2.5 sm:px-5">
        <span className="text-xs text-muted-foreground">Mês</span>
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger aria-label="Mês dos indicadores IT" className="h-11 w-28 text-xs md:h-7"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES_CURTOS.map((m, i) => <SelectItem key={m} value={String(i + 1)} className="text-[13px]">{m}/{ano2}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="ml-1 text-xs font-semibold text-foreground">Indicadores IT</p>
        <InfoDica texto={regra} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
        <LinhaIt rotulo={`Mês: ${MESES_CURTOS[mes - 1]}/${ano2}`} items={doMes} />
        <div className="col-span-2 border-t border-border lg:col-span-5" aria-hidden />
        <LinhaIt rotulo={`Acumulado ${res.ano}`} items={acumulado} />
      </div>
    </div>
  );
}
