import { Search, X, UserCheck, CalendarClock } from 'lucide-react';
import { dotDe } from '@generated/lib/status';
import { Switch } from '@components/ui/switch';
import { Spinner } from '@components/ui/spinner';
import { cn } from '@lib/utils';
import { MultiSelect } from '@generated/components/MultiSelect';
import type { FiltrosState, Opcoes } from '@generated/hooks/useProjetos';
import { FILTROS_INICIAIS } from '@generated/hooks/useProjetos';
import { SEM_PONTO_FOCAL } from '@generated/lib/nomes';

interface Props {
  filtros: FiltrosState;
  setFiltros: (f: FiltrosState) => void;
  opcoes: Opcoes | null;
  opcoesLoading: boolean;
  /** Projects in the current scope where the signed-in user is Ponto Focal. */
  meusCount: number | null;
  onToggleMeus: (on: boolean) => void;
  meusDisponivel: boolean;
  /** Quick filter "Fim de atuação" is waiting for the Mapa de Gerentes. */
  fimCarregando?: boolean;
  fimErro?: boolean;
  /** Show the Visão geral-only toggles (Novo Cadastro / Pausado). */
  visaoGeral?: boolean;
  /** Prazos / Financeiro / Status SGI: show the Novo Cadastro toggles. */
  novoCadastro?: boolean;
}

const FIM_OPCOES = [15, 30, 45, 60] as const;

