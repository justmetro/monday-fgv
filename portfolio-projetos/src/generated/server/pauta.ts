import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { executeAiRequest } from '@api/ai-service';
import { pautaContext, type PautaContext } from '@generated/lib/pauta-schema';


const checkIn = z.object({
  area: z.string(),
  label: z.string(),
  total: z.number(),
  cases: z.array(z.object({ name: z.string(), detail: z.string() })).max(15),
  count: z.number(),
});


const BASE_PROMPT = `Você é analista de monitoramento (PMO) da FGV DGPE e vai preparar a pauta de uma reunião mensal de 60 minutos, 1:1 entre o monitoramento e o gerente do projeto. Escreva em português do Brasil, com tom objetivo e profissional. A pauta deve ser CURTA e ESTRATÉGICA: não liste pendências de preenchimento nos quatro primeiros tópicos. Em vez disso, leia os dados do projeto, identifique os pontos críticos e transforme-os em perguntas diretas ao gerente do projeto, sempre citando itens concretos (nome do produto, da atividade, do risco ou do indicador, com datas e números fornecidos). Use as perguntas norteadoras de cada tema como lente, adaptando-as aos dados:
- Produtos: há produto com entrega vencida ou em risco? Qual o tipo de risco (margem curta ou negativa entre o cronograma e a entrega, atividades atrasadas, ritmo insuficiente, entrega sem cronograma)? Há dependência externa ou gargalo com corporativo/cliente? Alguma entrega impacta faturamento ou tem empenho pendente? Existe produto pronto para faturar com impedimento? Priorize os produtos do mês e os de risco Crítico/Alto e pergunte sobre as atividades pendentes que sustentam cada entrega.
- Indicadores de resultados: quais estão abaixo da meta, com medição atrasada ou sem atualização? Qual a tendência? Os resultados são coerentes com o que o cronograma e os produtos mostram? Há necessidade de rever a estratégia? Há problema de coleta ou indicador sem responsável?
- Cronograma: o cronograma está aderente à realidade? Há sobrecarga ou frente paralisada? Há atividade crítica sem responsável claro? O caminho crítico de algum produto está comprometido? Use as datas planejadas para julgar atraso e trate a coluna Saúde apenas como apoio.
- Riscos: algum risco se materializou ou aumentou de criticidade? Há risco sem plano de resposta ou com resposta pouco efetiva? Há riscos recorrentes? O responsável está atuando de forma preventiva? Algum risco precisa ser escalado ao cliente ou à alta gestão da DGPE?
Termine o tópico de Indicadores com a pergunta integradora: os resultados dos indicadores reforçam ou contradizem o que vimos no cronograma e nos produtos?
O quinto e último tópico, 'Inconsistências operacionais do quadro a resolver', resume as inconsistências do Checklist agrupadas por tema, com poucos exemplos e o prazo sugerido para correção; esse é o único lugar para falar de preenchimento de dados. Se um tema não tiver pontos críticos, diga isso em uma linha.
O projeto está na fase informada em 'fase' (planejamento, execução, encerramento ou não informada) e a pauta deve refletir o momento do ciclo de vida:
- Planejamento: foco em validar o planejamento. Pergunte sobre planejamento financeiro, alocação de equipe, validação da produção e aprovação do TAP. Não cobre execução nem resultados que ainda não existem.
- Execução: pauta padrão de monitoramento (produtos do mês e de risco, aderência do cronograma, riscos ativos, resultados dos indicadores).
- Encerramento: reunião mais curta e enxuta; foque nas últimas entregas, no faturamento e pagamento restantes, na consolidação dos resultados e no ciclo de avaliações e feedbacks com o cliente, incluindo possíveis renegociações ou renovações de contrato. Indique o tempo sugerido por tópico.
- Fase 'não informada': trate como execução e registre a ausência do status como inconsistência.
Se 'diasParaUltimaEntrega' for ≤ 30 e a fase for execução, mencione no tópico final que o projeto aparenta estar em encerramento e que o status deve ser conferido no Histórico de Projetos. Use apenas os dados fornecidos: não presuma informações financeiras, de equipe ou de TAP que não estejam nos dados; formule-as como perguntas ao gerente do projeto.
Use SOMENTE os dados fornecidos: não invente produtos, datas, números ou causas. Quando faltar dado para avaliar algo, diga isso em vez de supor. Os encaminhamentos propostos devem ser acionáveis, com responsável sugerido (gerente, monitoramento ou área interna) quando os dados permitirem.`;

const FASE_LABEL: Record<PautaContext['fase'], string> = { planejamento: 'Planejamento', 'execução': 'Execução', encerramento: 'Encerramento', 'não informada': 'Não informada' };

function topicTitles(fase: PautaContext['fase']) {
  const t = ['Produtos', 'Indicadores de resultados', 'Cronograma', 'Riscos'];
  if (fase === 'encerramento') t.push('Ciclo de encerramento');
  t.push('Inconsistências operacionais do quadro a resolver');
  return t;
}

