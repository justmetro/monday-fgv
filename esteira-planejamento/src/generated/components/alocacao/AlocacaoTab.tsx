import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, X, Search } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';
import { Switch } from '@components/ui/switch';
import { cn } from '@lib/utils';
import { useTabIndicator } from '@generated/components/fx/motion';
import type { Projeto } from '@generated/lib/format';
import { normNome } from '@generated/lib/nomes';
import { montarAlocacao, tipoDe, TIPO_LABEL, type Destino } from '@generated/lib/alocacao';
import { chegadaDe } from '@generated/lib/chegada';
import type { CarteiraGerente } from '@generated/components/GerenteAbas';
import { type PeriodoGlobal, noPeriodo } from '@generated/lib/periodo';
import { toDate, fmtDate } from '@generated/lib/format';
import { exportarGerentes, exportarProjetos } from '@generated/lib/csv';
import type { useMapaGerentes } from '@generated/hooks/useMapaGerentes';
import { useAlocacao } from '@generated/hooks/useAlocacao';
import { useRegraCapacidade } from '@generated/hooks/useRegraCapacidade';
import { Resumo } from '@generated/components/alocacao/Resumo';
import { btnNeutro } from '@generated/components/alocacao/cards';
import { useConfirmar } from '@generated/components/alocacao/confirmar';
import type { AlocCtx } from '@generated/components/alocacao/ctx';
import { SubProjecao } from '@generated/components/alocacao/SubProjecao';
import { SubDisponibilidade } from '@generated/components/alocacao/SubDisponibilidade';
import { SubDestinos } from '@generated/components/alocacao/SubDestinos';
import { SubValidacao } from '@generated/components/alocacao/SubValidacao';
import { SubGantt } from '@generated/components/alocacao/SubGantt';
import { SubHistorico } from '@generated/components/alocacao/SubHistorico';
import { SubRegistro } from '@generated/components/alocacao/SubRegistro';
import type { AlocAjuste } from '@generated/models';
import { montarCarga } from '@generated/lib/carga';
import { textoRevisado } from '@generated/components/alocacao/RevisadoR';
import { GerenteSheet } from '@generated/components/GerenteSheet';

export const SUBS = ['disponibilidade', 'projecao', 'destinos', 'gantt', 'validacao', 'historico', 'registro'] as const;
export type Sub = (typeof SUBS)[number];
const SUB_LABEL: Record<Sub, string> = {
  projecao: 'Esteira de Projetos', disponibilidade: 'Disponibilidade de gerentes', destinos: 'Projetos destino',
  validacao: 'Validação', gantt: 'Alocação por Gerente', historico: 'Histórico de projetos',
  registro: 'Registro de ações',
};

interface Props {
  base: Projeto[];
  mapaState: ReturnType<typeof useMapaGerentes>;
  sub: Sub;
  setSub: (s: Sub) => void;
  onItem: (p: Projeto) => void;
  eixoOpts: string[];
  ddGerenteOpts: string[];
  /** Fresh read of the 02.01 base (force, no server cache). */
  recarregarBase: () => void;
  /** Reports how many projects the tab works on (header counter). */
  onContagem?: (n: number | null) => void;
  /** Global period filter: project lists keep only Último Produto Previsto inside it (pending projections always stay). */
  periodo?: PeriodoGlobal | null;
}

function Toggle({ id, label, on, setOn, title }: { id: string; label: string; on: boolean; setOn: (v: boolean) => void; title?: string }) {
  return (
    <span title={title} className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border px-2.5 text-xs text-muted-foreground md:h-8">
      <label htmlFor={id} className="cursor-pointer whitespace-nowrap">{label}</label>
      <Switch id={id} checked={on} onCheckedChange={setOn} />
    </span>
  );
}

