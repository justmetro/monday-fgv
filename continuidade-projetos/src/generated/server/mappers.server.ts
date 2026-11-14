import { lerBase, lerSim } from '@generated/lib/extras';
import type {
  HistoricoDeProjetosBoardItem,
  LevantamentoDeProdutosBoardItem,
  DecisoesDoVibeBoardItem,
} from '@api/BoardSDK';

const pad = (n: number) => String(n).padStart(2, '0');

/** Converte Date (UTC meia-noite no monday) em 'AAAA-MM-DD' usando componentes UTC (sem deslocar fuso). */
export function toIsoDate(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 'AAAA-MM-DD' → Date em UTC meia-noite (formato da coluna date do SDK). null limpa; undefined = não enviar. */
export function isoToUtcDate(s: string | null | undefined): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === null || s === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`Data inválida: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Timeline → { from, to } em 'AAAA-MM-DD'. null limpa; undefined = não enviar. */
export function timelineWrite(v: { from: string; to: string } | null | undefined): { from: string; to: string } | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (!v.from && !v.to)) return null;
  const from = (v.from || v.to).slice(0, 10);
  const to = (v.to || v.from).slice(0, 10);
  return { from, to };
}

function tl(v: { from: string; to: string } | null | undefined) {
  if (!v || (!v.from && !v.to)) return null;
  return { from: v.from || null, to: v.to || null };
}

export function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x && 'label' in x ? String((x as { label: unknown }).label) : String(x))).join(', ') || null;
  const s = String(v).trim();
  return s && s !== 'null' ? s : null;
}

type ProjetoCols =
  | 'siglaDoProjeto' | 'cdigoDoProjeto' | 'statusDoProjeto' | 'alocaoDeEquipe' | 'gerenteAtual'
  | 'cliente' | 'eixoDeProjeto' | 'reaQueAcompanha' | 'centroDeCusto' | 'valorContrato'
  | 'inciofimContratual' | 'inciofimExecuoPrevisto' | 'dataDeInciofimExecuo' | 'incioRealDaOperao'
  | 'fimRealDaOperao' | 'ltimaEntregaPrevista' | 'ltimoFaturamentoPrevisto' | 'alertaDesalocao'
  | 'quadroDoProjeto' | 'faixaDeComplexidadeEspelho';

export function mapProjeto(it: HistoricoDeProjetosBoardItem<ProjetoCols>) {
  return {
    id: String(it.id),
    name: it.name ?? '',
    sigla: txt(it.siglaDoProjeto),
    codigo: txt(it.cdigoDoProjeto),
    status: txt(it.statusDoProjeto),
    alocacao: txt(it.alocaoDeEquipe),
    gerentes: it.gerenteAtual ?? [],
    clientes: it.cliente ?? [],
    eixo: txt(it.eixoDeProjeto),
    areas: it.reaQueAcompanha ?? [],
    centroCusto: txt(it.centroDeCusto),
    valorContrato: typeof it.valorContrato === 'number' ? it.valorContrato : null,
    contratual: tl(it.inciofimContratual),
    execucaoPrevista: tl(it.inciofimExecuoPrevisto),
    execucao: tl(it.dataDeInciofimExecuo),
    inicioReal: toIsoDate(it.incioRealDaOperao),
    fimReal: toIsoDate(it.fimRealDaOperao),
    ultimaEntrega: toIsoDate(it.ltimaEntregaPrevista),
    ultimoFaturamento: toIsoDate(it.ltimoFaturamentoPrevisto),
    alertaDesalocacao: txt(it.alertaDesalocao),
    quadroUrl: it.quadroDoProjeto?.url ?? null,
    faixaComplexidade: txt(it.faixaDeComplexidadeEspelho?.displayValue),
  };
}

type ProdutoCols =
  | 'projeto' | 'nomeDoProduto' | 'statusDoProduto' | 'prazoDeEntrega' | 'dataPrevistaDeEntrega'
  | 'statusAtrasoEntregaAgregado' | 'valorDoProduto' | 'tipo' | 'dataDeEntregaRealCorporativo' | 'statusAtrasoEntrega';

export function mapProduto(it: LevantamentoDeProdutosBoardItem<ProdutoCols>) {
  return {
    id: String(it.id),
    nome: txt(it.nomeDoProduto) ?? it.name ?? '',
    status: txt(it.statusDoProduto),
    prazo: toIsoDate(it.prazoDeEntrega),
    previsto: toIsoDate(it.dataPrevistaDeEntrega),
    atraso: txt(it.statusAtrasoEntregaAgregado),
    entregaReal: toIsoDate(it.dataDeEntregaRealCorporativo),
    situacao: txt(it.statusAtrasoEntrega),
    valor: typeof it.valorDoProduto === 'number' ? it.valorDoProduto : null,
    tipo: it.tipo ?? [],
  };
}

/** Colunas lidas do quadro Decisões do Vibe (use em todo withColumns de decisão). */
export const DECISAO_COLS = [
  'projeto', 'mesesDeManuteno', 'atualizaoDaEquipe', 'deciso', 'nClt', 'nEstgio',
  'perspectivaDeFinalizao', 'dataPrevistaDeEntradarenovao', 'responsvelPelaDeciso',
  'custoMensalEquipeR', 'dataDaDeciso', 'detalheDaDeciso',
  'tipoContratoNovoaditivo', 'perspectiva', 'temperaturaDaPerspectiva', 'comentrioDaPerspectiva',
  'statusDeCategorizao', 'equipeBase', 'simulaoPorPessoa',
] as const;
type DecisaoCols = (typeof DECISAO_COLS)[number];

function num(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function mapDecisao(it: DecisoesDoVibeBoardItem<DecisaoCols>) {
  return {
    id: String(it.id),
    name: it.name ?? '',
    projetoId: it.projeto?.linkedItems?.[0]?.id ? String(it.projeto.linkedItems[0].id) : null,
    updatedAt: it.updatedAt ? new Date(it.updatedAt).toISOString() : null,
    mesesManutencao: num(it.mesesDeManuteno),
    atualizacaoEquipe: toIsoDate(it.atualizaoDaEquipe),
    decisao: txt(it.deciso),
    nClt: num(it.nClt),
    nEstagio: num(it.nEstgio),
    perspectiva: txt(it.perspectivaDeFinalizao),
    dataEntrada: toIsoDate(it.dataPrevistaDeEntradarenovao),
    responsaveis: (it.responsvelPelaDeciso ?? [])
      .filter((p) => p.kind === 'person')
      .map((p) => ({ id: String(p.id), name: p.name ?? '' })),
    custoMensal: num(it.custoMensalEquipeR),
    dataDecisao: toIsoDate(it.dataDaDeciso),
    detalhe: txt(it.detalheDaDeciso),
    /** Status de categorização (texto livre; opções editáveis no app). */
    statusCat: txt(it.statusDeCategorizao),
    /** Ids (Equipes Revisadas) marcados como Equipe base. */
    baseIds: lerBase(it.equipeBase),
    /** Realocar/Desligar/Manter por pessoa. */
    sim: lerSim(it.simulaoPorPessoa),
    /** Perspectiva de renovação/aditivo gravada no quadro (fonte do valor atual). */
    persp: {
      tipo: txt(it.tipoContratoNovoaditivo), nivel: txt(it.perspectiva),
      temperatura: txt(it.temperaturaDaPerspectiva), report: txt(it.comentrioDaPerspectiva),
    },
  };
}
