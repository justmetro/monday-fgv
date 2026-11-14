import { useRef, useState } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import ExportButton, { Slide } from '@generated/ExportButton';
import GoalBar from '@generated/GoalBar';
import { Legend, Parcial, Trend, StreakBadge, Pager } from '@generated/bits';
import { consolidate, trend, streak, closedMeds } from '@generated/calc';
import { fmtPct, fmtNum, chunk, NIVEL_TITULO, cellState, unidade, saldoText } from '@generated/lib';
import { Tip, MedTip, Marker } from '@generated/tip';
import { cn } from '@lib/utils';

/** "10 de 34 projetos" · "Saldo R$ 1,2 mi de R$ 4 mi orçado" · "sem casos" */
const fracMini = (r, un) => (r.saldo ? saldoText(r, true) : r.d > 0 ? `${fmtNum(r.n ?? 0)} de ${fmtNum(r.d)} ${un}` : 'sem casos');

function MiniCard({ i, f, onOpen }) {
  const year = f.year;
  const r = consolidate(i, year, f.months);
  const ac = consolidate(i, year, f.acMonths);
  const obj = i.objInfo;
  const un = unidade(i);
  const spark = closedMeds(i, year, f.end);
  const parcial = r?.state === 'parcial';
  const tem = r && r.apurado != null && r.state !== 'nocase';
  return (
    <button type="button" onClick={() => onOpen({ code: i.code, months: f.months, label: f.short })}
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3.5 text-left hover:border-[hsl(var(--goal)/0.5)]">
      <div className="flex items-center gap-1.5">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', obj?.cor)} />
        <span className="text-[12px] font-bold">{i.code}</span>
        {obj?.selo && <span className="text-[9px] font-semibold text-[hsl(var(--goal))]">{obj.selo}</span>}
        <StreakBadge n={streak(i, year, f.end)} />
      </div>
      <p className="mt-1 line-clamp-2 min-h-[28px] text-[11.5px] font-medium leading-[14px]" title={i.curto}>{i.curto}</p>
      {!tem ? (
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="text-sm font-semibold text-[hsl(var(--na-ink))]">{!r ? `Sem medição em ${f.short}` : `${f.short} · ${parcial ? 'parcial' : 'sem casos'}`}</p>
          <div className="text-right"><p className="text-[10px] text-[hsl(var(--goal))]">Meta</p>
            <p className="text-lg font-semibold text-[hsl(var(--goal))]">{fmtPct(r?.meta ?? ac?.meta ?? i.metaInd)}</p></div>
        </div>) : (
        <>
          <div className="mt-1 flex items-end justify-between gap-2">
            <div className="min-w-0"><p className="text-[10px] text-[hsl(var(--goal))]">{f.short}{parcial && <Parcial />}</p>
              <p className={cn('text-3xl font-bold tabular-nums leading-none', parcial && 'text-[hsl(var(--na-ink))]')}>{fmtPct(r.apurado)}</p>
              <p className="truncate text-[10px] text-[hsl(var(--goal))]">
                {fracMini(r, un)}{f.g === 'm' && !parcial && trend(i, year, f.p) && <> · <Trend t={trend(i, year, f.p)} /></>}
              </p></div>
            <div className="text-right"><p className="text-[10px] text-[hsl(var(--goal))]">Meta</p><p className="text-lg font-semibold text-[hsl(var(--goal))]">{fmtPct(r.meta)}</p></div>
          </div>
          <GoalBar apurado={r.apurado} meta={r.meta} lower={i.lower} compact neutral={parcial} />
        </>
      )}
      {f.g !== 'y' && (
        <p className="mt-1.5 truncate border-t border-border pt-1 text-[10px] text-[hsl(var(--goal))]">
          Acumulado {f.acLabel}: <strong className="font-semibold text-foreground">{ac && ac.apurado != null ? fmtPct(ac.apurado) : '—'}</strong>
          {ac && ac.apurado != null && ` · ${fracMini(ac, un)}`}
        </p>
      )}
      {spark.length > 1 && (
        <div className="mt-auto h-9 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}><YAxis hide domain={[0, 100]} />
              <Line type="linear" dataKey="apurado" stroke="hsl(var(--goal))" strokeWidth={1.5} dot={({ cx, cy, payload }) => cx == null ? null : (
                <Tip key={payload.id} content={<MedTip code={i.code} un={un} label={payload.period.label} r={{ ...payload, state: cellState(payload, i.lower) }} />}>
                  <Marker cx={cx} cy={cy} r={3} apurado={payload.apurado} meta={payload.meta} lower={i.lower} />
                </Tip>)} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </button>
  );
}

export function SummarySlide({ ind, f, lastClosed, updatedAt, nivel, page, onOpen }) {
  const parcial = f.g === 'm' && ind.some((i) => i.meds.some((m) => m.period.year === f.year && m.period.month === f.p && m.parcial));
  const ref = f.g === 'm' ? (parcial ? 'Mês em andamento' : f.p === lastClosed ? 'Último mês fechado' : 'Mês de referência') : null;
  return (
    <div className="flex h-full flex-col px-10 py-7">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0"><h1 className="text-[26px] font-bold tracking-tight">Resumo dos indicadores {NIVEL_TITULO[nivel ?? 'tat'].toLowerCase()} – {f.year}</h1>
          <p className="text-sm text-[hsl(var(--goal))]"><strong className="font-semibold text-foreground">{f.label}</strong>{ref && ` (${ref.toLowerCase()})`}{parcial && ' · mês em andamento, resultado provisório'}{f.g !== 'y' && ` · Acumulado ${f.acLabel}`} · atualizado em {updatedAt?.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{page && page.total > 1 && ` · slide ${page.n}/${page.total}`}</p></div>
        <Legend />
      </div>
      <SummaryGrid ind={ind} f={f} onOpen={onOpen ?? (() => {})} />
    </div>
  );
}

/** measured indicators get full cards; the ones without measurement in the year are stacked compact in the remaining columns */
function SummaryGrid({ ind, f, onOpen }) {
  const measured = ind.filter((i) => i.meds.some((m) => m.period.year === f.year));
  const empty = ind.filter((i) => !measured.includes(i));
  const span = 4 - (measured.length % 4 || 4) || 4;
  const SPAN = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4' };
  return (
    <div className="mt-5 grid min-h-0 flex-1 auto-rows-fr grid-cols-4 gap-3">
      {measured.map((i) => <MiniCard key={i.code} i={i} f={f} onOpen={onOpen} />)}
      {empty.length > 0 && (
        <div className={cn('flex min-w-0 flex-col gap-2', SPAN[span])}>
          {empty.map((i) => <CompactCard key={i.code} i={i} f={f} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function CompactCard({ i, f, onOpen }) {
  const obj = i.objInfo;
  return (
    <button type="button" aria-label={`${i.code} – ${i.curto}: sem medição em ${f.year}`} onClick={() => onOpen({ code: i.code, months: f.months, label: f.short })}
      className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 text-left hover:border-[hsl(var(--goal)/0.5)]">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', obj?.cor)} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold">{i.code}{obj?.selo && <span className="ml-1.5 text-[9px] font-semibold text-[hsl(var(--goal))]">{obj.selo}</span>}</p>
        <p className="line-clamp-2 text-[12px] font-medium leading-tight">{i.curto}</p>
        <p className="text-[11px] font-semibold text-[hsl(var(--na-ink))]">Sem medição em {f.year}</p>
      </div>
      <div className="text-right"><p className="text-[10px] text-[hsl(var(--goal))]">Meta</p><p className="text-base font-semibold text-[hsl(var(--goal))]">{fmtPct(i.metaInd)}</p></div>
    </button>
  );
}

/** up to 8 cards per slide */
export const summaryPages = (ind) => (ind.length ? chunk(ind, 8) : [[]]);

export default function SummaryView(props) {
  const ref = useRef(null);
  const pages = summaryPages(props.ind);
  const [p, setP] = useState(0);
  const k = Math.min(p, pages.length - 1);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pager n={k} total={pages.length} onChange={setP} />
        <ExportButton targetRef={ref} fileName={`resumo-${props.f.short.replace(/[^\w.-]+/g, '-').toLowerCase()}${pages.length > 1 ? `-${k + 1}` : ''}`} />
      </div>
      <Slide slideRef={ref}><SummarySlide {...props} ind={pages[k]} page={{ n: k + 1, total: pages.length }} /></Slide>
    </div>
  );
}