export function AlocacaoTab({ base, mapaState, sub, setSub, onItem, eixoOpts, ddGerenteOpts, recarregarBase, onContagem, periodo = null }: Props) {
  // Opening the tab always reads 02.01 fresh (allocations must never come from a stale cache).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recarregarBase(); }, []);
  const api = useAlocacao(true);
  const regraState = useRegraCapacidade();
  const { perguntar, dialogo } = useConfirmar();
  const subTabs = useTabIndicator(sub);
  const [busca, setBusca] = useState('');
  const [resumoAberto, setResumoAberto] = useState(true);
  const [somenteAtivos, setSomenteAtivos] = useState(true);
  const [mostrarDesativados, setMostrarDesativados] = useState(false);
  const [gerenteAberto, setGerenteAberto] = useState<string | null>(null);
  const [contSub, setContSub] = useState<{ sub: string; n: number } | null>(null);
  const reportarContagem = useCallback((s: string, n: number) => setContSub((c) => (c && c.sub === s && c.n === n ? c : { sub: s, n })), []);
  const { mapa } = mapaState;
  // Manager side panel: same data as "Capacidade por Gerente" (projects from the 02.01 "Gerente" column).
  const linhaGerente = useMemo(
    () => (gerenteAberto && mapa ? montarCarga(base, mapa.gerentes, [], true).todasLinhas.find((l) => l.g.id === gerenteAberto) ?? null : null),
    [gerenteAberto, mapa, base],
  );
  const modeloBruto = useMemo(
    () => (mapa && api.dados ? montarAlocacao(base, mapa.gerentes, api.dados, { somenteAtivos, mostrarDesativados }, regraState.regra) : null),
    [base, mapa, api.dados, somenteAtivos, mostrarDesativados, regraState.regra],
  );
  // Period filter only narrows the project lists; manager capacity and totals stay on the whole base.
  const modelo = useMemo(() => {
    if (!modeloBruto || !periodo) return modeloBruto;
    const ok = (d: Destino) => d.projecoes.length > 0 || noPeriodo(toDate(d.p.ltimoProdutoPrevisto), periodo);
    // Esteira de Projetos (new projects, no manager): never filtered by period — they have no Último Produto Previsto yet.
    return { ...modeloBruto, destinos: modeloBruto.destinos.filter((d) => ok(d) || (!d.comGerente && modeloBruto.semGerente.includes(d))) };
  }, [modeloBruto, periodo]);

  // Side panel tabs (Ativos / Encerrados / Projeções): same active rule as this tab + pending projections.
  const carteira = useMemo<CarteiraGerente | null>(() => {
    if (!gerenteAberto || !modelo) return null;
    const ga = [...modelo.gerentes, ...modelo.desativados].find((g) => g.g.id === gerenteAberto);
    if (!ga) return null;
    const porId = new Map(modelo.todos.map((d) => [d.p.id, d]));
    const projecoes = ga.projecoes.flatMap((x) => {
      const d = porId.get(x.data.projetoId);
      if (!d) return [];
      const c = chegadaDe(d);
      return [{
        id: x.id, p: d.p, tipo: TIPO_LABEL[tipoDe(x.data)], temp: d.temp.valor,
        inicio: c.inicio ? `chegada prevista ${fmtDate(c.inicio)}` : 'sem previsão de chegada',
        detalhe: `${c.rotuloOrigem}${c.fim ? ` · fim previsto ${fmtDate(c.fim)}` : ''}`,
      }];
    });
    const conv = (a: { p: Projeto; data: Date | null }) => ({ p: a.p, termino: a.data });
    return { ativos: ga.ativos.map(conv), encerrados: ga.encerrados.map(conv), projecoes };
  }, [gerenteAberto, modelo]);

  const revisadoGerente = useMemo(() => {
    if (!gerenteAberto || !modelo) return null;
    const r = [...modelo.gerentes, ...modelo.desativados].find((g) => g.g.id === gerenteAberto);
    if (!r) return null;
    const flags = { cap: !!r.cap.ajuste, eixos: !!r.eixos.ajuste };
    return flags.cap || flags.eixos ? textoRevisado(flags) : null;
  }, [gerenteAberto, modelo]);

  // Readable names/values for the action log ("Temperatura de X: A → B") + confirmation dialog for undo.
  const rotRef = api.rot;
  useEffect(() => {
    const proj = new Map(base.map((p) => [p.id, p.name]));
    const ger = new Map((mapa?.gerentes ?? []).map((g) => [g.id, g.nome]));
    const dest = new Map((modelo?.todos ?? []).map((d) => [d.p.id, d]));
    const gal = new Map((modelo?.gerentes ?? []).map((g) => [g.g.id, g]));
    const valor = (t: AlocAjuste['tipo'], id: string, k: 'valor' | 'calc') => {
      const d = dest.get(id);
      const g = gal.get(id);
      if (t === 'temperatura') return d?.temp[k] ?? '';
      if (t === 'complexidade') return d?.complex[k] ?? '';
      if (t === 'capacidade') return g?.cap[k] ?? '';
      if (t === 'eixos') return g?.eixos[k].join(', ') ?? '';
      return '';
    };
    rotRef.current = {
      nome: (id) => proj.get(id) ?? ger.get(id) ?? (id === 'novo' ? 'Novo gerente' : id),
      atual: (t, id) => valor(t, id, 'valor'),
      calc: (t, id) => valor(t, id, 'calc'),
      perguntar,
    };
  }, [base, mapa, modelo, perguntar, rotRef]);

  const nContagem = modelo ? (contSub && contSub.sub === sub ? contSub.n : modelo.destinos.length) : null;
  useEffect(() => { onContagem?.(nContagem); }, [nContagem, onContagem]);
  useEffect(() => () => onContagem?.(null), [onContagem]);

  const erro = mapaState.error ?? api.error;
  if (erro && !modelo) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-soft))] px-6 py-10 text-center">
        <AlertTriangle className="size-5 text-[hsl(var(--danger))]" aria-hidden />
        <p className="text-sm text-foreground">{erro}</p>
        <button type="button" onClick={() => { if (mapaState.error) mapaState.retry(); if (api.error) api.recarregar(); }} className={btnNeutro}>Tentar novamente</button>
      </div>
    );
  }
  if (!modelo || !api.dados || !mapa) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando alocação de gerentes">
        <Skeleton className=" h-10 w-full max-w-md bg-[hsl(var(--surface-2))]" />
        <Skeleton className=" h-44 w-full bg-[hsl(var(--surface-2))]" />
        <Skeleton className=" h-64 w-full bg-[hsl(var(--surface-2))]" />
      </div>
    );
  }

  const ctx: AlocCtx = {
    modelo, dados: api.dados, api, q: normNome(busca), eixoOpts, base, onItem, ddGerenteOpts, perguntar,
    mapa: mapa.gerentes, recarregarBase, regra: regraState.regra, abrirGerente: setGerenteAberto, reportarContagem,
  };
  const nPend = modelo.todos.filter((d) => d.projecoes.length > 0).length;
  const nDesativados = modelo.todos.filter((d) => d.desativado).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-60 sm:max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto, código, gerente, cliente ou UF…" aria-label="Buscar projeto, código, gerente, cliente ou UF"
            className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] pl-8 pr-8 text-base text-foreground placeholder:text-[hsl(var(--fg-subtle))] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 md:h-8 md:text-[13px]" />
          {busca && (
            <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')}
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Toggle id="aloc-somente-ativos" label="Somente ativos" on={somenteAtivos} setOn={setSomenteAtivos}
          title="Status Histórico de Projetos = Execução, Encerramento ou Em Planejamento (sem vínculo: Esteira e Status Planejamento ativo)" />
        <Toggle id="aloc-mostrar-desativados" label={`Mostrar projetos desativados (${nDesativados})`} on={mostrarDesativados} setOn={setMostrarDesativados} />
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={btnNeutro} onClick={() => exportarGerentes(modelo, ctx.dados)}>Exportar gerentes (CSV)</button>
          <button type="button" className={btnNeutro} onClick={() => exportarProjetos(modelo)}>Exportar projetos (CSV)</button>
        </div>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-border bg-card">
        <button type="button" onClick={() => setResumoAberto((v) => !v)} aria-expanded={resumoAberto}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <span className="text-sm font-semibold text-foreground">Resumo</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tnum">{modelo.gerentes.length} gerentes · {nPend} com projeção pendente</span>
            <ChevronDown className={cn('size-4 transition-transform duration-150', resumoAberto && 'rotate-180')} aria-hidden />
          </span>
        </button>
        {resumoAberto && <div className="border-t border-border px-4 py-4"><Resumo modelo={modelo} regra={regraState.regra} /></div>}
      </section>

      <nav ref={subTabs.navRef} aria-label="Sub-abas de alocação" className="relative flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full bg-[hsl(var(--surface-3))] p-1">
        <span ref={subTabs.indRef} className="fx-tab-ind" aria-hidden />
        {SUBS.map((s) => (
          <button key={s} type="button" aria-current={sub === s ? 'page' : undefined} onClick={() => setSub(s)}
            className={cn('relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150 md:h-8',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              sub === s ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {SUB_LABEL[s]}
            {s === 'validacao' && nPend > 0 && <span className="tnum rounded-[var(--radius-sm)] bg-[hsl(var(--surface-3))] px-1.5 text-[11px] text-foreground">{nPend}</span>}
          </button>
        ))}
      </nav>

      <div key={sub} className="fx-fade min-w-0">
      {sub === 'projecao' && <SubProjecao ctx={ctx} />}
      {sub === 'disponibilidade' && <SubDisponibilidade ctx={ctx} regraState={regraState} />}
      {sub === 'destinos' && <SubDestinos ctx={ctx} />}
      {sub === 'validacao' && <SubValidacao ctx={ctx} />}
      {sub === 'gantt' && <SubGantt ctx={ctx} />}
      {sub === 'historico' && <SubHistorico ctx={ctx} />}
      {sub === 'registro' && <SubRegistro ctx={ctx} />}
      </div>
      {dialogo}
      <GerenteSheet linha={linhaGerente} carteira={carteira} revisado={revisadoGerente} onClose={() => setGerenteAberto(null)} />
    </div>
  );
}
