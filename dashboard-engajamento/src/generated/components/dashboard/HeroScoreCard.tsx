import { Sigma } from 'lucide-react';
import type { BandCounts } from '@generated/lib/dashboardTheme';
import { SCORE_HIGH_THRESHOLD, SCORE_LOW_THRESHOLD } from '@generated/lib/dashboardTheme';

interface Props {
  weekly: boolean;
  headlinePeriod: string; // Ex.: "na Semana 2", "em outubro", "no trimestre"
  periodPhrase: string;
  scopePhrase?: string; // Ex.: "no projeto X" / "em Departamento Y"
  counts: BandCounts;
  averageProjectsScore?: number | null; // Média simples dos scores dos projetos no escopo
  empty?: boolean; // Período sem nenhuma semana analisada: tudo em 0%
}

const SIZE = 168;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

function Ring({ value, label }: { value: number | null; label: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative shrink-0 w-[168px] h-[168px] mx-auto md:mx-0">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-card/80" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (pct / 100) * C}
          className="stroke-[hsl(var(--brand-navy))] transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-4xl font-light tracking-[-0.04em] tabular-nums text-[hsl(var(--brand-navy))]">
            {value === null ? '—' : `${value}%`}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand-navy)/0.7)]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, small = false }: { value: number | string; label: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`${small ? 'text-2xl' : 'text-3xl sm:text-4xl'} font-light tracking-[-0.03em] tabular-nums text-[hsl(var(--brand-navy))]`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-navy)/0.65)]">{label}</p>
    </div>
  );
}

export function HeroScoreCard({ weekly, headlinePeriod, periodPhrase, scopePhrase, counts, averageProjectsScore, empty = false }: Props) {
  const scope = scopePhrase ? ` ${scopePhrase}` : '';
  // Destaque = score geral dos projetos (média simples das notas dos projetos).
  // Sem projeto com nota no recorte, mostra o número das pessoas.
  const hasProjectScore = averageProjectsScore !== undefined && averageProjectsScore !== null;
  const ringValue = empty ? 0 : hasProjectScore ? averageProjectsScore : counts.ringValue;
  const peopleLabel = weekly ? 'Pessoas engajadas' : 'Score médio das pessoas';
  const title = empty
    ? `Nenhuma semana analisada${scope} ${periodPhrase}`
    : ringValue === null
      ? `Ainda não há pessoas avaliadas${scope} ${periodPhrase}`
      : hasProjectScore
        ? `Engajamento dos projetos ${headlinePeriod} foi de ${ringValue}%`
        : `Engajamento ${headlinePeriod} foi de ${ringValue}%`;
  const formula = hasProjectScore
    ? weekly
      ? 'Score = média simples das notas dos projetos · Engajado = ao menos um acesso na semana (domingo a sábado)'
      : 'Score = média simples das notas dos projetos · nota = semanas ativas ÷ semanas atualizadas'
    : weekly
      ? 'Engajado = ao menos um acesso na semana (domingo a sábado)'
      : 'Score geral = semanas ativas ÷ semanas atualizadas × 100';

  return (
    <section className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[hsl(var(--brand-sky))] to-[hsl(var(--brand-sky-2))] border border-[hsl(var(--brand-navy)/0.08)] shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        <Ring value={ringValue} label={hasProjectScore ? 'Média projetos' : weekly ? 'Engajados' : 'Score médio'} />

        <div className="flex-1 min-w-0 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--brand-navy)/0.7)]">
            {weekly ? 'Engajamento semanal' : 'Score de engajamento'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-normal tracking-[-0.025em] leading-tight text-[hsl(var(--brand-navy))] text-balance">
            {title}
          </h2>
          <p className="flex items-center gap-2 text-xs text-[hsl(var(--brand-navy)/0.75)]">
            <Sigma className="w-3.5 h-3.5 shrink-0" />
            {formula}
          </p>

          <div className="pt-4 border-t border-[hsl(var(--brand-navy)/0.12)] flex flex-wrap items-end gap-x-8 gap-y-4">
            <Stat value={counts.evaluated} label="Avaliados" />
            {weekly ? (
              <>
                <Stat value={counts.engaged} label="Engajados" />
                <Stat value={counts.notEngaged} label="Não engajados" />
              </>
            ) : (
              <>
                <Stat value={counts.high} label={`Score alto (≥ ${SCORE_HIGH_THRESHOLD}%)`} />
                <Stat value={counts.low} label={`Score baixo (< ${SCORE_LOW_THRESHOLD}%)`} />
              </>
            )}
            {hasProjectScore && counts.ringValue !== null && (
              <div className="pl-6 border-l border-[hsl(var(--brand-navy)/0.12)]">
                <Stat value={`${counts.ringValue}%`} label={peopleLabel} />
              </div>
            )}
            <div className="pl-6 border-l border-[hsl(var(--brand-navy)/0.12)]">
              <Stat value={counts.away} label="Afastados" small />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
