import { useRef, useState, Fragment } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@lib/utils';
import ExportButton, { Slide } from '@generated/ExportButton';
import { Tip, MedTip, cellAria } from '@generated/tip';
import { BG, Legend, Pager } from '@generated/bits';
import { consolidate, alerts, closedMeds } from '@generated/calc';
import { buckets } from '@generated/scope';
import { fmtPct, fmtNum, diffPP, cellState, objGroups, chunk, NIVEL_TITULO, unidade, fracOf } from '@generated/lib';

const BIG = {
  hit: 'border border-[hsl(var(--ok)/0.5)] font-semibold',
  miss: 'border border-[hsl(var(--below)/0.5)] font-semibold',
  nometa: 'border border-[hsl(var(--na)/0.4)]',
  nocase: 'border border-[hsl(var(--na)/0.4)]',
  parcial: 'border border-[hsl(var(--na)/0.4)]',
  na: 'border border-[hsl(var(--na)/0.4)]',
};
const SEL_BG = 'bg-[hsl(var(--primary)/0.12)]';

/** % on top; Atingido/Total below (counts only — saldo shows just the %) */
function Cell({ r, onClick, big, dense, code, label, un, sel }) {
  const s = r?.state ?? 'na';
  const frac = fracOf(r);
  const parcial = s === 'parcial';
  return (
    <td className={cn('p-0.5', sel && SEL_BG)}>
      <Tip content={<MedTip code={code} label={label} r={r} un={un} acum={big} />}>
      <button type="button" onClick={onClick} aria-label={cellAria(code, label, r, un)} className={cn(dense ? 'h-[36px]' : 'h-[44px]', 'relative flex w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-md leading-tight transition hover:ring-2 hover:ring-[hsl(var(--goal)/0.4)]', BG[s], big && BIG[s])}>
        {s === 'na' ? <span className="text-xs">N/A</span>
          : s === 'nocase' ? <span className="text-[10px] font-medium">sem casos</span> : (
          <>
            <span className={cn('max-w-full truncate font-bold tabular-nums', big || parcial ? 'text-[13px] leading-none' : 'text-[15px]')}>{fmtPct(r.apurado)}</span>
            {(frac || (big && r.meta != null && !parcial)) && (
              <span className={cn('max-w-full truncate whitespace-nowrap tabular-nums opacity-90', parcial ? 'text-[9px] leading-[11px]' : 'text-[10px]')}>
                {frac}{big && r.meta != null && !parcial && `${frac ? ' · ' : ''}${diffPP(r.apurado, r.meta)}`}
              </span>
            )}
            {parcial && <span className="rounded bg-[hsl(var(--na)/0.25)] px-1 text-[8px] font-bold uppercase leading-[10px]">parcial</span>}
          </>
        )}
      </button>
      </Tip>
    </td>
  );
}

const BAND_H = 30, ROW_H = 48, ROW_D = 40, CAP = 520, LINE_H = 17;
/** name column: wider when there are few columns; chars per line at 14px */
const nameW = (g) => (g === 'm' ? 370 : 470);
const rowH = (i, g, base) => Math.max(base, Math.ceil((i.code.length + 1 + i.curto.length) / Math.floor((nameW(g) - 12) / 7)) * LINE_H + 8);
const unitH = (gs, g, base) => gs.reduce((t, x) => t + BAND_H + x.inds.reduce((s, i) => s + rowH(i, g, base), 0), 0);
/**
 * Slides of the matrix. Objectives 1 and 2 always stay together on the same slide (compact rows if needed);
 * other objectives are packed in order; anything still too tall is chunked. Row height follows the (full) name.
 */
export function reportPages(ind, g = 'm') {
  const groups = objGroups(ind);
  const units = [];
  const together = groups.filter((x) => x.id === 1 || x.id === 2);
  groups.forEach((x) => {
    if (x.id === 1 || x.id === 2) { if (x === together[0]) units.push(together); }
    else units.push([x]);
  });
  const pages = [];
  let cur = null;
  units.forEach((u) => {
    if (cur && unitH([...cur.groups, ...u], g, ROW_H) <= CAP) { cur.groups.push(...u); return; }
    if (unitH(u, g, ROW_H) <= CAP) { cur = { groups: [...u], dense: false }; pages.push(cur); return; }
    if (unitH(u, g, ROW_D) <= CAP) { cur = { groups: [...u], dense: true }; pages.push(cur); cur = null; return; }
    cur = null;
    const per = Math.max(1, Math.floor((CAP - BAND_H * u.length) / (ROW_D + 8)));
    chunk(u.flatMap((x) => x.inds.map((i) => ({ x, i }))), per).forEach((rows) => {
      const gs = [];
      rows.forEach(({ x, i }) => { let y = gs.find((z) => z.id === x.id); if (!y) gs.push(y = { ...x, inds: [] }); y.inds.push(i); });
      pages.push({ groups: gs, dense: true });
    });
  });
  return pages.length ? pages : [{ groups: [], dense: false }];
}

const TITULO = { m: 'mês a mês', q: 'por trimestre', s: 'por semestre', y: 'no ano' };

