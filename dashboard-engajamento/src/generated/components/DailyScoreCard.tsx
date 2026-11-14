import { Check, Minus } from 'lucide-react';
import { useDailyScore } from '@generated/hooks/dailyScoreContext';
import { formatBR, parseDateFlexible } from '@generated/lib/dates';

/** Texto curto do score geral: "63% (5 de 8 semanas)", "Afastado no período" ou "Sem semanas analisadas". */
export function userScoreText(s: { percent: number | null; weeksAccessed: number; weeksTotal: number; allAway: boolean }): string {
  if (s.allAway) return 'Afastado no período';
  if (s.weeksTotal === 0 || s.percent === null) return 'Sem semanas analisadas';
  return `${s.percent}% (${s.weeksAccessed} de ${s.weeksTotal} ${s.weeksTotal === 1 ? 'semana' : 'semanas'})`;
}

const br = (iso: string) => formatBR(parseDateFlexible(iso));

/** Resumo do score geral da pessoa (semanas com acesso ÷ semanas válidas da Base). */
export function DailyScoreSummary({ personKey, large = false }: { personKey: string; large?: boolean }) {
  const s = useDailyScore(personKey);
  const empty = s.allAway || s.weeksTotal === 0 || s.percent === null;
  return (
    <div className="space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Score do usuário</span>
      <p className={`${large ? 'text-3xl' : 'text-lg'} font-semibold tabular-nums text-foreground`}>
        {empty ? (s.allAway ? 'Afastado no período' : 'Sem semanas analisadas') : `${s.percent}%`}
      </p>
      {!empty && (
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">{s.weeksAccessed}</strong> de <strong className="text-foreground">{s.weeksTotal}</strong>{' '}
          {s.weeksTotal === 1 ? 'semana' : 'semanas'} com acesso
        </p>
      )}
      {s.entryDate ? (
        <p className="text-[11px] text-muted-foreground">
          Contado a partir de {br(s.entryDate)} ({s.entrySource === 'criado_em' ? 'Criado em' : 'primeira semana em que aparece'})
        </p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Último acesso conhecido: <strong className="text-foreground">{s.lastAccess ? br(s.lastAccess) : 'Nunca acessou'}</strong>
      </p>
    </div>
  );
}

/** Uma linha por semana com período definido: período, sete dias e se acessou. */
export function DailyWeeksList({ personKey }: { personKey: string }) {
  const s = useDailyScore(personKey);
  if (s.weeks.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem semanas analisadas.</p>;
  }
  return (
    // Altura fixa com rolagem própria: só a lista de semanas rola (mais recente primeiro)
    <div
      role="region"
      aria-label="Lista de semanas"
      tabIndex={0}
      className="h-80 overflow-y-auto overscroll-contain pr-1 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
    <ul className="space-y-2">
      {s.weeks.map((w) => (
        <li key={w.group} className="p-3 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-start justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="font-medium text-foreground block truncate" title={w.group}>{w.group}</span>
              <span className="text-[11px] text-muted-foreground">{br(w.weekStart)} a {br(w.weekEnd)}</span>
            </div>
            <span className="text-muted-foreground shrink-0 text-right">
              {w.away ? 'Afastado' : w.accessed ? 'Acessou na semana' : 'Não acessou na semana'}
              {!w.counted ? <span className="block text-[10px]">Fora do score</span> : null}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {w.days.map((d) => (
              <div
                key={d.key}
                title={`${d.short}${d.checked ? ' · presente' : ' · sem check'}`}
                className={`rounded-md border px-1 py-1.5 text-center text-[10px] ${
                  d.checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                <div className="font-medium">{d.short}</div>
                <div className="flex justify-center mt-0.5" aria-hidden="true">
                  {d.checked ? <Check className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                </div>
                <span className="sr-only">{d.checked ? 'presente' : 'sem check'}</span>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
    </div>
  );
}
