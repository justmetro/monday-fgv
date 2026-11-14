import { addMonths, differenceInCalendarDays, format } from 'date-fns';
import { calcBase, calcEquipe, resumoSim, type Ajuste, type AlocProjeto } from '@generated/lib/equipe';
import type { Simulacao } from '@generated/lib/extras';
import type { Fatores } from '@generated/lib/negocio';
import type { getProjetos, getDecisoes, getProdutos } from '@generated/server/projetos';
import type { DraftDecisao, Rascunho } from '@generated/components/painel/drawer/types';

export type Projeto = Awaited<ReturnType<typeof getProjetos>>['items'][number];
export type Decisao = Awaited<ReturnType<typeof getDecisoes>>['items'][number];
export type Produto = Awaited<ReturnType<typeof getProdutos>>['byProject'][string][number];

export const BOARD_A_ID = '18399249920';
export const BOARD_B_ID = '18398687489';
export const BOARD_EQUIPES_ID = '18437180615';

export const GRUPOS = ['Em execução', 'Em planejamento', 'Em encerramento', 'Outros status (verificar)'] as const;
export type Grupo = (typeof GRUPOS)[number];

export const STATUS_PROJETO = [
  'Em execução', 'Em planejamento', 'Em encerramento', 'Finalizado', 'Pagamento pendente', 'Iniciação',
  'Aguardando planejamento', 'Pausado', 'Plan: Aguardando Aprovação SGI',
];
export const ALOCACAO = ['Equipe alocada', 'Sem equipe', 'Verificar'];
export const ALERTA_DESALOCACAO = ['Em Operação', 'Iniciar desalocação', 'Parado', 'Finalizado'];
export const DECISOES = ['Manter equipe', 'Reduzir equipe', 'Desmobilizar', 'Em análise'];

// ── Datas ────────────────────────────────────────────────────────────────
export function parseIso(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
export function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
export function todayIso(): string {
  return toIso(new Date());
}
export function fmtDate(s: string | null | undefined): string {
  const d = parseIso(s);
  return d ? format(d, 'dd/MM/yyyy') : '—';
}
export function daysFromToday(s: string | null | undefined): number | null {
  const d = parseIso(s);
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
}
export function addMonthsIso(s: string | null, months: number | null): string | null {
  const d = parseIso(s);
  if (!d || months === null || months === undefined) return null;
  const whole = Math.floor(months);
  const extraDays = Math.round((months - whole) * 30.4375);
  const r = addMonths(d, whole);
  r.setDate(r.getDate() + extraDays);
  return toIso(r);
}

// ── Moeda / números ─────────────────────────────────────────────────────
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const n1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export const fmtBRL = (v: number | null | undefined) => (v === null || v === undefined ? '—' : brl0.format(v));
export const fmtBRL2 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : brl2.format(v));
export const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? '—' : n1.format(v));

// ── Regras de negócio ───────────────────────────────────────────────────
export type FonteTermino = 'Data de início/fim execução' | 'Início/fim execução previsto' | 'Início/fim contratual';

export function terminoPrevisto(p: Projeto): { date: string | null; fonte: FonteTermino | null } {
  if (p.execucao?.to) return { date: p.execucao.to, fonte: 'Data de início/fim execução' };
  if (p.execucaoPrevista?.to) return { date: p.execucaoPrevista.to, fonte: 'Início/fim execução previsto' };
  if (p.contratual?.to) return { date: p.contratual.to, fonte: 'Início/fim contratual' };
  return { date: null, fonte: null };
}

export type PrazoTom = 'vencido' | 'proximo' | 'ok' | 'sem';
export function prazoTom(dias: number | null): PrazoTom {
  if (dias === null) return 'sem';
  if (dias < 0) return 'vencido';
  if (dias <= 90) return 'proximo';
  return 'ok';
}

export function grupoDe(status: string | null): Grupo {
  if (status === 'Em execução' || status === 'Em planejamento' || status === 'Em encerramento') return status;
  return 'Outros status (verificar)';
}

export type SituacaoEquipe = 'nao_informada' | 'ok';
export const SITUACAO_EQUIPE_LABEL: Record<SituacaoEquipe, string> = {
  nao_informada: 'Não informada',
  ok: 'OK',
};

