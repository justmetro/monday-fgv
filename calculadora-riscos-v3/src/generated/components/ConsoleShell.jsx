import { Loader2, CircleX } from 'lucide-react';
import { SegmentMeter } from '@generated/components/SegmentMeter';

/** Painel escuro de execução: medidor segmentado, fase atual, resumo e lista de resultados. */
export function ConsoleShell({ title, ariaLabel, run, onClear, idle, summary, children }) {
  const started = run.running || run.results.length > 0 || run.fatal;

  return (
    <section
      aria-label={ariaLabel}
      className="flex min-h-0 flex-col rounded-[6px] border border-border bg-[hsl(var(--ink))] p-4 text-[hsl(var(--paper))]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-medium">{title}</h2>
        {started && !run.running && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 rounded-[5px] border border-[hsl(var(--ink-line))] px-3.5 text-sm text-[hsl(var(--paper))] transition-colors duration-150 hover:bg-[hsl(var(--ink-soft))] focus-visible:outline-2 focus-visible:outline-[hsl(var(--paper))]"
          >
            Limpar
          </button>
        )}
      </div>

      {!started && idle}

      {started && (
        <div className="space-y-4">
          <SegmentMeter total={run.total} results={run.results} running={run.running} fraction={run.fraction} />
          <div aria-live="polite" className="min-h-5 space-y-1 text-sm">
            {run.running && (
              <p className="flex items-start gap-2 text-[hsl(var(--paper))]">
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
                <span className="min-w-0 break-words">
                  {run.currentName ? `Processando: ${run.currentName}` : run.phase}
                </span>
              </p>
            )}
            {run.running && run.currentName && run.phase && (
              <p className="text-xs text-[hsl(var(--paper-dim))]">{run.phase}</p>
            )}
            {!run.running && run.results.length > 0 && summary}
          </div>
          {run.fatal && (
            <p className="flex gap-2 rounded-[6px] bg-[hsl(var(--ink-soft))] p-3 text-sm">
              <CircleX className="mt-0.5 size-4 shrink-0 text-[hsl(var(--err))]" aria-hidden />
              <span className="min-w-0 break-words">{run.fatal}</span>
            </p>
          )}
        </div>
      )}

      {run.results.length > 0 && (
        <div className="-mx-1 mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-1 lg:max-h-[calc(100dvh-22rem)]">
          {children}
        </div>
      )}
    </section>
  );
}

/** Lista numerada usada no estado inicial dos painéis. */
export function IdleSteps({ intro, steps, footnote }) {
  return (
    <div className="space-y-4 text-sm text-[hsl(var(--paper-dim))]">
      <p className="text-[hsl(var(--paper))]">{intro}</p>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[5px] border border-[hsl(var(--ink-line))] text-xs tabular-nums text-[hsl(var(--paper))]">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <p className="border-t border-[hsl(var(--ink-line))] pt-3 text-xs">{footnote}</p>
    </div>
  );
}
