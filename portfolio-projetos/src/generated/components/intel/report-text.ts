import type { Report, Section } from '@generated/lib/intel';
import { evalOf } from '@generated/lib/intel-stats';

export const NOTES = {
  multi: 'Projetos podem estar associados a mais de um eixo. Por isso, os totais por eixo não são necessariamente somáveis.',
  inherit: 'A associação ao eixo é herdada do projeto e não representa uma classificação individual do indicador naquele eixo. O eixo usado é o atualmente salvo no cadastro do projeto.',
  causal: 'Diferenças entre eixos não são atribuídas ao eixo: podem refletir composição da carteira, metas, periodicidade, projetos compartilhados e qualidade da informação.',
};

export const METHOD = [
  'Cada medição recebe uma situação exclusiva: A excluída/cancelada/despriorizada; B concluída com meta alcançada; C concluída sem meta alcançada; D não concluída e atrasada; E pendente no prazo; F concluída sem classificação válida de meta; G outra situação não avaliável. Exclusões são aplicadas primeiro, com o mapeamento de status de cada projeto.',
  'Atrasada = prazo anterior à data de referência (America/Fortaleza), sem conclusão nem exclusão; recalculado na geração.',
  'Taxa principal (considerando atrasos) = B / (B + C + D). Taxa entre concluídas avaliadas = B / (B + C). Denominador zero = “Sem base avaliável”. Pendentes no prazo (E) não reduzem a taxa; F é lacuna.',
  'Média por projeto = média simples das taxas principais dos projetos com base avaliável (mesmo peso por projeto).',
  'Registros deduplicados por projectBoardId + itemId. Uma medição ligada a vários indicadores da mesma categoria conta uma vez nela; ligada a categorias diferentes aparece em cada uma, mas uma vez no total geral.',
  'Contagem de medições usa os registros efetivamente importados e vinculados, não o campo textual “Quantidade de Medições”. Medições sem vínculo resolvido aparecem como lacuna.',
  'Cada indicador tem uma única classificação principal (tema, subtema, família) compartilhada entre projetos e eixos; desempenho e eixo não são usados para classificar.',
  'Destaques exigem os mínimos configurados (medições avaliáveis e projetos; para indicadores, apenas medições), verificados com os dados de cada recorte. Não garantem significância estatística.',
  'Com período, uma família conta no recorte quando há indicador com medição no período — presença no recorte, não necessariamente ausência de cadastro fora dele. A situação corresponde aos dados conhecidos na geração; não há reconstrução histórica.',
  'Resultados consolidados originais aparecem apenas no apêndice; comparações numéricas entre indicadores exigem compatibilidade de unidade, fórmula, polaridade e consolidação.',
  NOTES.multi, NOTES.inherit, NOTES.causal,
];

const sum = (s: Section) => ({
  projetos: s.projects.length, semIndicadores: s.projectsNoInd.length, indicadores: s.indicators.length, medicoes: s.total.meds,
  avaliaveis: evalOf(s.total.counts), alcancadas: s.total.counts.B, naoAlcancadas: s.total.counts.C, atrasadas: s.total.counts.D,
  taxaComAtrasos: s.total.rate, taxaConcluidas: s.total.rateConcl,
  familiasMaisPresentes: s.familias.slice(0, 5).map((f) => ({ familia: f.name, projetos: f.projectIds.length, taxa: f.rate })),
  piores: s.rk.familias.worst.map((f) => ({ familia: f.name, B: f.counts.B, aval: evalOf(f.counts), atrasos: f.counts.D })),
  melhores: s.rk.familias.best.map((f) => ({ familia: f.name, B: f.counts.B, aval: evalOf(f.counts) })),
  achados: s.insights.slice(0, 8).map((i) => `${i.achado} ${i.evidencia}`),
});

/** Fatos estruturados (sem dados pessoais) enviados à IA para interpretação. */
export function factsOf(r: Report) {
  return JSON.stringify({
    recorte: r.overall.label, referencia: r.ref, geral: sum(r.overall),
    eixos: r.axes.map((a) => ({ eixo: a.label, ...sum(a.sec) })),
    comparacoes: r.comparisons.slice(0, 15), regras: [NOTES.multi, NOTES.causal],
  }).slice(0, 58000);
}
