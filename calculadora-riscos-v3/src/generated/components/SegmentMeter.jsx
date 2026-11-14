import { cn } from '@lib/utils';

const MAX_SEGMENTS = 30;

function colorFor(status) {
  if (status === 'Erro') return 'bg-[hsl(var(--err))]';
  if (String(status || '').endsWith('c/ avisos')) return 'bg-[hsl(var(--warn))]';
  return 'bg-[hsl(var(--ok))]';
}

/**
 * Medidor segmentado. Até 30 projetos: um segmento por projeto, colorido pelo resultado.
 * Acima disso: 30 segmentos proporcionais ao avanço.
 */
export function SegmentMeter({ total, results, running, fraction }) {
  const done = results.length;
  const perProject = total > 0 && total <= MAX_SEGMENTS;
  const count = perProject ? total : MAX_SEGMENTS;
  const progress = total ? (done + (running ? fraction : 0)) / total : 0;
  const filled = Math.floor(progress * count);

  return (
    <div className="space-y-2">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Progresso da execução"
      >
        {Array.from({ length: count }).map((_, i) => {
          let cls = 'bg-[hsl(var(--track))]';
          if (perProject) {
            if (i < done) cls = colorFor(results[i]?.status);
            else if (i === done && running) cls = 'bg-primary seg-active';
          } else if (i < filled) {
            cls = 'bg-primary';
          } else if (i === filled && running) {
            cls = 'bg-primary seg-active';
          }
          return <span key={i} className={cn('h-1 min-w-0 flex-1 rounded-[2px] transition-colors duration-200', cls)} />;
        })}
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm text-[hsl(var(--paper-dim))]">
        <span className="tabular-nums text-[hsl(var(--paper))]">
          {done}/{total} projetos
        </span>
        <span className="tabular-nums">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
}
