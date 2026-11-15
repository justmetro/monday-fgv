import { type Projeto, codigoDe, fmtDate, tituloDe, today } from '@generated/lib/format';
import {
  type Destino, type ModeloAlocacao, type TipoProjecao, NOVO_GERENTE, TIPO_LABEL, contaNoTotal, rotuloDestino, tipoDe,
} from '@generated/lib/alocacao';
import { type Chegada, chegadaDe } from '@generated/lib/chegada';

export interface OutroAtivo { p: Projeto; termino: Date | null; sobrepoe: boolean }
export interface DestinoLinha { id: string; rotulo: string; tipoDestino: string; gerenteId: string | null; outros: OutroAtivo[] }
export interface LinhaValidacao {
  d: Destino;
  chegada: Chegada;
  tipos: TipoProjecao[];
  destinos: DestinoLinha[];
  /** Latest end date among the manager's projects that end after the arrival (overlap), or null. */
  sobreposicaoAte: Date | null;
}

/** One validation row: arrival (same rule as the Gantt) and, per manager, the OTHER active projects + overlap. */
export function linhaValidacao(modelo: ModeloAlocacao, d: Destino, hoje: Date = today()): LinhaValidacao {
  const chegada = chegadaDe(d, hoje);
  const porId = new Map([...modelo.gerentes, ...modelo.desativados].map((g) => [g.g.id, g]));
  const destinos = d.projecoes.map((x) => {
    const ga = x.data.destinoTipo === 'gerente' ? porId.get(x.data.gerenteId) : undefined;
    const outros = (ga?.ativos ?? []).filter((a) => a.p.id !== d.p.id).map((a) => ({
      p: a.p, termino: a.data,
      // Overlap: the other project ends after the new one arrives (no forecast = compared with today).
      sobrepoe: !!a.data && a.data.getTime() > (chegada.inicio ?? hoje).getTime(),
    }));
    return { id: x.id, rotulo: rotuloDestino(x.data), tipoDestino: x.data.destinoTipo, gerenteId: ga?.g.id ?? null, outros };
  });
  const fins = destinos.flatMap((g) => g.outros.filter((o) => o.sobrepoe && o.termino).map((o) => (o.termino as Date).getTime()));
  return {
    d, chegada, destinos,
    tipos: [...new Set(d.projecoes.map((x) => tipoDe(x.data)))],
    sobreposicaoAte: fins.length ? new Date(Math.max(...fins)) : null,
  };
}

const dd = (n: number) => String(n).padStart(2, '0');
/** Same year: dd/mm; other years: mm/aaaa. */
export function dataCurta(d: Date, hoje: Date = today()): string {
  return d.getFullYear() === hoje.getFullYear() ? `${dd(d.getDate())}/${dd(d.getMonth() + 1)}` : `${dd(d.getMonth() + 1)}/${d.getFullYear()}`;
}
const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const nomeProjeto = (p: Projeto) => `${codigoDe(p) ? `${codigoDe(p)} – ` : ''}${tituloDe(p)}`;

function frase(l: LinhaValidacao, hoje: Date): string {
  const { d, chegada } = l;
  const quando = chegada.inicio ? `chegada prevista ${dataCurta(chegada.inicio, hoje)}` : 'sem previsão de chegada';
  const tipos = l.tipos.map((t) => TIPO_LABEL[t].toLowerCase()).join('/');
  let s = `Projeto ${nomeProjeto(d.p)} (temp. ${d.temp.valor}, ${quando}) será assumido por ${juntar(l.destinos.map((g) => g.rotulo))} (${tipos}).`;
  for (const g of l.destinos) {
    if (g.tipoDestino === 'novo') { s += ` Será necessário contratar um ${NOVO_GERENTE.toLowerCase()}.`; continue; }
    if (g.tipoDestino !== 'gerente') continue;
    if (!g.outros.length) { s += ` ${g.rotulo} não tem outros projetos ativos.`; continue; }
    const lista = g.outros.map((o) => `${tituloDe(o.p)} (término ${o.termino ? dataCurta(o.termino, hoje) : 'sem data'})`);
    const sob = g.outros.filter((o) => o.sobrepoe && o.termino).map((o) => (o.termino as Date).getTime());
    s += ` ${g.rotulo} segue com ${plural(g.outros.length, 'projeto ativo', 'projetos ativos')}: ${juntar(lista)}`;
    s += sob.length ? `; haverá sobreposição até ${dataCurta(new Date(Math.max(...sob)), hoje)}.` : '; sem sobreposição.';
  }
  return s;
}

/** Deterministic text report of the chosen validation rows (same input → same text). */
export function gerarRelatorio(modelo: ModeloAlocacao, linhas: Destino[], hoje: Date = today()): string {
  const ls = linhas.map((d) => linhaValidacao(modelo, d, hoje));
  const conta = (t: TipoProjecao) => ls.filter((l) => l.tipos.includes(t)).length;
  const novoGer = ls.filter((l) => l.destinos.some((g) => g.tipoDestino === 'novo')).length;
  const semProjecao = modelo.semGerente.filter((d) => !d.comGerente && contaNoTotal(d) && d.projecoes.length === 0).length;
  const abertura = [
    `Relatório de alocação de gerentes — gerado em ${fmtDate(hoje)}.`,
    `Decisão sobre ${plural(ls.length, 'projeto', 'projetos')}: ${plural(conta('novo'), 'novo', 'novos')}, ${plural(conta('reforco'), 'reforço', 'reforços')} e ${plural(conta('troca'), 'troca', 'trocas')}.`,
    novoGer ? `${plural(novoGer, 'projeto vai', 'projetos vão')} para “${NOVO_GERENTE}” (contratação).` : `Nenhum projeto para “${NOVO_GERENTE}”.`,
    semProjecao ? `${plural(semProjecao, 'projeto novo segue', 'projetos novos seguem')} sem projeção.` : 'Todos os projetos novos têm projeção.',
  ].join(' ');
  return [abertura, '', ...ls.map((l, i) => `${i + 1}. ${frase(l, hoje)}`)].join('\n');
}
