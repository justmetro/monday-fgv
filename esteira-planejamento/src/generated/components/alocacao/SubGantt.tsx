import { useMemo, useState } from 'react';
import { addMonths, differenceInCalendarDays, eachMonthOfInterval, endOfMonth, startOfMonth } from 'date-fns';
import { cn } from '@lib/utils';
import { CAPS, CAP_CURTO } from '@generated/lib/alocacao';
import { MultiSelect } from '@generated/components/MultiSelect';
import { EmptyState } from '@generated/components/ui-bits';
import { inputCls } from '@generated/components/edit-fields';
import { Chip } from '@generated/components/alocacao/bits';
import { DOT, GANTT_CAP_COR, cor } from '@generated/components/alocacao/cores';
import type { AlocCtx } from '@generated/components/alocacao/ctx';
import { type LinhaGantt, useLinhasGantt } from '@generated/components/alocacao/ganttDados';
import { GanttLista } from '@generated/components/alocacao/GanttLista';

const MES_W = 84;
const LANE = 24;
const CHAR_W = 6.2;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Cuts a label to fit `px` pixels (with an ellipsis); '' when not even 3 characters fit. */
const caber = (t: string, px: number) => {
  const n = Math.floor(px / CHAR_W);
  return t.length <= n ? t : n >= 4 ? `${t.slice(0, n - 1)}…` : '';
};