/** Two flowing rows (search/scope, then filters) — no absolute positioning between blocks. */
export function FilterBar({ filtros, setFiltros, opcoes, opcoesLoading, meusCount, onToggleMeus, meusDisponivel, fimCarregando, fimErro, visaoGeral, novoCadastro }: Props) {
  const set = <K extends keyof FiltrosState>(k: K, v: FiltrosState[K]) => setFiltros({ ...filtros, [k]: v });
  const ativos =
    filtros.eixo.length + filtros.uf.length + filtros.gerente.length +
    filtros.tipoPlanejamento.length + filtros.prioridade.length +
    filtros.pontoFocal.length + (filtros.search ? 1 : 0) + (filtros.fimAtuacao ? 1 : 0);

  type ToggleKey = 'includeFinalizados' | 'includeNovo30' | 'includeNovo45' | 'includePausado';
  const toggles: { k: ToggleKey; rotulo: string; titulo: string; dot: string }[] = [
    { k: 'includeFinalizados', rotulo: 'Finalizados', titulo: 'Finalizado (Plan + SGI)', dot: dotDe('Finalizado (Plan + SGI)') },
    ...(visaoGeral || novoCadastro ? [
      { k: 'includeNovo30' as const, rotulo: 'Novo 30-45', titulo: 'Novo Cadastro - 30 a 45 dias', dot: dotDe('Novo Cadastro - 30 a 45 dias') },
      { k: 'includeNovo45' as const, rotulo: 'Novo 45-60', titulo: 'Novo Cadastro - 45 a 60 dias', dot: dotDe('Novo Cadastro - 45 a 60 dias') },
    ] : []),
    ...(visaoGeral ? [{ k: 'includePausado' as const, rotulo: 'Pausados', titulo: 'Pausado (Visão geral)', dot: dotDe('Pausado') }] : []),
  ];
  const pessoas = new Map((opcoes?.pontoFocal ?? []).map((p) => [p.id, p.name]));
  const pfOptions = [SEM_PONTO_FOCAL, ...(opcoes?.pontoFocal ?? []).map((p) => p.id)];
  const pfLabel = (v: string) => (v === SEM_PONTO_FOCAL ? 'Sem ponto focal' : pessoas.get(v) ?? `Usuário ${v}`);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {/* Linha 1: busca + Meus projetos · Incluir Histórico à direita */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <div className="relative min-w-0 max-w-[420px] flex-1 basis-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={filtros.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Buscar por nome ou código (ex.: 2025/086)"
            aria-label="Buscar projeto por nome ou código"
            className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] pl-8 pr-8 text-base text-foreground placeholder:text-[hsl(var(--fg-subtle))] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 md:h-7 md:text-xs"
          />
          {filtros.search && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => set('search', '')}
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          aria-pressed={filtros.meus}
          disabled={!meusDisponivel}
          onClick={() => onToggleMeus(!filtros.meus)}
          title={meusDisponivel ? 'Projetos em que você é Ponto Focal' : 'Não foi possível identificar o seu usuário'}
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-md)] border px-2 text-xs transition-colors duration-150 md:h-7',
            'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:opacity-50',
            filtros.meus
              ? 'border-[hsl(var(--primary)/0.55)] bg-[hsl(var(--accent-soft))] text-foreground'
              : 'border-input bg-[hsl(var(--surface-2))] text-muted-foreground hover:bg-[hsl(var(--surface-3))]',
          )}
        >
          <UserCheck className="size-3.5 shrink-0" aria-hidden />
          <span className="whitespace-nowrap">Meus projetos</span>
          {meusCount === null ? (
            meusDisponivel ? <Spinner className="size-3 shrink-0" /> : null
          ) : (
            <span className={cn(
              'tnum inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] px-1.5 text-[11px] font-semibold',
              filtros.meus ? 'bg-primary text-primary-foreground' : 'bg-[hsl(var(--surface-3))] text-foreground',
            )}>
              {meusCount}
            </span>
          )}
        </button>

        <fieldset aria-label="Incluir no escopo"
          className="m-0 ml-auto flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto border-0 p-0 max-sm:flex-nowrap sm:flex-wrap sm:justify-end">
          <span className="shrink-0 text-[11px] text-[hsl(var(--fg-subtle))]">Incluir:</span>
          {toggles.map((t) => (
            <div key={t.k} title={t.titulo}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-[hsl(var(--surface-2))] pl-2 pr-1 text-[11px] text-muted-foreground hover:bg-[hsl(var(--surface-3))] md:h-6">
              <span className={cn('size-2 shrink-0 rounded-full', t.dot)} aria-hidden />
              <label htmlFor={`tg-${t.k}`} className="cursor-pointer whitespace-nowrap">{t.rotulo}</label>
              <Switch id={`tg-${t.k}`} checked={filtros[t.k]} onCheckedChange={(v) => set(t.k, v)} className="origin-right scale-75" />
            </div>
          ))}
        </fieldset>
      </div>

      {/* Linha 2: filtros + Limpar filtros */}
      <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1.5 border-0 p-0">
        <legend className="sr-only">Filtros</legend>
        <MultiSelect label="Eixo" options={opcoes?.eixo ?? []} value={filtros.eixo} onChange={(v) => set('eixo', v)} loading={opcoesLoading} compacto />
        <MultiSelect label="UF" options={opcoes?.uf ?? []} value={filtros.uf} onChange={(v) => set('uf', v)} loading={opcoesLoading} compacto />
        <MultiSelect label="Gerente" options={opcoes?.gerente ?? []} value={filtros.gerente} onChange={(v) => set('gerente', v)} loading={opcoesLoading} compacto />
        <MultiSelect label="Tipo Planejamento" options={opcoes?.tipoPlanejamento ?? []} value={filtros.tipoPlanejamento} onChange={(v) => set('tipoPlanejamento', v)} loading={opcoesLoading} compacto />
        <MultiSelect label="Prioridade" options={opcoes?.prioridade ?? []} value={filtros.prioridade} onChange={(v) => set('prioridade', v)} loading={opcoesLoading} compacto />
        <MultiSelect label="Ponto Focal" options={opcoes ? pfOptions : []} value={filtros.pontoFocal} onChange={(v) => set('pontoFocal', v)} loading={opcoesLoading} getLabel={pfLabel} compacto />
        <fieldset className="m-0 inline-flex h-11 min-w-0 shrink-0 items-center overflow-hidden rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] p-0 text-xs md:h-7">
          <legend className="sr-only">Fim de atuação do gerente</legend>
          <span className="flex items-center gap-1.5 px-2.5 text-muted-foreground" aria-hidden>
            <CalendarClock className="size-3.5 shrink-0" aria-hidden /> Fim de atuação
            {fimCarregando && <Spinner className="size-3 shrink-0" />}
          </span>
          {FIM_OPCOES.map((n) => {
            const on = filtros.fimAtuacao === n;
            return (
              <button key={n} type="button" aria-pressed={on} onClick={() => set('fimAtuacao', on ? 0 : n)}
                aria-label={`Fim de atuação em menos de ${n} dias`}
                title={fimErro && on ? 'Não foi possível carregar o Mapa de Gerentes' : `Gerente com fim de atuação de hoje até ${n - 1} dias`}
                className={cn('h-full border-l border-input px-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  on ? 'bg-[hsl(var(--accent-soft))] font-medium text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--surface-3))]')}>
                {'< '}{n} dias
              </button>
            );
          })}
        </fieldset>
        {ativos > 0 && (
          <button
            type="button"
            onClick={() => setFiltros({ ...FILTROS_INICIAIS, includeFinalizados: filtros.includeFinalizados, includeNovo30: filtros.includeNovo30, includeNovo45: filtros.includeNovo45, includePausado: filtros.includePausado, meus: filtros.meus })}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground md:h-7"
          >
            <X className="size-3.5" aria-hidden /> Limpar filtros
          </button>
        )}
      </fieldset>
    </div>
  );
}
