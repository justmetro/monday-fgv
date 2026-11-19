import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@lib/utils';
import { type Projeto, codigoDe, tituloDe, gerenteDe, fmtInt, fmtBRLCompact, fmtDate } from '@generated/lib/format';
import { etapasDe, type Etapa } from '@generated/lib/farol';
import { isInativo } from '@generated/lib/board-options';
import { parDe, semOrcamentoEm, foraDoTotalPorStatus } from '@generated/lib/finance';
import { corDe } from '@generated/lib/status';
import type { Datum } from '@generated/components/charts';
import { InfoDica } from '@generated/components/ui-bits';

export interface ListaDrill { titulo: string; subtitulo: string; projetos: Projeto[] }

type Filtro = 'todos' | 'atrasados' | 'vence' | 'semOrc';

interface Linha { p: Projeto; plan: Etapa }

interface Props {
  items: Projeto[];
  status: Datum[];
  planejados: number;
  rotuloPeriodo: string;
  medianaDias: string;
  ativos: number;
  finalizados: number;
  abrirStatus: (label: string) => void;
  abrirLista: (l: ListaDrill) => void;
}

const card = 'rounded-[22px] bg-card';
const rotulo = 'text-[13px] font-semibold text-muted-foreground';

function Bloco({ children, className, onClick, titulo }: { children: ReactNode; className?: string; onClick?: () => void; titulo?: string }) {
  const base = cn(card, 'flex min-h-[156px] min-w-0 flex-col justify-between gap-4 px-6 py-5 text-left', className);
  if (!onClick) return <article className={base}>{children}</article>;
  return (
    <button type="button" onClick={onClick} title={titulo}
      className={cn(base, 'transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {children}
    </button>
  );
}

/** Topo da Visão geral em blocos (estilo widgets) e a lista de próximos prazos com filtros rápidos. */
export function Destaques({ items, status, planejados, rotuloPeriodo, medianaDias, ativos, finalizados, abrirStatus, abrirLista }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const d = useMemo(() => {
    const abertos: Linha[] = [];
    const semOrc: Projeto[] = [];
    let saldo = 0;
    for (const p of items) {
      if (isInativo(p.statusPlanejamento)) continue;
      const plan = etapasDe(p)[0];
      if (plan.farol === 'atrasado' || plan.farol === 'vence' || plan.farol === 'aberto') abertos.push({ p, plan });
      if (!foraDoTotalPorStatus(p)) {
        if (semOrcamentoEm(p, 'total')) semOrc.push(p);
        else saldo += parDe(p, 'total').saldo ?? 0;
      }
    }
    abertos.sort((a, b) => (a.plan.diasParaPrazo ?? 0) - (b.plan.diasParaPrazo ?? 0));
    const atrasados = abertos.filter((l) => l.plan.farol === 'atrasado');
    const vence = abertos.filter((l) => l.plan.farol === 'vence');
    const semOrcSet = new Set(semOrc);
    const semOrcLinhas = abertos.filter((l) => semOrcSet.has(l.p));
    return { abertos, atrasados, vence, semOrc, semOrcLinhas, saldo };
  }, [items]);

  const listas: Record<Filtro, { linhas: Linha[]; titulo: string; total: number }> = {
    todos: { linhas: d.abertos, titulo: 'Próximos prazos', total: d.abertos.length },
    atrasados: { linhas: d.atrasados, titulo: 'Planejamento atrasado', total: d.atrasados.length },
    vence: { linhas: d.vence, titulo: 'Vencem em até 7 dias', total: d.vence.length },
    semOrc: { linhas: d.semOrcLinhas, titulo: 'Sem orçamento', total: d.semOrc.length },
  };
  const atual = listas[filtro];
  const visiveis = atual.linhas.slice(0, 8);

  const lista = (titulo: string, projetos: Projeto[]) => abrirLista({ titulo, subtitulo: 'Prazo do planejamento', projetos });
  const statusComDados = status.filter((s) => s.value > 0);
  const maxStatus = Math.max(1, ...statusComDados.map((s) => s.value));

  const chips: { id: Filtro; label: string; n: number; dot: string }[] = [
    { id: 'todos', label: 'Todos', n: d.abertos.length, dot: 'bg-primary' },
    { id: 'atrasados', label: 'Atrasados', n: d.atrasados.length, dot: 'bg-[hsl(var(--danger))]' },
    { id: 'vence', label: 'Vencem em 7 dias', n: d.vence.length, dot: 'bg-[hsl(var(--warning))]' },
    { id: 'semOrc', label: 'Sem orçamento', n: d.semOrc.length, dot: 'bg-[hsl(var(--neutral-status))]' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Bloco className="sm:col-span-2">
          <p className={cn(rotulo, 'flex items-center gap-1')}>Projetos na esteira
            <InfoDica texto="Projetos do grupo Esteira no escopo dos filtros (sem cancelados). É a soma das etapas por Status Planejamento." />
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="flex items-baseline gap-2.5">
              <span className="tnum text-[64px] font-semibold leading-none tracking-[-0.04em] text-foreground">{fmtInt(items.length)}</span>
              <span className="text-[15px] text-muted-foreground">projetos</span>
            </p>
            <p className="text-[13px] text-muted-foreground">
              {fmtInt(ativos)} ativos · {fmtInt(finalizados)} finalizados · mediana de {medianaDias} de planejamento
            </p>
          </div>
        </Bloco>

        <Bloco onClick={() => lista('Planejamento atrasado', d.atrasados.map((l) => l.p))} titulo="Ver os projetos atrasados">
          <span className={cn(rotulo, 'flex items-center justify-between')}>Atrasados <ChevronRight className="size-4" aria-hidden /></span>
          <span className="flex flex-col gap-1.5">
            <span className="tnum text-[44px] font-semibold leading-none tracking-[-0.035em] text-[hsl(var(--danger))]">{fmtInt(d.atrasados.length)}</span>
            <span className="text-[13px] text-muted-foreground">prazo do planejamento vencido</span>
          </span>
        </Bloco>

        <Bloco onClick={() => lista('Vencem em até 7 dias', d.vence.map((l) => l.p))} titulo="Ver os projetos que vencem em até 7 dias">
          <span className={cn(rotulo, 'flex items-center justify-between')}>Vencem em 7 dias <ChevronRight className="size-4" aria-hidden /></span>
          <span className="flex flex-col gap-1.5">
            <span className="tnum text-[44px] font-semibold leading-none tracking-[-0.035em] text-[hsl(var(--warning))]">{fmtInt(d.vence.length)}</span>
            <span className="text-[13px] text-muted-foreground">entregas do planejamento</span>
          </span>
        </Bloco>

        <article className={cn(card, 'flex min-w-0 flex-col gap-4 px-6 py-5 sm:col-span-2')}>
          <p className={rotulo}>Por status do planejamento</p>
          <ul className="flex flex-col gap-1">
            {statusComDados.map((s) => (
              <li key={s.label}>
                <button type="button" onClick={() => abrirStatus(s.label)}
                  className="grid w-full grid-cols-[minmax(0,150px)_minmax(0,1fr)_36px] items-center gap-3 rounded-[10px] px-1.5 py-1 text-left text-[14px] transition-colors duration-150 hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="truncate text-foreground" title={s.label}>{s.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--surface-3))]">
                    <span className="block h-full rounded-full" style={{ width: `${(s.value / maxStatus) * 100}%`, background: s.color ?? corDe(s.label) }} />
                  </span>
                  <span className="tnum text-right font-semibold text-foreground">{fmtInt(s.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </article>

        <Bloco>
          <p className={rotulo}>Planejados · {rotuloPeriodo}</p>
          <span className="flex flex-col gap-1.5">
            <span className="tnum text-[44px] font-semibold leading-none tracking-[-0.035em] text-foreground">{fmtInt(planejados)}</span>
            <span className="text-[13px] text-muted-foreground">Instrumento Concluído ou Finalizado</span>
          </span>
        </Bloco>

        <Bloco onClick={d.semOrc.length ? () => lista('Sem orçamento', d.semOrc) : undefined} titulo="Ver os projetos sem orçamento">
          <span className={cn(rotulo, 'flex items-center justify-between')}>Saldo total {d.semOrc.length > 0 && <ChevronRight className="size-4" aria-hidden />}</span>
          <span className="flex flex-col gap-1.5">
            <span className={cn('tnum text-[32px] font-semibold leading-none tracking-[-0.03em]', d.saldo < 0 ? 'text-[hsl(var(--danger))]' : 'text-foreground')}>{fmtBRLCompact(d.saldo)}</span>
            <span className="text-[13px] text-muted-foreground">{d.semOrc.length ? `${fmtInt(d.semOrc.length)} sem orçamento` : 'todos com orçamento'}</span>
          </span>
        </Bloco>
      </div>

      <section aria-label="Próximos prazos" className={cn(card, 'flex flex-col py-2')}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-2 pt-3">
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">{atual.titulo}</h2>
          {atual.total > 0 && (
            <button type="button" onClick={() => lista(atual.titulo, atual.linhas.map((l) => l.p))}
              className="rounded-full px-2 py-1 text-[15px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Ver todos ({fmtInt(atual.total)})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 px-6 pb-3" role="group" aria-label="Filtro da lista">
          {chips.map((c) => (
            <button key={c.id} type="button" aria-pressed={filtro === c.id} onClick={() => setFiltro(c.id)}
              className={cn('inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9',
                filtro === c.id ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-[hsl(var(--surface-2))]')}>
              <span className={cn('size-2 rounded-full', c.dot)} aria-hidden />
              {c.label}
              <span className="tnum opacity-70">{fmtInt(c.n)}</span>
            </button>
          ))}
        </div>
        {visiveis.length === 0 ? (
          <p className="px-6 pb-5 pt-2 text-[15px] text-muted-foreground">Nenhum projeto com prazo em aberto nesse filtro.</p>
        ) : (
          <ul>
            {visiveis.map(({ p, plan }, i) => {
              const cor = plan.farol === 'atrasado' ? 'hsl(var(--danger))' : plan.farol === 'vence' ? 'hsl(var(--warning))' : 'hsl(var(--success))';
              const ultimo = i === visiveis.length - 1;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => lista(tituloDe(p), [p])}
                    className="flex min-h-16 w-full items-center gap-3.5 px-6 text-left transition-colors duration-150 hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor }} aria-hidden />
                    <span className={cn('flex min-w-0 flex-1 items-center gap-3 self-stretch py-3', !ultimo && 'border-b border-border')}>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-medium text-foreground">{tituloDe(p)}</span>
                        <span className="truncate text-[13px] text-muted-foreground">{[codigoDe(p), gerenteDe(p)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="tnum text-[15px] font-semibold text-foreground">{fmtDate(plan.prazo)}</span>
                        <span className="text-[13px]" style={{ color: cor }}>{plan.detalhe}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
