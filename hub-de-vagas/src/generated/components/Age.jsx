import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '@generated/lib/data';
import { daysSince, daysUntil } from '@generated/lib/dates';
import { desalocInfo, SITU } from '@generated/lib/esteira';
import { cn } from '@lib/utils';

// neutral → yellow (>7 days) → red (>15 days)
export const ageTone = (days) => (days == null ? 'none' : days > 15 ? 'danger' : days > 7 ? 'warn' : 'neutral');
const TONE = {
  neutral: 'border-border bg-muted text-muted-foreground',
  warn: 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-primary/40 bg-primary/10 text-primary',
};

export function AgeBadge({ days, text, date, dateLabel = 'Data', tone, className }) {
  if (days == null || !text) return null;
  const t = tone ?? ageTone(days);
  return (
    <span title={date ? `${dateLabel}: ${fmtDate(date)}` : undefined}
      className={cn('inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums', TONE[t] ?? TONE.neutral, className)}>
      {text}
    </span>
  );
}

const dias = (n) => (n === 1 ? '1 dia' : `${n} dias`);

export function RoundAge({ match, className }) {
  const n = daysSince(match?.dataDeEnvioDoCard);
  if (n == null || n < 0) return null;
  return <AgeBadge days={n} date={match.dataDeEnvioDoCard} dateLabel="Envio do card" text={n === 0 ? 'enviado hoje' : `há ${dias(n)} nesta rodada`} className={className} />;
}

export function InterviewAge({ match, className }) {
  const n = daysUntil(match?.dataDaEntrevista);
  if (n == null || n < 0) return null;
  return <AgeBadge days={n} tone="info" date={match.dataDaEntrevista} dateLabel="Entrevista" text={n === 0 ? 'entrevista hoje' : n === 1 ? 'entrevista amanhã' : `entrevista em ${dias(n)}`} className={className} />;
}

// Vaga: days late (start date passed while open) or days open since opening date.
export function vagaAge(v) {
  const open = String(v?.vagaEmAberto ?? '').trim() === '1';
  if (!open) return null;
  const late = daysSince(v.dataDeIncioPrevista);
  if (late != null && late > 0) return { days: late, text: `${dias(late)} de atraso`, date: v.dataDeIncioPrevista, dateLabel: 'Início previsto', tone: late > 15 ? 'danger' : late > 7 ? 'warn' : 'neutral' };
  const opened = daysSince(v.dataDeAberturaDaVaga ?? v.createdAt);
  return opened != null && opened >= 0 ? { days: opened, text: `${dias(opened)} em aberto`, date: v.dataDeAberturaDaVaga ?? v.createdAt, dateLabel: 'Aberta em' } : null;
}
export const VagaAge = ({ vaga, className }) => { const a = vagaAge(vaga); return a ? <AgeBadge {...a} className={className} /> : null; };

// Perfil: referência = Data de Disponibilidade (tolerância de 15 dias antes de virar ocioso).
export function perfilAge(p) {
  const info = desalocInfo(p);
  if (!info) return null;
  const base = { days: info.days, date: info.date, dateLabel: 'Disponível em' };
  if (info.situ === SITU.ocioso) return { ...base, tone: 'danger', text: `ocioso há ${dias(info.ocioso)}` };
  if (info.situ === SITU.tolerancia) return { ...base, tone: 'warn', text: info.days === 0 ? 'disponível hoje' : `desalocado há ${dias(info.days)} · tolerância` };
  return { ...base, tone: info.situ === SITU.depois ? 'neutral' : 'info', text: `disponível em ${dias(-info.days)}` };
}

// Animated counter for KPI numbers (respects reduced motion).
export function CountUp({ value, duration = 600, format = (n) => n.toLocaleString('pt-BR') }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const target = Number(value) || 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(target); from.current = target; return undefined; }
    const start = performance.now();
    const a = Number(from.current) || 0;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (target - a) * eased));
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

// Item 9: matches sem nenhum dado preenchido / sem perfil válido → sinalizados como possível teste.
export function SemDadosBadge({ m, className }) {
  if (!m?._semDados && !m?._perfilAusente) return null;
  const why = [m._semDados && 'rodada, status, resultado, datas e próxima ação vazios', m._perfilAusente && 'perfil vinculado não está no grupo de perfis', m._semPerfil && 'sem perfil vinculado'].filter(Boolean).join(' · ');
  return <span title={why} className={cn('mt-1 inline-flex w-fit items-center rounded-full border border-dashed border-[hsl(var(--warning)/0.6)] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--warning))]', className)}>Sem dados · possível teste</span>;
}
