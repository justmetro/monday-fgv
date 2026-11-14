import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toDate, fmtDate, MONTHS } from '@generated/lib/data';
import { clean, canon, normKey } from '@generated/lib/normalize';
import { todayUTC, isOne } from '@generated/lib/dates';
import { VagaAge } from '@generated/components/Age';
import { useEditable } from '@generated/components/edit/Editable';
import { cn } from '@lib/utils';

const DAY = 86400000;
const LABEL_W = 260;
const PX = { month: 84, quarter: 34 };
const WEEK_DAY_PX = 14;
const AHEAD_DAYS = 56; // 8 semanas
const BACK_MAX_DAYS = 84; // atrasadas mais antigas ficam presas na borda esquerda
const mIdx = (d) => d.getUTCFullYear() * 12 + d.getUTCMonth();
const daysIn = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
const monday = (t) => { const d = new Date(t); return t - ((d.getUTCDay() + 6) % 7) * DAY; };
const ddmm = (t) => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });

function stateOf(v, today) {
  const end = toDate(v.dataDeIncioPrevista);
  if (toDate(v.dataDePreenchimento) || normKey(v.statusDaVaga) === 'preenchida') return 'filled';
  if (isOne(v.vagaEmAberto) && end && end.getTime() < today) return 'late';
  return 'open';
}
const TONE = { filled: 'bg-primary', late: 'bg-destructive', open: 'bg-muted-foreground/60' };
const LABEL = { filled: 'Preenchida', late: 'Em aberto e atrasada', open: 'Em aberto / prevista' };

// ◆ Início previsto. With "Modo edição" on, drag horizontally to change the date (saved with Desfazer in the toast).
function StartMarker({ v, e, st, left, dayPx, onOpen }) {
  const ed = useEditable('dataDeIncioPrevista', v);
  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  const days = Math.round(dx / dayPx);
  const preview = days ? new Date(e.getTime() + days * DAY) : null;
  const title = `${v.name}\nInício previsto ${fmtDate(e)} · ${canon(v.statusDaVaga) ?? ''}${ed.active ? '\nArraste para mudar a data' : ''}`;
  const cls = cn('absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-card transition-transform', TONE[st], ed.active ? 'cursor-ew-resize touch-none hover:scale-125' : 'hover:scale-125');
  if (ed.pending) return <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left }}><Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="salvando…" /></span>;
  if (!ed.active) return <button onClick={() => onOpen(v)} aria-label={`Início previsto ${fmtDate(e)}`} title={title} className={cls} style={{ left }} />;
  return (
    <>
      <button aria-label={`Início previsto ${fmtDate(e)} — arraste ou use as setas para mudar`} title={title} className={cls} style={{ left: left + dx }}
        onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); drag.current = { x: ev.clientX, moved: false }; }}
        onPointerMove={(ev) => { if (!drag.current) return; const d = ev.clientX - drag.current.x; if (Math.abs(d) > 3) drag.current.moved = true; setDx(d); }}
        onPointerUp={() => {
          const st0 = drag.current; drag.current = null; setDx(0);
          if (!st0?.moved) { onOpen(v); return; }
          if (days) ed.save(new Date(e.getTime() + days * DAY));
        }}
        onPointerCancel={() => { drag.current = null; setDx(0); }}
        onKeyDown={(ev) => {
          if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); ed.save(new Date(e.getTime() + (ev.key === 'ArrowRight' ? 1 : -1) * DAY)); }
        }} />
      {preview && <span className="pointer-events-none absolute -top-1 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-0.5 text-[11px] font-medium text-popover-foreground shadow-[var(--shadow-pop)]" style={{ left: left + dx }}>{fmtDate(preview)} ({days > 0 ? '+' : ''}{days}d)</span>}
    </>
  );
}

