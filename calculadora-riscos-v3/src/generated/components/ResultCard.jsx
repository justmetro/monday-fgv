import { useState } from 'react';
import { ChevronDown, TriangleAlert, CircleX } from 'lucide-react';
import { StatusBadge } from '@generated/components/StatusBadge';
import { cn } from '@lib/utils';

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg tabular-nums text-foreground">{value ?? '-'}</dd>
    </div>
  );
}

/** Painel de resultado de um projeto: grupos, novos, total, avisos/erro e o log gravado. */
export function ResultCard({ result }) {
  const [open, setOpen] = useState(false);
  const isError = result.status === 'Erro';

  return (
    <article className="rounded-[6px] border border-border bg-background p-3.5 text-card-foreground">
      <header className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-[13.5px] font-medium leading-snug">{result.name}</h3>
        <StatusBadge status={result.status} />
      </header>

      {isError ? (
        <p className="mt-3 flex gap-2 break-words text-sm text-destructive">
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0">{result.error}</span>
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
            <Stat label="Grupos" value={result.groups.length} />
            <Stat label="Riscos ativos no projeto" value={result.total} />
          </dl>
          {result.alteracoes && (
            <div className="mt-3 rounded-[6px] bg-muted p-3">
              <p className="text-xs text-muted-foreground">Alterações nesta execução</p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                <Stat label="Novos" value={result.alteracoes.novos} />
                <Stat label="Descartados" value={result.alteracoes.descartados} />
                <Stat label="Sinalizados" value={result.alteracoes.sinalizados} />
                <Stat label="Reativados" value={result.alteracoes.reativados} />
              </dl>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {result.nTot} selecionados = {result.nEsp} específicos + {result.nTr} transversais
          </p>
          {result.groups.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Grupos identificados">
              {result.groups.map((g) => (
                <li key={g} className="rounded-[3px] bg-muted px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs">
                  {g}
                </li>
              ))}
            </ul>
          )}
          {result.warnings.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.warnings.map((w) => (
                <li key={w} className="flex gap-2 text-sm text-foreground">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 break-words">{w}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-[5px] px-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
        {open ? 'Ocultar log' : 'Ver log gravado'}
      </button>
      {open && (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[6px] bg-muted p-3 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-foreground">
          {result.log}
        </pre>
      )}
    </article>
  );
}