/** Dias de b até a (a − b). */
export function diasEntre(a: string | null, b: string | null): number | null {
  const da = parseIso(a);
  const db = parseIso(b);
  return da && db ? differenceInCalendarDays(da, db) : null;
}

/**
 * Data base do "Manter até": Data da decisão; se vazia, a data de atualização do item de decisão;
 * só sem nenhuma das duas, hoje.
 */
export function dataBaseDe(d: Pick<Decisao, 'dataDecisao' | 'updatedAt'> | null | undefined): string {
  if (d?.dataDecisao) return d.dataDecisao;
  if (d?.updatedAt) {
    const u = new Date(d.updatedAt);
    if (!Number.isNaN(u.getTime())) return toIso(u);
  }
  return todayIso();
}

/** "Manter até" = data base (ver dataBaseDe) + Meses de manutenção. */
export function calcManterAte(dataBase: string | null | undefined, meses: number | null | undefined): string | null {
  return addMonthsIso(dataBase || todayIso(), meses ?? null);
}

/** Menor entre duas datas 'AAAA-MM-DD' (ignora vazias). */
export function menorData(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export const DECISOES_REDUZEM = ['Reduzir equipe', 'Desmobilizar'];

/** Data usada no "Custo até o término": se a decisão reduz/desmobiliza, a menor entre término e "Manter até". */
export function dataCustoDe(termino: string | null, decisao: string | null, manterAte: string | null): { date: string | null; fonte: 'Último produto previsto' | 'Manter até' | null } {
  if (decisao && DECISOES_REDUZEM.includes(decisao) && manterAte && (!termino || manterAte < termino)) {
    return { date: manterAte, fonte: 'Manter até' };
  }
  return { date: termino, fonte: termino ? 'Último produto previsto' : null };
}

export function mesesAte(date: string | null): number | null {
  const dias = daysFromToday(date);
  return dias === null ? null : Math.max(0, dias / 30.4375);
}

// ── Edições de produto feitas no app (rascunho; nunca gravadas no monday) ──
export type CampoProduto = 'prazo' | 'atraso' | 'status' | 'valor';
export type ProdutoOverride = Partial<Pick<Produto, CampoProduto>>;
export type EdicaoProduto = ProdutoOverride & { produtoId: string; projectId: string; campos: string[]; user: string; at: string };
export type ProdutoView = Produto & {
  /** Campos com valor editado no app. */
  editados: CampoProduto[];
  /** Valores originais do monday. */
  orig: Pick<Produto, CampoProduto>;
  edicao: EdicaoProduto | null;
};

const CAMPOS_PRODUTO: CampoProduto[] = ['prazo', 'atraso', 'status', 'valor'];

export function aplicarEdicoes(list: Produto[] | undefined, edicoes: Record<string, EdicaoProduto>): ProdutoView[] | undefined {
  if (!list) return undefined;
  return list.map((x) => {
    const ed = edicoes[x.id] ?? null;
    const orig = { prazo: x.prazo, atraso: x.atraso, status: x.status, valor: x.valor };
    const editados = ed ? CAMPOS_PRODUTO.filter((k) => ed.campos.includes(k)) : [];
    const v: ProdutoView = { ...x, orig, editados, edicao: ed };
    for (const k of editados) Object.assign(v, { [k]: ed?.[k] ?? null });
    return v;
  });
}

/** Produto ativo = status ≠ "Concluído" (considera edições do app). */
export const STATUS_ENTREGUES = ['concluído', 'entrega final', 'entregue'];
/** Produto ativo = status ≠ "Concluído" e ≠ "Entregue" (vazio conta como ativo). */
/** Com Data de Entrega Real preenchida o produto está entregue (como a fórmula "Status Atraso Entrega"): não é ativo nem vencido. */
export const produtoAtivo = (x: Pick<Produto, 'status'> & { entregaReal?: string | null }) =>
  !x.entregaReal && !STATUS_ENTREGUES.includes((x.status ?? '').trim().toLocaleLowerCase('pt-BR'));
export const dataEntrega = (x: Produto) => x.prazo ?? x.previsto;

export function maiorEntregaAtiva(produtos: Produto[] | undefined): string | null {
  let max: string | null = null;
  for (const x of produtos ?? []) {
    if (!produtoAtivo(x)) continue;
    const dt = dataEntrega(x);
    if (dt && (!max || dt > max)) max = dt;
  }
  return max;
}

export type FonteUltimo = 'Produtos restantes' | FonteTermino;
/** "Último produto previsto" = maior entrega dos produtos ativos; sem produto ativo com data, usa as datas do projeto. */
export function ultimoProdutoPrevisto(p: Projeto, produtos: Produto[] | undefined): { date: string | null; fonte: FonteUltimo | null } {
  const max = maiorEntregaAtiva(produtos);
  if (max) return { date: max, fonte: 'Produtos restantes' };
  return terminoPrevisto(p);
}

/**
 * `aloc`: undefined = ainda carregando; null = projeto sem itens no quadro Equipes Revisadas.
 * Nº CLT e custo vêm do quadro de Alocação; o ajuste manual do app (se houver) sobrepõe.
 */
/** Perspectiva atual: o quadro Decisões do Vibe é a fonte; sem nada lá, vale o último registro do app. */
export function perspAtual(d: Decisao | undefined, ultApp: { tipo?: string | null; nivel?: string | null; temperatura?: string | null; report?: string } | undefined) {
  const q = d?.persp;
  if (q && (q.tipo || q.nivel || q.temperatura || q.report)) return { tipo: q.tipo, nivel: q.nivel, temperatura: q.temperatura, report: q.report ?? '' };
  return { tipo: ultApp?.tipo ?? null, nivel: ultApp?.nivel ?? null, temperatura: ultApp?.temperatura ?? null, report: ultApp?.report ?? '' };
}

/** Registro de decisão ainda não criado no quadro (id temporário). */
export function decisaoVazia(p: Pick<Projeto, 'id' | 'name'>): Decisao {
  return {
    id: `tmp-${p.id}`, name: p.name, projetoId: p.id, updatedAt: null, mesesManutencao: null, atualizacaoEquipe: null,
    decisao: null, nClt: null, nEstagio: null, perspectiva: null, dataEntrada: null, responsaveis: [],
    custoMensal: null, dataDecisao: null, detalhe: null, statusCat: null, baseIds: [], sim: {},
    persp: { tipo: null, nivel: null, temperatura: null, report: null },
  };
}

/** Decisão salva + rascunho do painel (aparece na hora na lista e nos cards). */
function comRascunho(d: Decisao | undefined, p: Projeto, rd: DraftDecisao | undefined): Decisao | undefined {
  if (!rd) return d;
  const base: Decisao = d ?? decisaoVazia(p);
  return { ...base, decisao: rd.decisao, mesesManutencao: rd.meses, detalhe: rd.detalhe.trim() ? rd.detalhe : null, responsaveis: rd.responsaveis };
}

/** `ov`: perspectiva salva no app (nível/temperatura) e rascunho em edição no painel. */
export type OverlayRow = { persp?: { nivel: string | null; temperatura: string | null }; rasc?: Rascunho };

export function buildRow(p: Projeto, dSalva: Decisao | undefined, produtos: ProdutoView[] | undefined, aloc?: AlocProjeto | null, ajuste?: Ajuste, fatores?: Fatores, ov?: OverlayRow) {
  const rasc = ov?.rasc;
  const d = comRascunho(dSalva, p, rasc?.d);
  const ativos = produtos?.filter(produtoAtivo);
  const termino = ultimoProdutoPrevisto(p, produtos);
  const dias = daysFromToday(termino.date);
  /** Data de finalização: Último produto previsto; se vazio, Última Entrega Prevista. */
  const dataFim = termino.date ?? p.ultimaEntrega;
  const decisao = d?.decisao ?? null;
  const manterAte = calcManterAte(dataBaseDe(d), d?.mesesManutencao);
  const refCusto = dataCustoDe(termino.date, decisao, manterAte);
  const mesesRestantes = mesesAte(refCusto.date);
  const equipe = aloc ? calcEquipe(aloc, termino.date, refCusto.date, fatores) : null;
  const ajCLT = ajuste?.campos.includes('nClt') ? ajuste.nClt ?? null : undefined;
  const ajCusto = ajuste?.campos.includes('custoMensal') ? ajuste.custoMensal ?? null : undefined;
  const clt = ajCLT !== undefined ? ajCLT ?? 0 : equipe?.nClt ?? 0;
  // Sem equipe cadastrada no quadro Equipes Revisadas: custo zero (com alerta na tela).
  const semAlocacao = aloc === null || (aloc ? !aloc.temAlocacao : false);
  const custoMensal = ajCusto !== undefined ? ajCusto : equipe ? equipe.custoMensal : semAlocacao ? 0 : null;
  const custoAteTermino = ajCusto !== undefined
    ? (ajCusto !== null && mesesRestantes !== null ? ajCusto * mesesRestantes : null)
    : equipe?.custoAteFim ?? null;
  const statusCat = rasc?.cat !== undefined ? rasc.cat : dSalva?.statusCat ?? null;
  const baseIds = rasc?.base ?? dSalva?.baseIds ?? [];
  const sim: Simulacao = rasc?.sim ?? dSalva?.sim ?? {};
  const base = calcBase(equipe?.atual ?? [], baseIds);
  const resumoSimulacao = resumoSim(equipe?.atual ?? [], sim);
  const saem = resumoSimulacao.Realocar.n + resumoSimulacao.Desligar.n;
  // Custo simulado = quem não será realocado nem desligado (Manter + sem definição).
  const custoSimulado = equipe && saem ? resumoSimulacao.Manter.custo + resumoSimulacao['Sem definição'].custo : null;
  const nivelSalvo = ov?.persp?.nivel ?? null;
  const tempSalva = ov?.persp?.temperatura ?? null;
  const ajustado = ajCLT !== undefined || ajCusto !== undefined;
  const situacao: SituacaoEquipe = aloc === undefined && !ajustado ? 'ok' : semAlocacao && !ajustado ? 'nao_informada' : 'ok';
  return {
    dataFim,
    diasFim: daysFromToday(dataFim),
    equipe,
    ajuste: ajuste ?? null,
    ajustado,
    semAlocacao,
    alocCarregando: aloc === undefined,
    /** Pessoas liberadas no último produto previsto (toda a equipe atual). */
    liberadasN: equipe ? equipe.liberadas.length : clt,
    projeto: p,
    decisao: d,
    produtos,
    grupo: grupoDe(p.status),
    termino,
    dias,
    tom: prazoTom(dias),
    clt,
    /** Equipe = somente CLT. */
    pessoas: clt,
    custoMensal,
    mesesRestantes,
    custoAteTermino,
    refCusto,
    pendentes: ativos ? ativos.length : null,
    atrasados: ativos ? ativos.filter((x) => x.atraso === 'Atrasado').length : null,
    /** Perspectiva de renovação/aditivo e temperatura (app; o rascunho do painel vale até salvar). */
    perspectiva: rasc?.p ? rasc.p.nivel : nivelSalvo,
    temperatura: rasc?.p ? rasc.p.temperatura : tempSalva,
    custoSimulado,
    /** Status de categorização (agrupa a aba Projetos). */
    statusCat,
    baseIds,
    /** Equipe base: pessoas marcadas, contagem por modalidade e custo mensal (null = não definida). */
    base,
    sim,
    resumoSim: resumoSimulacao,
    rascunho: {
      perspectiva: !!rasc?.p && rasc.p.nivel !== nivelSalvo,
      temperatura: !!rasc?.p && rasc.p.temperatura !== tempSalva,
      decisao: !!rasc?.d && rasc.d.decisao !== (dSalva?.decisao ?? null),
      meses: !!rasc?.d && rasc.d.meses !== (dSalva?.mesesManutencao ?? null),
      simulacao: rasc?.sim !== undefined,
      base: rasc?.base !== undefined,
      statusCat: rasc?.cat !== undefined,
    },
    decisaoLabel: decisao,
    meses: d?.mesesManutencao ?? null,
    semDecisao: !decisao || decisao === 'Em análise',
    situacaoEquipe: situacao,
    naoInformada: situacao === 'nao_informada',
    manterAte,
    /** Saída da equipe = menor entre término previsto e "Manter até". */
    dataSaida: menorData(termino.date, manterAte),
    /** Maior data de entrega entre os produtos ativos (Prazo de Entrega, ou Data Prevista se vazio). */
    fimProdutos: maiorEntregaAtiva(produtos),
  };
}
export type Row = ReturnType<typeof buildRow>;

export const MONDAY_ORIGIN = 'https://fgvdgpe-projetos.monday.com';

export function itemUrl(boardId: string, itemId: string) {
  return `${MONDAY_ORIGIN}/boards/${boardId}/pulses/${itemId}`;
}
