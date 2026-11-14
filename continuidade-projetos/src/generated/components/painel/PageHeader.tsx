import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { Download, Info, Moon, RefreshCw, Sun } from 'lucide-react';
import { useTema } from '@generated/hooks/useTema';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { cn } from '@lib/utils';

export function PageHeader({ savedAt, refreshing, produtosPendentes, onRefresh, onExport, exportDisabled, total, fatores }: {
  savedAt: number | null; refreshing: boolean; produtosPendentes: number; onRefresh: () => void;
  onExport: () => void; exportDisabled: boolean; total: number; fatores?: ReactNode;
}) {
  const { escuro, alternar } = useTema();
  const hora = savedAt ? format(new Date(savedAt), 'dd/MM HH:mm') : null;
  const aviso = hora
    ? `Dados carregados em ${hora}. Alterações feitas por outras pessoas só aparecem após clicar em Atualizar dados ou recarregar a página (F5).`
    : null;
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Continuidade de Projetos</p>
        <h1 className="mt-1 text-2xl font-normal tracking-[-0.025em] text-foreground sm:text-3xl">Gestão de Equipes de Projetos em Encerramento</h1>
        <p className="mt-1.5 text-sm text-muted-foreground" aria-live="polite">
          {produtosPendentes > 0
            ? `Carregando produtos de ${produtosPendentes} projeto${produtosPendentes === 1 ? '' : 's'}…`
            : 'Apoio à decisão sobre manter, reduzir ou desmobilizar equipes'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {fatores}
        <button
          type="button"
          onClick={alternar}
          aria-label={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          title={escuro ? 'Modo claro' : 'Modo escuro'}
          className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {escuro ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
        </button>
        {aviso && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={aviso}
                className="inline-flex min-h-10 cursor-help items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5 shrink-0" aria-hidden />
                <span className="tnum">Carregado em {hora}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{aviso}</TooltipContent>
          </Tooltip>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm text-foreground hover:bg-accent disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className={cn('size-4', (refreshing || produtosPendentes > 0) && 'animate-spin')} aria-hidden />
          Atualizar dados
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-3.5 text-sm text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Download className="size-4" aria-hidden />
          Exportar CSV
          <span className="tnum rounded-sm bg-background/15 px-1.5 text-xs">{total}</span>
        </button>
      </div>
    </header>
  );
}
