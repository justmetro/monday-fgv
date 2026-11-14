import { createContext, useContext } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/tooltip';
import { fmtPct, fmtNum, diffPP, isHit, saldoText } from '@generated/lib';

/** true only for slides shown on screen (Slide wrapper); Apresentar / PDF render without it → no tooltips */
export const InteractiveCtx = createContext(false);
export const useInteractive = () => useContext(InteractiveCtx);

/** wraps a trigger with a shadcn tooltip when interactive */
export function Tip({ content, children, side = 'top' }) {
  const on = useInteractive();
  if (!on || !content) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">{content}</TooltipContent>
    </Tooltip>
  );
}

const SIT = { hit: 'atingiu a meta', miss: 'abaixo da meta', nometa: 'sem meta', nocase: 'sem casos', parcial: 'parcial, mês em andamento', na: 'sem medição' };

/** "Atingido / Total" line (counts) or "Saldo R$ X de R$ Y orçado" (saldo) */
export const fracLine = (r, un) => (r?.saldo ? saldoText(r) : r?.d > 0 ? `${fmtNum(r.n ?? 0)} de ${fmtNum(r.d)} ${un}` : null);

/** "IT1.1 setembro 2026: 50%, meta 70%, abaixo da meta, −20 p.p., 1 de 2 projetos" */
export function cellAria(code, label, r, un = 'itens') {
  const s = r?.state ?? 'na';
  if (s === 'na' || s === 'nocase' || r.apurado == null) return `${code} ${label}: ${SIT[s]}`;
  const f = fracLine(r, un);
  return `${code} ${label}: ${fmtPct(r.apurado)}, meta ${fmtPct(r.meta)}, ${SIT[s]}${r.meta != null && s !== 'parcial' ? `, ${diffPP(r.apurado, r.meta)}` : ''}${f ? `, ${f}` : ''}`;
}

export function MedTip({ code, label, r, un = 'itens', acum }) {
  const s = r?.state ?? 'na';
  const f = fracLine(r, un);
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-bold">{code} · {label}</p>
      {s === 'na' ? <p>Sem medição</p> : s === 'nocase' ? <p>Sem casos (Total Período vazio ou 0)</p> : (
        <>
          <p>Resultado <strong>{fmtPct(r.apurado)}</strong> · Meta {fmtPct(r.meta)}</p>
          {s !== 'parcial' && <p>Diferença {r.meta != null ? diffPP(r.apurado, r.meta) : '—'}</p>}
          {f && <p>{f}</p>}
          {s === 'parcial' && <p>Parcial: mês em andamento, resultado provisório</p>}
        </>
      )}
      {acum && <p>Soma de Atingido ÷ soma de Total dos meses fechados</p>}
      {r?.status && <p>Status: {r.status}</p>}
      <p className="pt-0.5 opacity-70">Clique para detalhes</p>
    </div>
  );
}

/** chart marker: hit = filled; below = hollow with thick stroke; no goal / partial = gray filled */
export function Marker({ cx, cy, r = 6, apurado, meta, lower, parcial, ...rest }) {
  const h = parcial ? null : isHit(apurado, meta, lower);
  if (h === false) return <circle cx={cx} cy={cy} r={r - 1} fill="hsl(var(--card))" stroke="hsl(var(--below))" strokeWidth={3} {...rest} />;
  return <circle cx={cx} cy={cy} r={r} fill={h == null ? 'hsl(var(--na))' : 'hsl(var(--ok))'} stroke="hsl(var(--card))" strokeWidth={2} {...rest} />;
}