export default function VagaGanttView({ vagas, onOpen, zoom = 'week', setZoom }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const today = todayUTC();
  const weekly = zoom === 'week';

  const model = useMemo(() => {
    const rows = []; const undated = []; let hidden = 0;
    const all = [new Date(today)];
    const horizon = today + AHEAD_DAYS * DAY;
    vagas.forEach((v) => {
      const s = toDate(v.dataDeAberturaDaVaga), e = toDate(v.dataDeIncioPrevista), f = toDate(v.dataDePreenchimento);
      if (!s && !e && !f) { undated.push(v); return; }
      const st = stateOf(v, today);
      if (weekly && !(st === 'late' || (e && e.getTime() >= today && e.getTime() <= horizon))) { hidden += 1; return; }
      [s, e, f].forEach((d) => d && all.push(d));
      rows.push({ v, s, e, f, st });
    });
    let scale;
    if (weekly) {
      const lateMin = Math.min(today, ...rows.filter((r) => r.st === 'late' && r.e).map((r) => r.e.getTime()));
      const start = monday(Math.max(lateMin, today - BACK_MAX_DAYS * DAY));
      const end = monday(horizon) + 7 * DAY;
      const weeks = Math.round((end - start) / (7 * DAY));
      scale = { width: (end - start) / DAY * WEEK_DAY_PX, dayPx: WEEK_DAY_PX, x: (d) => Math.max(0, Math.min((end - start) / DAY * WEEK_DAY_PX, (d.getTime() - start) / DAY * WEEK_DAY_PX)),
        ticks: Array.from({ length: weeks }, (_, i) => { const t = start + i * 7 * DAY; return { k: t, w: 7 * WEEK_DAY_PX, label: `Sem ${ddmm(t)}`, now: today >= t && today < t + 7 * DAY }; }) };
    } else {
      const px = PX[zoom];
      let first = Math.min(...all.map(mIdx)), last = Math.max(...all.map(mIdx)) + 1;
      if (zoom === 'quarter') { first -= first % 3; last += (3 - (last % 3)) % 3; }
      const months = Math.max(1, last - first);
      const cur = mIdx(new Date(today));
      scale = { width: months * px, dayPx: px / 30.44, x: (d) => (mIdx(d) - first + (d.getUTCDate() - 1) / daysIn(d)) * px,
        ticks: zoom === 'month'
          ? Array.from({ length: months }, (_, i) => { const k = first + i; return { k, w: px, label: `${MONTHS[k % 12].slice(0, 3)}/${String(Math.floor(k / 12)).slice(2)}`, now: cur === k }; })
          : Array.from({ length: months / 3 }, (_, i) => { const k = first + i * 3; return { k, w: 3 * px, label: `T${(k % 12) / 3 + 1} ${Math.floor(k / 12)}`, now: cur >= k && cur < k + 3 }; }) };
    }
    const groups = new Map();
    rows.forEach((r) => { const p = clean(r.v.projeto) ?? 'Sem informação'; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(r); });
    const list = [...groups.entries()].sort((a, b) => (a[0] === 'Sem informação') - (b[0] === 'Sem informação') || a[0].localeCompare(b[0], 'pt'))
      .map(([name, rs]) => ({ name, rows: rs.sort((a, b) => (a.e?.getTime() ?? Infinity) - (b.e?.getTime() ?? Infinity)) }));
    return { groups: list, undated, hidden, scale };
  }, [vagas, zoom, weekly, today]);

  const { x, width, ticks, dayPx } = model.scale;
  const todayX = x(new Date(today));
  const toggle = (n) => setCollapsed((c) => { const s = new Set(c); if (s.has(n)) s.delete(n); else s.add(n); return s; });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex rounded-full border border-border bg-card p-0.5">
          {[['week', '8 semanas'], ['month', 'Mês'], ['quarter', 'Trimestre']].map(([id, l]) => (
            <button key={id} onClick={() => setZoom(id)} aria-pressed={zoom === id} className={cn('h-7 rounded-full px-3', zoom === id ? 'bg-accent font-medium text-accent-foreground' : 'hover:text-foreground')}>{l}</button>
          ))}
        </div>
        {Object.entries(LABEL).map(([k, l]) => <span key={k} className="flex items-center gap-1.5"><span className={cn('h-2 w-4 rounded-full', TONE[k])} />{l}</span>)}
        <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-primary" />Hoje</span>
        <span>Barra = abertura → início previsto · ◆ início previsto · ● preenchimento</span>
      </div>
      {weekly && <p className="text-xs text-muted-foreground">Próximas 8 semanas + vagas atrasadas{model.hidden ? ` · ${model.hidden} vaga(s) fora da janela — use Mês ou Trimestre para ver todas` : ''}.</p>}

      {model.groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma vaga com início previsto nesta janela.</p>
      ) : (
        <div className="max-h-[72vh] overflow-auto rounded-md border border-border bg-card">
          <div className="relative" style={{ width: LABEL_W + width }}>
            <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-primary shadow-[var(--glow-dot)]" style={{ left: LABEL_W + todayX }} />
            <div className="sticky top-0 z-20 flex border-b border-border bg-muted text-xs">
              <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-muted px-3 py-2 font-medium" style={{ width: LABEL_W }}>Vaga</div>
              {ticks.map((t) => <div key={t.k} className={cn('shrink-0 truncate border-r border-border px-2 py-2 text-muted-foreground', t.now && 'font-medium text-primary')} style={{ width: t.w }}>{t.label}</div>)}
            </div>
            {model.groups.map((g) => (
              <div key={g.name}>
                <button onClick={() => toggle(g.name)} className="sticky left-0 z-[5] flex items-center gap-2 border-b border-border bg-card px-3 py-2 text-left text-sm font-medium hover:bg-accent/30" style={{ width: LABEL_W + width }}>
                  <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', !collapsed.has(g.name) && 'rotate-90')} />
                  <span className="truncate" title={g.name}>{g.name}</span><span className="text-xs font-normal text-muted-foreground">{g.rows.length}</span>
                </button>
                {!collapsed.has(g.name) && g.rows.map(({ v, s, e, f, st }) => {
                  const barL = s && e && s < e ? x(s) : null;
                  return (
                    <div key={v.id} className="group flex h-10 border-b border-border/70 hover:bg-accent/25">
                      <button onClick={() => onOpen(v)} className="sticky left-0 z-[5] flex shrink-0 items-center gap-2 border-r border-border bg-card px-3 text-left group-hover:bg-accent/40" style={{ width: LABEL_W }}>
                        <span className="min-w-0 flex-1 truncate text-xs" title={`${v.name} · Cód. ${v.id}`}>{clean(v.cargoPapel) ?? v.name}<span className="ml-1.5 text-muted-foreground tabular-nums">#{v.id}</span></span>
                        <VagaAge vaga={v} className="hidden lg:inline-flex" />
                      </button>
                      <div className="relative shrink-0" style={{ width }}>
                        {barL != null && <button onClick={() => onOpen(v)} aria-label={v.name} title={`${v.name}\nAbertura ${fmtDate(s)} → início ${fmtDate(e)}`} className={cn('absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100', TONE[st])} style={{ left: barL, width: Math.max(4, x(e) - barL) }} />}
                        {e && <StartMarker v={v} e={e} st={st} left={x(e)} dayPx={dayPx} onOpen={onOpen} />}
                        {f && <span title={`Preenchida em ${fmtDate(f)}`} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: x(f) }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {model.undated.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Sem datas ({model.undated.length}):</span>
          {model.undated.map((v) => <button key={v.id} onClick={() => onOpen(v)} className="max-w-[240px] truncate rounded-full border border-border px-3 py-1 hover:border-primary/50" title={v.name}>{v.name}</button>)}
        </div>
      )}
    </div>
  );
}
