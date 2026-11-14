import { ExternalLink } from 'lucide-react';
import type { ProductDoc, RiskDoc, ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';
import type { OpsModel } from '@generated/lib/ops';
import { fmtDate } from '@generated/lib/format';
import { fmtBRL } from '@generated/lib/money';
import { StatusPill, Truncate } from '../ui-bits';
import { Flags, type Col } from './DataTable';

export const schedFlags = (x: ScheduleItemDoc | ScheduleSubitemDoc) => [x.flagAtrasada && 'Atrasada', x.flagSemResponsavel && 'Sem responsável', x.flagSemCronograma && 'Sem cronograma'].filter((s): s is string => !!s);
export const prodFlags = (x: ProductDoc) => [x.flagEntregaAtrasada && 'Entrega atrasada', x.flagSemEntregaPlanejada && 'Sem entrega planejada', x.flagEntregueSemFaturamento && 'Entregue sem faturamento', x.flagPagamentoPendente && 'Pagamento pendente'].filter((s): s is string => !!s);
export const riskFlags = (x: RiskDoc) => [x.flagSemResponsavel && 'Sem responsável', x.flagAtualizacaoAntiga && 'Sem atualização recente', x.flagDivergencia && 'Status × fórmula divergente'].filter((s): s is string => !!s);

function projCol<T extends { projectBoardId: string }>(m: OpsModel): Col<T> {
  return { id: 'projeto', label: 'Projeto', value: (r) => m.projectBy.get(r.projectBoardId)?.name ?? null, render: (r) => <Truncate text={m.projectBy.get(r.projectBoardId)?.name ?? null} className="max-w-56" /> };
}
const prodNames = (m: OpsModel, r: { projectBoardId: string; produtoIds: string[]; produtoText: string | null }) => m.productsOf(r).map((p) => p.name).join(', ') || r.produtoText;

export function scheduleColumns(m: OpsModel): Col<ScheduleItemDoc>[] {
  return [
    { id: 'name', label: 'Atividade', value: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    projCol<ScheduleItemDoc>(m),
    { id: 'frentes', label: 'Frentes', field: 'frentes', value: (r) => r.frentes },
    { id: 'resp', label: 'Responsável', field: 'responsavel', value: (r) => r.responsaveis.join(', ') || null },
    { id: 'status', label: 'Status', field: 'status', value: (r) => r.status, render: (r) => <StatusPill label={r.status} tone={m.isDone(r) ? 'ok' : r.flagAtrasada ? 'bad' : 'neutral'} /> },
    { id: 'saude', label: 'Saúde', field: 'saude', value: (r) => r.saude, render: (r) => { const h = m.health(r); return <StatusPill label={r.saude} tone={h === 'none' ? 'neutral' : h} />; } },
    { id: 'produto', label: 'Produto', field: 'produto', value: (r) => prodNames(m, r), render: (r) => <Truncate text={prodNames(m, r)} className="max-w-48" /> },
    { id: 'ini', label: 'Início planejado', field: 'cronograma', mono: true, value: (r) => r.inicioPlanejado, render: (r) => fmtDate(r.inicioPlanejado) },
    { id: 'fim', label: 'Fim planejado', field: 'cronograma', mono: true, value: (r) => r.fimPlanejado, render: (r) => fmtDate(r.fimPlanejado) },
    { id: 'subs', label: 'Subatividades', mono: true, value: (r) => m.subsOf.get(`${r.projectBoardId}:${r.itemId}`)?.length ?? 0 },
    { id: 'flags', label: 'Sinalizações', value: (r) => schedFlags(r).join(', ') || null, render: (r) => <Flags list={schedFlags(r)} /> },
  ];
}

export function SubitemList({ m, rows }: { m: OpsModel; rows: ScheduleSubitemDoc[] }) {
  return (
    <ul className="divide-y divide-border/60 text-xs">
      {rows.map((s) => (
        <li key={s.itemId} className="grid gap-1 py-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1.5fr)] sm:items-center sm:gap-3">
          <span className="font-medium">↳ {s.name}</span>
          <span className="text-muted-foreground">{s.responsaveis.join(', ') || 'Sem responsável'}</span>
          <StatusPill label={s.status} tone={m.isDone(s) ? 'ok' : s.flagAtrasada ? 'bad' : 'neutral'} />
          <span className="font-mono">{fmtDate(s.inicioPlanejado)} – {fmtDate(s.fimPlanejado)}</span>
          <Flags list={schedFlags(s)} />
        </li>
      ))}
    </ul>
  );
}

export function productColumns(m: OpsModel): Col<ProductDoc>[] {
  return [
    { id: 'name', label: 'Produto', value: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    projCol<ProductDoc>(m),
    { id: 'status', label: 'Status Produto', field: 'status', value: (r) => r.status, render: (r) => <StatusPill label={r.status} tone={m.isDelivered(r) ? 'ok' : r.flagEntregaAtrasada ? 'bad' : 'neutral'} /> },
    { id: 'valor', label: 'Valor', field: 'valor', mono: true, value: (r) => r.valor, render: (r) => (r.valor != null ? fmtBRL(r.valor) : r.valorText ?? '—') },
    { id: 'entPlan', label: 'Entrega Planejada', field: 'entregaPlanejada', mono: true, value: (r) => r.entregaPlanejada, render: (r) => fmtDate(r.entregaPlanejada) },
    { id: 'entReal', label: 'Entrega Real', field: 'entregaReal', mono: true, value: (r) => r.entregaReal, render: (r) => fmtDate(r.entregaReal) },
    { id: 'comeco', label: 'Começo Real', field: 'comecoReal', mono: true, hidden: true, value: (r) => r.comecoReal, render: (r) => fmtDate(r.comecoReal) },
    { id: 'cpa', label: 'Envio à CPA', field: 'envioCpa', mono: true, hidden: true, value: (r) => r.envioCpa, render: (r) => fmtDate(r.envioCpa) },
    { id: 'fat', label: 'Faturamento estimado', field: 'faturamento', mono: true, value: (r) => r.faturamento ?? r.faturamentoText, render: (r) => (r.faturamento != null ? fmtBRL(r.faturamento) : r.faturamentoText ?? '—') },
    { id: 'pag', label: 'Pagamento estimado', field: 'pagamento', mono: true, value: (r) => r.pagamento ?? r.pagamentoText, render: (r) => (r.pagamento != null ? fmtBRL(r.pagamento) : r.pagamentoText ?? '—') },
    { id: 'stPag', label: 'Status Pagamento', field: 'statusPagamento', value: (r) => r.statusPagamento, render: (r) => <StatusPill label={r.statusPagamento} tone={m.isPaid(r) ? 'ok' : r.flagPagamentoPendente ? 'warn' : 'neutral'} /> },
    { id: 'link', label: 'Link', field: 'link', value: (r) => r.linkUrl ?? r.linkText, render: (r) => (r.linkUrl ? <a href={r.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" aria-hidden />Abrir</a> : <Truncate text={r.linkText} />) },
    { id: 'flags', label: 'Sinalizações', value: (r) => prodFlags(r).join(', ') || null, render: (r) => <Flags list={prodFlags(r)} /> },
  ];
}

export function riskColumns(m: OpsModel): Col<RiskDoc>[] {
  const lvlTone = (r: RiskDoc) => { const sc = m.scaleOf(r.projectBoardId, 'levels'); const i = m.rank(r.projectBoardId, 'levels', r.nivel); return i < 0 ? 'neutral' : i >= sc.length - 1 ? 'bad' : i >= sc.length / 2 ? 'warn' : 'ok'; };
  return [
    { id: 'name', label: 'Risco', value: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    projCol<RiskDoc>(m),
    { id: 'nivel', label: 'Nível', field: 'nivel', value: (r) => r.nivel, render: (r) => <StatusPill label={r.nivel} tone={lvlTone(r)} /> },
    { id: 'prob', label: 'Probabilidade', field: 'probabilidadeStatus', value: (r) => r.probabilidadeStatus },
    { id: 'imp', label: 'Impacto', field: 'impactoStatus', value: (r) => r.impactoStatus },
    { id: 'probF', label: 'Probabilidade (fórmula)', field: 'probabilidadeFormula', hidden: true, value: (r) => r.probabilidadeFormula },
    { id: 'impF', label: 'Impacto (fórmula)', field: 'impactoFormula', hidden: true, value: (r) => r.impactoFormula },
    { id: 'cat', label: 'Categoria', field: 'categoria', value: (r) => r.categoria },
    { id: 'tema', label: 'Tema', field: 'tema', value: (r) => r.tema },
    { id: 'periodo', label: 'Período', field: 'periodo', hidden: true, value: (r) => r.periodo },
    { id: 'impactado', label: 'Impactado', field: 'impactado', hidden: true, value: (r) => r.impactado },
    { id: 'causa', label: 'Causa', field: 'causa', hidden: true, value: (r) => r.causa, render: (r) => <Truncate text={r.causa} /> },
    { id: 'efeito', label: 'Efeito', field: 'efeito', hidden: true, value: (r) => r.efeito, render: (r) => <Truncate text={r.efeito} /> },
    { id: 'estr', label: 'Estratégia', field: 'estrategia', value: (r) => r.estrategia },
    { id: 'resp', label: 'Resposta ao risco', field: 'resposta', hidden: true, value: (r) => r.resposta, render: (r) => <Truncate text={r.resposta} /> },
    { id: 'mon', label: 'Responsável pelo monitoramento', field: 'responsavel', value: (r) => r.responsaveis.join(', ') || null },
    { id: 'upd', label: 'Última atualização', field: 'ultimaAtualizacao', mono: true, value: (r) => r.ultimaAtualizacao, render: (r) => fmtDate(r.ultimaAtualizacao) },
    { id: 'flags', label: 'Sinalizações', value: (r) => riskFlags(r).join(', ') || null, render: (r) => <Flags list={riskFlags(r)} /> },
  ];
}
