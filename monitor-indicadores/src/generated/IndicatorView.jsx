import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@components/ui/select';
import ResultCard from '@generated/ResultCard';
import MetaCard from '@generated/MetaCard';
import EvolutionChart from '@generated/EvolutionChart';
import ExportButton, { Slide } from '@generated/ExportButton';
import { Trend } from '@generated/bits';
import { consolidate, trend } from '@generated/calc';
import { buckets } from '@generated/scope';
import { unidade, MESES } from '@generated/lib';

const CHART_TITLE = { m: 'Evolução mensal', q: 'Evolução trimestral', s: 'Evolução semestral', y: 'Resultado do ano' };

/** eyebrow of the period card: "Último mês fechado · Out/2026" · "Mês em andamento · Nov/2026" · "Trimestral · 3º TRI/2026" */
function periodEyebrow(f, r, lastClosed) {
  if (f.g !== 'm') return f.label;
  const lbl = r?.state === 'parcial' ? 'Mês em andamento' : f.p === lastClosed ? 'Último mês fechado' : 'Mês de referência';
  return `${lbl} · ${f.short}`;
}

export function IndicatorSlide({ i, f, lastClosed, onOpen = () => {} }) {
  const year = f.year;
  const series = buckets(f).filter((b) => b.months[0] <= f.end).map((b) => ({ ...b, r: consolidate(i, year, b.months) }))
    .filter((b) => b.r && b.r.apurado != null).map((b) => ({ ...b, apurado: b.r.apurado, meta: b.r.meta }));
  const r = consolidate(i, year, f.months);
  const ac = consolidate(i, year, f.acMonths);
  const obj = i.objInfo;
  const meta = r?.meta ?? ac?.meta ?? i.metaInd;
  return (
    <div className="flex h-full flex-col gap-3 px-10 py-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--goal))]">{obj?.nome}{obj?.selo && ` · ${obj.selo}`} · {f.label}</p>
        <h1 className="line-clamp-2 text-[22px] font-bold leading-tight">{i.code} – {i.curto}</h1>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ResultCard eyebrow={periodEyebrow(f, r, lastClosed)} r={r} i={i}
          onClick={() => onOpen({ code: i.code, months: f.months, label: f.short })}
          extra={f.g === 'm' && r?.state !== 'parcial' && trend(i, year, f.p) && (
            <p className="mt-1 flex flex-wrap gap-x-2 text-sm"><Trend t={trend(i, year, f.p)} /><span className="text-[hsl(var(--goal))]">vs. mês fechado anterior</span></p>
          )} />
        <MetaCard i={i} r={ac} eyebrow={`Acumulado · ${f.acLabel}`} onClick={() => onOpen({ code: i.code, months: f.acMonths, label: `Acumulado ${f.acLabel}` })} />
      </div>
      <EvolutionChart data={series} meta={meta} lower={i.lower} code={i.code} un={unidade(i)} height="h-[190px]" title={`${CHART_TITLE[f.g]} · Jan a ${MESES[f.end]}/${year}`}
        onPoint={(p) => onOpen({ code: i.code, months: p.months, label: p.long })} />
    </div>
  );
}

/** prominent indicator switcher: accent background, prev/next arrows, current code + name */
function IndicatorPicker({ ind, i, onChange }) {
  const idx = ind.findIndex((x) => x.code === i.code);
  const go = (d) => onChange(ind[(idx + d + ind.length) % ind.length].code);
  const arrow = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary-foreground)/0.16)] text-primary-foreground hover:bg-[hsl(var(--primary-foreground)/0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground disabled:opacity-40';
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-primary p-2 text-primary-foreground shadow-sm">
      <button type="button" aria-label="Indicador anterior" className={arrow} onClick={() => go(-1)} disabled={ind.length < 2}><ChevronLeft className="h-5 w-5" /></button>
      <Select value={i.code} onValueChange={onChange}>
        <SelectTrigger aria-label={`Trocar indicador. Atual: ${i.code} – ${i.curto}`}
          className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal rounded-xl border-0 bg-[hsl(var(--primary-foreground)/0.1)] px-3 py-2 text-left text-primary-foreground shadow-none hover:bg-[hsl(var(--primary-foreground)/0.18)] focus-visible:ring-primary-foreground data-[size=default]:h-auto dark:bg-[hsl(var(--primary-foreground)/0.1)] dark:hover:bg-[hsl(var(--primary-foreground)/0.18)] [&_svg]:!text-primary-foreground [&_svg]:!opacity-100">
          <span className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-md bg-primary-foreground px-2 py-0.5 text-sm font-bold text-primary">{i.code}</span>
            <span className="min-w-0 text-[15px] font-semibold leading-snug">{i.curto}</span>
          </span>
        </SelectTrigger>
        <SelectContent>{ind.map((x) => <SelectItem key={x.code} value={x.code}><span className="font-semibold">{x.code}</span> – {x.curto}</SelectItem>)}</SelectContent>
      </Select>
      <span className="hidden shrink-0 px-1 text-xs font-semibold tabular-nums sm:inline">{idx + 1}/{ind.length}</span>
      <button type="button" aria-label="Próximo indicador" className={arrow} onClick={() => go(1)} disabled={ind.length < 2}><ChevronRight className="h-5 w-5" /></button>
    </div>
  );
}

export default function IndicatorView({ ind, ...rest }) {
  const [code, setCode] = useState('IT1.1');
  const ref = useRef(null);
  const i = ind.find((x) => x.code === code) ?? ind[0];
  if (!i) return <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Nenhum indicador marcado em "Exibir no painel" para este filtro.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <IndicatorPicker ind={ind} i={i} onChange={setCode} />
        <ExportButton targetRef={ref} fileName={`indicador-${i.code}-${rest.f.short.replace(/[^\w.-]+/g, '-').toLowerCase()}`} />
      </div>
      <Slide slideRef={ref}><IndicatorSlide i={i} {...rest} /></Slide>
    </div>
  );
}
