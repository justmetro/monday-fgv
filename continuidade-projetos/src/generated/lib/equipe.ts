import type { AlocProjeto, PessoaAloc } from '@generated/server/alocacao';
import type { EquipeAjuste } from '@generated/models';
import { mesesAte } from '@generated/lib/painel';
import { FATORES_PADRAO, contagemVazia, fatorDe, type Fatores, type Modalidade } from '@generated/lib/negocio';
import { OPCOES_COM_SEM, opcaoDe, type OpcaoOuSem, type Simulacao } from '@generated/lib/extras';

export type { AlocProjeto, PessoaAloc };
export type Ajuste = EquipeAjuste;

/** Código "AAAA/NN" a "AAAA/NNNN" do projeto (campo Código; senão, início do nome). */
export function codigoProjeto(codigo: string | null, nome: string): string | null {
  const re = /^\s*(\d{4}\/\d{2,4})/;
  return re.exec(codigo ?? '')?.[1] ?? re.exec(nome)?.[1] ?? null;
}

export type Equipe = ReturnType<typeof calcEquipe>;

/**
 * Equipe CLT a partir do quadro Equipes Revisadas (cada item = 1 pessoa CLT atual).
 * `limite` = data usada no custo até o fim (último produto previsto, ou "Manter até" em reduções).
 * "Pessoas liberadas" = toda a equipe atual no último produto previsto.
 */
export type PessoaCusto = PessoaAloc & { /** Valor Base Plan. × fator da modalidade. */ custo: number | null; fator: number };

/**
 * Equipe de folha fixa (CLT, Bolsa, RPA fixo, Estágio). "Modalidade não informada" aparece na lista, mas fica fora dos totais.
 * Custo por pessoa = Valor Base Plan. × fator de encargos da modalidade.
 */
export function calcEquipe(a: AlocProjeto, ultimo: string | null, limite: string | null, fatores: Fatores = FATORES_PADRAO) {
  const todas: PessoaCusto[] = a.pessoas.map((x) => {
    const fator = fatorDe(x.modalidade, fatores);
    return { ...x, fator, custo: x.mensal === null ? null : x.mensal * fator };
  });
  const atual = todas.filter((x) => x.modalidade !== null);
  const semModalidade = todas.filter((x) => x.modalidade === null);
  const porModalidade = contagemVazia();
  for (const x of atual) if (x.modalidade) porModalidade[x.modalidade]++;
  const custoMensal = atual.reduce((s, x) => s + (x.custo ?? 0), 0);
  const meses = limite ? mesesAte(limite) : null;
  const custoAteFim = meses === null ? null : custoMensal * meses;
  const liberadas = ultimo ? atual : [];
  return { atual, todas, semModalidade, porModalidade, nClt: atual.length, custoMensal, custoAteFim, liberadas };
}

export const nomePessoa = (x: PessoaAloc) => x.nome ?? 'A identificar';

/** Projetos com status "Pausado" ficam fora do app inteiro. */
export const ehPausado = (status: string | null) => (status ?? '').trim().toLowerCase() === 'pausado';

/** Projetos que ficam no universo mesmo sem itens no quadro Equipes Revisadas (aparecem com o alerta "Sem equipe cadastrada"). */
const SEMPRE_NO_UNIVERSO = ['2026/059'];
export const sempreNoUniverso = (codigo: string | null) => !!codigo && SEMPRE_NO_UNIVERSO.includes(codigo);

type PessoaSim = Pick<PessoaCusto, 'id' | 'modalidade' | 'custo'>;
export type TotalMod = { n: number; custo: number };
export type TotalOpcao = TotalMod & { porModalidade: Record<Modalidade, TotalMod> };

const porModVazio = (): Record<Modalidade, TotalMod> => ({ CLT: { n: 0, custo: 0 }, Bolsa: { n: 0, custo: 0 }, 'RPA fixo': { n: 0, custo: 0 }, 'Estágio': { n: 0, custo: 0 } });

/** Equipe base: só as pessoas marcadas (entre as de modalidade informada). Custo null quando nenhuma marcada. */
export function calcBase(atual: PessoaSim[], ids: string[]) {
  const set = new Set(ids);
  const pessoas = atual.filter((x) => set.has(x.id));
  const porModalidade = contagemVazia();
  for (const x of pessoas) if (x.modalidade) porModalidade[x.modalidade]++;
  return { n: pessoas.length, porModalidade, custoMensal: pessoas.length ? pessoas.reduce((s, x) => s + (x.custo ?? 0), 0) : null };
}

/** Totais da simulação (Realocar/Desligar/Manter/Sem definição): pessoas e custo mensal, também por modalidade. */
export function resumoSim(atual: PessoaSim[], sim: Simulacao): Record<OpcaoOuSem, TotalOpcao> {
  const out = Object.fromEntries(OPCOES_COM_SEM.map((o) => [o, { n: 0, custo: 0, porModalidade: porModVazio() }])) as Record<OpcaoOuSem, TotalOpcao>;
  for (const x of atual) {
    const t = out[opcaoDe(sim, x.id)];
    t.n++; t.custo += x.custo ?? 0;
    if (x.modalidade) { t.porModalidade[x.modalidade].n++; t.porModalidade[x.modalidade].custo += x.custo ?? 0; }
  }
  return out;
}