/** Gera a pauta estratégica da reunião de monitoramento (dados do projeto + fase + inconsistências do Checklist). */
export const generatePauta = createServerFn({ method: 'POST' })
  .validator(z.object({ project: z.string().min(1).max(300), checks: z.array(checkIn).max(40), context: pautaContext }))
  .handler(async ({ data }) => {
    const c = data.context;
    const enc = c.fase === 'encerramento';
    const titles = topicTitles(c.fase);
    const pend = data.checks.filter((x) => x.count > 0);
    const incons = pend.map((x) => `- ${x.area} · ${x.label}: ${x.count} de ${x.total}. Ex.: ${x.cases.slice(0, 3).map((y) => `${y.name} (${y.detail})`).join('; ')}`).join('\n');
    const extras: string[] = [];
    if (c.fase === 'não informada') extras.push('Status do projeto não informado no Histórico de Projetos.');
    if ((c.fase === 'execução' || c.fase === 'não informada') && c.diasParaUltimaEntrega != null && c.diasParaUltimaEntrega <= 30) extras.push(`Projeto aparenta estar em encerramento (última entrega em ${c.diasParaUltimaEntrega} dia(s)); conferir o status no Histórico de Projetos.`);
    const vazio = (n: number, area: string) => (n === 0 ? `ATENÇÃO: não há dados de ${area} para este projeto — o tópico deve dizer isso em uma linha.\n` : '');

    const prompt = [
      `Projeto: ${data.project}`,
      `Fase: ${c.fase} (status original: ${c.statusOriginal ?? 'vazio'}) · diasParaUltimaEntrega: ${c.diasParaUltimaEntrega ?? 'sem dado'} · hoje: ${c.hoje}`,
      `Tópicos obrigatórios, nesta ordem exata: ${titles.map((t, i) => `${i + 1}. ${t}`).join(' | ')}.`,
      enc ? 'Encerramento: no máximo 2 a 3 perguntas por tópico; inclua no início de cada título o tempo sugerido (ex.: "Produtos (15 min)"): Produtos 15, Indicadores 10, Cronograma 5, Riscos 5, Ciclo de encerramento 15, Inconsistências e encaminhamentos 10. O tópico "Ciclo de encerramento" pergunta sobre avaliação e feedbacks com o cliente, lições aprendidas e documentação final, e renegociação/renovação de contrato.' : 'No máximo 4 perguntas por tópico (até 5 no último), de 1 a 2 linhas cada.',
      '',
      '### PRODUTOS', vazio(c.produtos.emAberto, 'produtos em aberto') + JSON.stringify(c.produtos),
      '### INDICADORES', vazio(c.indicadores.total, 'indicadores') + JSON.stringify(c.indicadores),
      '### CRONOGRAMA', vazio(c.cronograma.abertas + c.cronograma.porFrente.length, 'cronograma') + JSON.stringify(c.cronograma),
      '### RISCOS', vazio(c.riscos.total, 'riscos') + JSON.stringify(c.riscos),
      '### INCONSISTÊNCIAS DO CHECKLIST (somente para o último tópico)', incons || 'Nenhuma inconsistência.',
      extras.length ? `Pendências extras do último tópico (incluir em uma linha cada): ${extras.join(' ')}` : '',
    ].join('\n');

    const n = titles.length;
    const res = await executeAiRequest(prompt, {
      systemPrompt: BASE_PROMPT,
      schema: {
        type: 'object',
        properties: {
          objetivo: { type: 'string', description: 'Objetivo da reunião em 1-2 frases' },
          topicos: {
            type: 'array', minItems: n, maxItems: n,
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string', description: `Um destes, na ordem: ${titles.join('; ')}` },
                pontos: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5, description: 'Perguntas diretas ao gerente (máx. 4; até 5 no tópico de inconsistências; 2-3 em encerramento)' },
              },
              required: ['titulo', 'pontos'], additionalProperties: false,
            },
          },
          encaminhamentos: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6, description: 'Encaminhamentos propostos com responsável sugerido' },
        },
        required: ['objetivo', 'topicos', 'encaminhamentos'], additionalProperties: false,
      },
    });
    const d = res.data as { objetivo?: string; topicos?: { titulo: string; pontos: string[] }[]; encaminhamentos?: string[] } | null;
    const last = n - 1;
    const tops = (d?.topicos ?? []).slice(0, n).map((t, i) => ({ titulo: t.titulo || titles[i] || '', pontos: t.pontos.slice(0, i === last ? 5 : enc ? 3 : 4) }));
    const lines = [
      `Pauta — Reunião de Monitoramento`,
      `Projeto: ${data.project}`,
      `Fase do projeto: ${FASE_LABEL[c.fase]}${c.statusOriginal ? ` (${c.statusOriginal})` : ''}`,
      '',
      `Objetivo: ${d?.objetivo ?? ''}`,
      '',
      ...tops.flatMap((t, i) => [`${i + 1}. ${t.titulo}`, ...t.pontos.map((p) => `   - ${p}`), '']),
      'Encaminhamentos propostos:',
      ...(d?.encaminhamentos ?? []).slice(0, 6).map((e) => `- ${e}`),
    ];
    return { text: lines.join('\n') };
  });