export function ReportSlide({ ind, f, updatedAt, nivel = 'tat', groups, dense, page, onOpen = () => {} }) {
  groups = groups ?? objGroups(ind);
  const year = f.year;
  const cols = buckets(f);
  const showAc = f.g !== 'y';
  // footer: closed months with cases, Jan → end of the chosen period
  let total = 0, hits = 0;
  ind.forEach((i) => closedMeds(i, year, f.end).forEach((m) => { total++; if (cellState(m, i.lower) === 'hit') hits++; }));
  return (
    <div className="flex h-full flex-col px-10 py-6">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold tracking-tight">Indicadores {NIVEL_TITULO[nivel]} – Resultado {TITULO[f.g]} vs. meta</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--goal))]"><strong className="font-semibold text-foreground">{f.label}</strong>{showAc && ` · Acumulado ${f.acLabel}`} · Medições do 01.02 · atualizado em {updatedAt?.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{page && page.total > 1 && ` · slide ${page.n}/${page.total}`}</p>
        </div>
        <Legend />
      </div>
      <table className="mt-3 w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup><col className={f.g === 'm' ? 'w-[370px]' : 'w-[470px]'} /><col className="w-[56px]" />{cols.map((c) => <col key={c.key} />)}{showAc && <col className="w-[118px]" />}</colgroup>
        <thead><tr className="text-[11px] font-semibold uppercase text-[hsl(var(--goal))]">
          <th className="pb-1 text-left">Indicador</th><th className="pb-1">Meta</th>
          {cols.map((c) => <th key={c.key} className={cn('rounded-t-md pb-1 pt-1', c.sel && cn(SEL_BG, 'text-[hsl(var(--primary))]'))}>{c.label}</th>)}
          {showAc && (
            <th className="pb-1">
              <span className="inline-flex items-center gap-1">
                Acumulado
                <Tip content={`Jan até o fim do período escolhido (${f.acLabel}). Inclui só meses fechados.`}><Info aria-label="inclui só meses fechados" className="h-3 w-3" /></Tip>
              </span>
            </th>
          )}
        </tr></thead>
        <tbody>
          {groups.map((o) => (
            <Fragment key={o.id}>
              <tr><td colSpan={cols.length + 3} className="pt-1.5">
                <div className={cn('flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-bold text-[hsl(var(--on-solid))]', o.cor)}>
                  {o.nome}{o.selo && <span className="rounded bg-[hsl(var(--on-solid)/0.25)] px-1.5 text-[9px]">{o.selo}</span>}
                </div>
              </td></tr>
              {o.inds.map((i) => {
                const ac = consolidate(i, year, f.acMonths);
                const v = closedMeds(i, year, f.end);
                const meta = ac?.meta ?? v[v.length - 1]?.meta ?? i.metaInd;
                const un = unidade(i);
                return (
                  <tr key={i.code}>
                    <td className="py-0.5 pr-3 text-[14px] leading-[1.2]"><span className="font-bold">{i.code}</span> {i.curto}</td>
                    <td className="text-center text-[13px] font-semibold text-[hsl(var(--goal))] tabular-nums">{fmtPct(meta)}</td>
                    {cols.map((c) => <Cell key={c.key} sel={c.sel && cols.length > 1} dense={dense} code={i.code} un={un} label={c.long} r={consolidate(i, year, c.months)} onClick={() => onOpen({ code: i.code, months: c.months, label: c.long })} />)}
                    {showAc && <Cell big dense={dense} code={i.code} un={un} label={`Acumulado ${f.acLabel}`} r={ac} onClick={() => onOpen({ code: i.code, months: f.acMonths, label: `Acumulado ${f.acLabel}` })} />}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex justify-between gap-4 border-t border-border pt-2 text-xs text-[hsl(var(--goal))]">
        <span><strong className="text-foreground">{fmtNum(hits)} de {fmtNum(total)}</strong> medições do período dentro da meta <span className="opacity-80">({f.acLabel}, meses fechados)</span></span>
        <span>Resultado = Atingido ÷ Total Período · Diferença em p.p. = resultado − meta{showAc && ' · Acumulado: só meses fechados'}</span>
      </div>
    </div>
  );
}

/** on-screen only — never part of PNG / PDF / Apresentar */
function AlertStrip({ ind, f }) {
  const al = alerts(ind, f.year, f.end);
  if (!al.length) return null;
  return (
    <output className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[hsl(var(--below)/0.35)] bg-[hsl(var(--below)/var(--cell-a))] px-3 py-2 text-sm text-[hsl(var(--below-ink))]">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {al.map((a) => <span key={a.text} className="font-medium">{a.text}</span>)}
    </output>
  );
}

export default function ReportView(props) {
  const ref = useRef(null);
  const pages = reportPages(props.ind, props.f.g);
  const [p, setP] = useState(0);
  const k = Math.min(p, pages.length - 1);
  return (
    <div className="space-y-3">
      {props.showAlerts && <AlertStrip ind={props.ind} f={props.f} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pager n={k} total={pages.length} onChange={setP} />
        <ExportButton targetRef={ref} fileName={`indicadores-${props.f.short.replace(/[^\w.-]+/g, '-').toLowerCase()}${pages.length > 1 ? `-${k + 1}` : ''}`} />
      </div>
      <Slide slideRef={ref}><ReportSlide {...props} groups={pages[k].groups} dense={pages[k].dense} page={{ n: k + 1, total: pages.length }} /></Slide>
    </div>
  );
}