/** "Alocação por Gerente" (ex-Mapa gerentes ativos): Gantt (default) or simplified list, same manager / eixo filters. */
export function SubGantt({ ctx }: { ctx: AlocCtx }) {
  const { modelo, q, eixoOpts, abrirGerente } = ctx;
  const [visao, setVisao] = useState<'gantt' | 'lista'>('gantt');
  const [sel, setSel] = useState<string[]>([]);
  const [eixo, setEixo] = useState('');
  const { linhas, hoje } = useLinhasGantt(modelo, sel, eixo, q);
  const opcoesGerente = useMemo(() => modelo.gerentes.map((g) => g.g.nome), [modelo.gerentes]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="m-0 inline-flex min-w-0 rounded-[var(--radius-md)] border border-input p-0.5">
          <legend className="sr-only">Visualização</legend>
          {(['gantt', 'lista'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={visao === v} onClick={() => setVisao(v)}
              className={cn('h-11 rounded-[var(--radius-sm)] px-3 text-[13px] md:h-7', visao === v ? 'bg-[hsl(var(--surface-3))] text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {v === 'gantt' ? 'Gantt' : 'Lista'}
            </button>
          ))}
        </fieldset>
        <MultiSelect label="Gerentes" options={opcoesGerente} value={sel} onChange={setSel} />
        <label htmlFor="gantt-eixo" className="sr-only">Eixo</label>
        <select id="gantt-eixo" value={eixo} onChange={(e) => setEixo(e.target.value)} className={cn(inputCls, 'w-auto max-w-[260px]')}>
          <option value="">Todos os eixos</option>
          {eixoOpts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {/* Legend always visible, next to the eixo filter (same colors as bars and chips). */}
        <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground" aria-label="Legenda">
          {CAPS.map((c) => (
            <li key={c} className="flex items-center gap-1"><span className={cn('h-2 w-4 rounded-sm', DOT[GANTT_CAP_COR[c]])} aria-hidden />{CAP_CURTO[c]}</li>
          ))}
          <li className="flex items-center gap-1"><span className="h-2 w-4 rounded-sm border border-dashed border-muted-foreground" aria-hidden />Pendente (chegada prevista)</li>
          <li className="flex items-center gap-1"><span className="h-2 w-4 rounded-sm border border-dashed border-[hsl(var(--warning))]" aria-hidden />Sem previsão</li>
          <li className="flex items-center gap-1"><span className="h-3 w-px bg-[hsl(var(--temp-15))]" aria-hidden />Hoje</li>
        </ul>
      </div>

      {linhas.length === 0 ? (
        <EmptyState title="Nenhum gerente para exibir" hint="Ajuste o filtro de gerentes, o eixo ou a busca." />
      ) : visao === 'lista' ? <GanttLista linhas={linhas} onGerente={abrirGerente} /> : <GanttChart linhas={linhas} hoje={hoje} onGerente={abrirGerente} />}
    </div>
  );
}

function GanttChart({ linhas, hoje, onGerente }: { linhas: LinhaGantt[]; hoje: Date; onGerente: (id: string) => void }) {
  const { meses, inicio, largura } = useMemo(() => {
    const datas = linhas.flatMap((l) => l.barras.flatMap((b) => [b.ini, b.fim])).filter((d): d is Date => !!d).map((d) => d.getTime());
    const min = Math.max(addMonths(hoje, -24).getTime(), Math.min(addMonths(hoje, -2).getTime(), ...datas));
    const max = Math.min(addMonths(hoje, 36).getTime(), Math.max(addMonths(hoje, 6).getTime(), ...datas));
    const ms = eachMonthOfInterval({ start: startOfMonth(new Date(min)), end: endOfMonth(new Date(max)) });
    return { meses: ms, inicio: startOfMonth(new Date(min)), largura: ms.length * MES_W };
  }, [linhas, hoje]);

  // Bar geometry and labels, recomputed only when rows or the time window change.
  const rows = useMemo(() => {
    // Equal-width month columns: a date maps to its month column + the fraction of that month.
    const pos = (d: Date) => {
      const idx = (d.getFullYear() - inicio.getFullYear()) * 12 + (d.getMonth() - inicio.getMonth());
      const diasMes = differenceInCalendarDays(endOfMonth(d), startOfMonth(d)) + 1;
      return idx * MES_W + ((d.getDate() - 1) / diasMes) * MES_W;
    };
    const clamp = (v: number) => Math.min(largura, Math.max(0, v));
    return linhas.map((l) => {
      const fillCap = cor(GANTT_CAP_COR[l.cap]);
      const barras = l.barras.flatMap((b, i) => {
        const r1 = b.ini ? pos(b.ini) : 0;
        const r2 = b.fim ? pos(b.fim) : largura;
        if (r2 < 0 || r1 > largura) return []; // entirely outside the window
        let x1 = clamp(r1);
        const x2 = clamp(r2);
        if (x1 > largura - 6) x1 = largura - 6;
        const w = Math.min(largura - x1, Math.max(6, x2 - x1));
        const texto = `${b.rotulo}${b.fim ? '' : ' · sem data'}${b.ini ? '' : ' · sem início'}`;
        const tw = texto.length * CHAR_W;
        const dir = largura - (x1 + w) - 8;
        const esq = x1 - 8;
        let lx = x1 + 6;
        let anchor: 'start' | 'end' = 'start';
        let rot = texto;
        let dentro = true;
        if (tw + 12 > w) {
          dentro = false;
          if (dir >= tw) lx = x1 + w + 4;
          else if (esq >= tw) { lx = x1 - 4; anchor = 'end'; }
          else {
            const melhor = Math.max(w - 12, dir, esq);
            rot = caber(texto, melhor);
            if (melhor === w - 12) { dentro = true; lx = x1 + 6; } else if (melhor === dir) lx = x1 + w + 4; else { lx = x1 - 4; anchor = 'end'; }
          }
        }
        const fill = b.semPrevisao ? cor('--warning') : fillCap;
        return [{ b, x1, w, y: 4 + i * LANE + 3, lx, anchor, rot, dentro, fill }];
      });
      return { l, barras, h: Math.max(1, l.barras.length) * LANE + 8 };
    });
  }, [linhas, inicio, largura]);

  const xHoje = useMemo(() => {
    const idx = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
    return idx * MES_W + ((hoje.getDate() - 1) / (differenceInCalendarDays(endOfMonth(hoje), startOfMonth(hoje)) + 1)) * MES_W;
  }, [hoje, inicio]);

  return (
    <div className="max-h-[72vh] overflow-auto rounded-[var(--radius-lg)] border border-border bg-card">
      <div className="min-w-max">
        <div className="sticky top-0 z-20 flex border-b border-border bg-[hsl(var(--surface-2))] text-[11px] text-muted-foreground">
          <div className="sticky left-0 z-30 w-56 shrink-0 border-r border-border bg-[hsl(var(--surface-2))] px-3 py-2 font-medium">Gerente</div>
          <div className="flex">
            {meses.map((m) => (
              <div key={m.toISOString()} className={cn('w-[84px] shrink-0 whitespace-nowrap border-l border-border py-2 text-center tnum',
                m.getMonth() === hoje.getMonth() && m.getFullYear() === hoje.getFullYear() && 'font-semibold text-foreground')}>
                {MESES[m.getMonth()]}/{String(m.getFullYear()).slice(2)}
              </div>
            ))}
          </div>
        </div>
        {rows.map(({ l, barras, h }) => {
          const clipId = `gantt-clip-${l.g.g.id}`;
          return (
            <div key={l.g.g.id} className="flex border-b border-border last:border-b-0">
              <div className="sticky left-0 z-10 flex w-56 shrink-0 flex-col justify-center gap-1 border-r border-border bg-card px-3 py-1.5">
                <button type="button" onClick={() => onGerente(l.g.g.id)} title={`${l.g.g.nome} — ver detalhes`}
                  className="truncate rounded-[var(--radius-sm)] text-left text-[13px] font-medium text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{l.g.g.nome}</button>
                <Chip corVar={GANTT_CAP_COR[l.cap]} className="w-fit">{l.cap}</Chip>
              </div>
              <svg width={largura} height={h} role="img" aria-label={`Projetos de ${l.g.g.nome}`} className="shrink-0 overflow-hidden">
                <defs><clipPath id={clipId}><rect x={0} y={0} width={largura} height={h} /></clipPath></defs>
                <g clipPath={`url(#${clipId})`}>
                  {meses.map((m, i) => <line key={m.toISOString()} x1={i * MES_W} x2={i * MES_W} y1={0} y2={h} stroke="hsl(var(--border))" strokeWidth={1} />)}
                  {l.barras.length === 0 && <text x={8} y={h / 2 + 4} fontSize={11} fill="hsl(var(--fg-subtle))">Sem projetos ativos</text>}
                  {barras.map(({ b, x1, w, y, lx, anchor, rot, dentro, fill }) => (
                    <g key={b.key}>
                      <title>{b.titulo}</title>
                      <rect x={x1} y={y} width={w} height={LANE - 6} rx={4}
                        fill={b.pendente ? 'transparent' : fill} fillOpacity={b.pendente ? 1 : 0.85}
                        stroke={fill} strokeWidth={b.pendente ? 1.5 : 0} strokeDasharray={b.pendente ? '5 3' : undefined} />
                      {rot && (
                        <text x={lx} y={y + LANE / 2 - 0.5} fontSize={11} textAnchor={anchor}
                          fill={dentro && !b.pendente ? 'hsl(var(--cap-ink))' : 'hsl(var(--foreground))'}>{rot}</text>
                      )}
                    </g>
                  ))}
                  {xHoje >= 0 && xHoje <= largura && <line x1={xHoje} x2={xHoje} y1={0} y2={h} stroke="hsl(var(--temp-15))" strokeWidth={1.5} />}
                </g>
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
