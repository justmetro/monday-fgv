import { useState } from 'react';
import { ChevronDown, TriangleAlert, CircleX, ArrowUpRight } from 'lucide-react';
import { ConsoleShell, IdleSteps } from '@generated/components/ConsoleShell';
import { StatusBadge } from '@generated/components/StatusBadge';
import { cn } from '@lib/utils';

const STEPS = [
  'Lê o “Link do Planejamento” de cada projeto e localiza o grupo “Riscos” do quadro [PLAN].',
  'Busca no 09.4 todos os riscos do projeto, qualquer que seja a aplicabilidade, e completa tema e impactado pela Base (09.2).',
  'Cria no grupo “Riscos” apenas os que ainda não existem e registra um update no projeto (09.1).',
];

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg tabular-nums text-foreground">{value ?? '-'}</dd>
    </div>
  );
}

function SendResultCard({ result }) {
  const [open, setOpen] = useState(result.warnings.length <= 3);
  return (
    <article className="rounded-[6px] border border-border bg-background p-3.5 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-base font-medium leading-snug">{result.name}</h3>
        <StatusBadge status={result.status} />
      </div>
      {result.destName && (
        <a
          href={result.url || undefined}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex max-w-full items-center gap-1 break-words text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <span className="min-w-0 break-words">
            {result.destName}
            {result.url?.includes('/views/') ? ' · aba Riscos' : ''}
          </span>
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
        </a>
      )}
      {result.error ? (
        <p className="mt-3 flex gap-2 rounded-[6px] bg-muted p-3 text-sm">
          <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span className="min-w-0 break-words">{result.error}</span>
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3">
          <Stat label="No 09.4" value={result.total} />
          <Stat label="Copiados" value={result.copied} />
          <Stat label="Já existiam" value={result.skipped} />
        </dl>
      )}
      {result.warnings.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
            {result.warnings.length} aviso(s)
          </button>
          {open && (
            <ul className="mt-1 space-y-1.5">
              {result.warnings.map((w) => (
                <li key={w} className="flex gap-2 text-sm text-foreground">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 break-words">{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function Summary({ results }) {
  const ok = results.filter((r) => r.status !== 'Erro').length;
  const err = results.length - ok;
  const copied = results.reduce((s, r) => s + (r.copied || 0), 0);
  const skipped = results.reduce((s, r) => s + (r.skipped || 0), 0);
  return (
    <p className="text-sm text-[hsl(var(--paper-dim))]">
      {[`${ok} enviados`, `${err} com erro`, `${copied} riscos copiados`, `${skipped} já existiam`].join(' · ')}
    </p>
  );
}

/** Console do envio ao planejamento. */
export function SendConsole({ run, onClear }) {
  return (
    <ConsoleShell
      title="Envio"
      ariaLabel="Envio ao planejamento"
      run={run}
      onClear={onClear}
      summary={<Summary results={run.results} />}
      idle={(
        <IdleSteps
          intro={<>Marque projetos com link e clique em <strong className="font-medium">Enviar selecionados ao planejamento</strong>, ou envie todos marcados como “Enviar”.</>}
          steps={STEPS}
          footnote="Pode enviar quantas vezes quiser: riscos que já estão no quadro de planejamento são ignorados. Nada é alterado no 09.4 nem na Base."
        />
      )}
    >
      {run.results.map((r) => <SendResultCard key={r.id} result={r} />)}
    </ConsoleShell>
  );
}
