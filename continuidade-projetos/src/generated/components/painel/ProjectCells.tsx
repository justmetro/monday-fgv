import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { Chip, RascunhoTag, TemperaturaBadge, decisaoTone, perspectivaTone, prazoChipTone, prazoLabel } from '@generated/components/painel/Chips';
import { fmtBRL, fmtDate, fmtNum, type Row } from '@generated/lib/painel';

export function ProjetoCell({ r, onOpen }: { r: Row; onOpen: () => void }) {
  const p = r.projeto;
  const meta = [p.sigla, p.codigo].filter(Boolean).join(' · ');
  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full text-left text-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={p.name}
        >
          <span className="line-clamp-2 break-words">{p.name}</span>
        </button>
        {meta && <div className="mt-0.5 truncate text-xs text-muted-foreground" title={meta}>{meta}</div>}
      </div>
      {p.quadroUrl && (
        <a
          href={p.quadroUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="Abrir quadro do projeto em nova aba"
          title="Abrir quadro do projeto"
          className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/60 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      )}
    </div>
  );
}

export function TerminoCell({ r }: { r: Row }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default flex-col items-start gap-1 focus-visible:outline-none" tabIndex={0}>
          <span className="tnum text-sm text-foreground">{fmtDate(r.termino.date)}</span>
          <Chip tone={prazoChipTone(r.tom)} dot>{prazoLabel(r.tom, r.dias)}</Chip>
        </span>
      </TooltipTrigger>
      <TooltipContent>{r.termino.fonte ? `Fonte: ${r.termino.fonte}` : 'Nenhuma data de entrega ou do projeto preenchida'}</TooltipContent>
    </Tooltip>
  );
}

export function PessoasCell({ r }: { r: Row }) {
  if (r.alocCarregando && !r.ajustado) return <span className="text-xs text-muted-foreground">Carregando…</span>;
  if (r.naoInformada) {
    return <Chip tone="warning" title="Nenhuma pessoa do projeto no quadro Equipes Revisadas"><AlertTriangle className="size-3" aria-hidden />Sem equipe cadastrada</Chip>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="tnum text-sm text-foreground">
        {r.pessoas}
        <span className="ml-1.5 text-xs text-muted-foreground">pessoas</span>
      </span>
      {r.ajustado && <Chip tone="warning" title="Valor ajustado manualmente no app (sobrepõe o quadro Equipes Revisadas)">ajustado no app</Chip>}
    </div>
  );
}

export function CustoCell({ r }: { r: Row }) {
  return (
    <div className="flex flex-col items-end">
      <span className="tnum text-sm text-foreground" title={r.custoSimulado !== null ? `Simulação (sem Realocar/Desligar). Custo Total: ${fmtBRL(r.custoMensal)}` : 'Valor Base Plan. × fator de encargos'}>
        {fmtBRL(r.custoMensal)}
      </span>
      {r.base.custoMensal !== null && <span className="tnum text-xs text-muted-foreground">base {fmtBRL(r.base.custoMensal)}</span>}
      {r.custoSimulado !== null && <span className="tnum text-xs text-muted-foreground">simulação {fmtBRL(r.custoSimulado)}</span>}
      {(r.rascunho.simulacao || r.rascunho.base) && <RascunhoTag className="mt-0.5" />}
      {r.custoAteTermino !== null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={(e) => e.stopPropagation()} className="tnum cursor-help rounded-sm text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              até o fim {fmtBRL(r.custoAteTermino)}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Calculado até {fmtDate(r.refCusto.date)} ({r.refCusto.fonte === 'Manter até' ? '"Manter até", decisão de redução' : 'último produto previsto'}) · ≈ {fmtNum(r.mesesRestantes)} meses · salário bruto, sem encargos
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function ProdutosCell({ r, carregando }: { r: Row; carregando: boolean }) {
  if (r.pendentes === null) {
    return carregando ? <Skeleton className="ml-auto h-4 w-14" /> : <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col items-end">
      <span className="tnum text-sm text-foreground">{r.pendentes}</span>
      {(r.atrasados ?? 0) > 0 ? (
        <span className="tnum text-xs font-medium text-[hsl(var(--danger-ink))]">{r.atrasados} atrasado{r.atrasados === 1 ? '' : 's'}</span>
      ) : (
        <span className="text-xs text-muted-foreground">sem atraso</span>
      )}
    </div>
  );
}

export function PerspectivaCell({ r }: { r: Row }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Chip tone={perspectivaTone(r.perspectiva)}>{r.perspectiva ?? 'Não definida'}</Chip>
      {r.rascunho.perspectiva && <RascunhoTag />}
    </div>
  );
}

export function TemperaturaCell({ r }: { r: Row }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {r.temperatura ? <TemperaturaBadge valor={r.temperatura} /> : <span className="text-sm text-muted-foreground">—</span>}
      {r.rascunho.temperatura && <RascunhoTag />}
    </div>
  );
}

export function DecisaoCell({ r }: { r: Row }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Chip tone={decisaoTone(r.decisaoLabel)} dot={!!r.decisaoLabel}>{r.decisaoLabel ?? 'Sem decisão'}</Chip>
      {r.meses !== null && <span className="tnum text-xs text-muted-foreground">{fmtNum(r.meses)} {r.meses === 1 ? 'mês' : 'meses'} de manutenção</span>}
      {(r.rascunho.decisao || r.rascunho.meses) && <RascunhoTag />}
    </div>
  );
}
