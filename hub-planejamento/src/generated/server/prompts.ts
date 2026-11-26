// Prompts e formatos de saída de cada etapa do Hub de Planejamento.
import { EIXOS, TIPOLOGIAS, TIPOS_RISCO, PARTES_INTERESSADAS, OKR, EAP, REGRAS_GERAIS } from './conhecimento';

export interface DocTexto { nome: string; tipo: string; texto: string }

import { ROTULOS } from '@generated/lib/rotulos';
export { ROTULOS };

const lista = (xs: readonly string[]) => xs.map((x) => `"${x}"`).join(', ');

export function blocoDocumentos(docs: DocTexto[]): string {
  return docs
    .map((d) => `===== DOCUMENTO: ${d.nome} (tipo: ${d.tipo}) =====\n${d.texto.trim()}\n===== FIM DE ${d.nome} =====`)
    .join('\n\n');
}

const PAPEL = `Você é analista da Coordenação de Planejamento de Projetos da FGV DGPE. A partir dos documentos de pactuação de UM projeto, você produz o pré-preenchimento dos instrumentos de planejamento, no padrão da DGPE, para gravar no quadro [PLAN] do projeto na monday. Quem revisa é o Ponto Focal de Planejamento. Siga exatamente os campos, os valores permitidos e os formatos pedidos.`;

const SAIDA = `Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois e sem blocos de código. Use exatamente as chaves pedidas. Textos em português.`;

export interface Prompt { system: string; user: string; maxTokens: number }

function base(extra: string): string {
  return [PAPEL, REGRAS_GERAIS, extra, SAIDA].join('\n\n');
}

export interface ContextoProjeto { nomeItem: string; codigo: string; eixo02?: string; valor02?: number | null; cliente02?: string; inicioExecucao?: string | null; diasVigencia?: number | null }

function cabecalho(p: ContextoProjeto) {
  return `PROJETO NO 02.01: ${p.nomeItem} (código ${p.codigo || 'não informado'}).${p.eixo02 ? ` Eixo cadastrado: ${p.eixo02}.` : ''}${p.valor02 ? ` Valor cadastrado: ${p.valor02}.` : ''}${p.inicioExecucao ? ` Início de execução considerado: ${p.inicioExecucao}.` : ''}${p.diasVigencia ? ` Vigência considerada: ${p.diasVigencia} dias.` : ''}`;
}

// 1. Ficha, TAP, características da calculadora e pendências
export function promptAnalise(p: ContextoProjeto, docs: DocTexto[]): Prompt {
  const formato = `FORMATO DA RESPOSTA:
{
 "ficha": {
  "codigo_nome": string, "cliente": string, "uf_abrangencia": string, "instrumento": string,
  "data_assinatura": string (dd/mm/aaaa ou "Não identificado nos documentos"),
  "vigencia": string (ex.: "180 dias a contar da assinatura"), "vigencia_dias": number|null (dias corridos),
  "prazo_execucao": string, "valor_global": number|null, "modalidade": um de [${lista(ROTULOS.modalidade)}],
  "eixo": um de [${lista(ROTULOS.eixo)}] (compare o objeto com o que cada eixo faz; não invente; não deixe vazio),
  "eixo_justificativa": string (uma frase),
  "tipologias": [string] (código e nome do Manual, ex.: "7C Normativo e Regulatório"),
  "documentos": [{"nome": string, "data": string}]
 },
 "tap": {
  "nome_projeto": string (exatamente o nome do projeto no 02.01),
  "data_inicio_contrato": string (data dd/mm/aaaa ou a regra, ex.: "A contar da assinatura do contrato (não assinado até a análise)"),
  "vigencia_contratual": string (ex.: "180 dias (6 meses), prorrogável nos termos do art. 111 da Lei 14.133/2021"),
  "valor_total": number|null,
  "natureza_cliente": um de [${lista(ROTULOS.natureza)}],
  "modalidade": um de [${lista(ROTULOS.modalidade)}],
  "experiencia_institucional": string (experiência anterior da FGV DGPE com este cliente ou objeto citada nos documentos; se não houver, "Não identificado nos documentos"),
  "justificativa": string (1 ou 2 parágrafos corridos: quem contratou e com que finalidade pública; problema ou contexto evidenciado; síntese do escopo. Sem tópicos),
  "resultado_principal": string (começa com "O resultado principal esperado é"),
  "como_chega": string (parágrafo curto: arranjo de ações, produtos e governança),
  "resultados_quantitativos": [string] (um por quantidade evidenciada, números exatamente como nos documentos),
  "total_produtos": number,
  "tipos_entrega": [string] (rótulos entre [${lista(ROTULOS.tipoEntrega)}]),
  "processo_entrega": [string] (linhas: quem recebe, recebimento provisório e definitivo com prazos, OS e NE, garantia, condições de pagamento, documentos para faturamento; cada linha termina com a fonte entre parênteses),
  "perfis_equipe": string (perfis de especialista ou coordenador indicados na proposta, sem nomes; ou "Não identificado nos documentos"),
  "fora_escopo": [string] (cada item começa com "Não contempla" e termina com a fonte entre parênteses; só limites explícitos ou claramente implícitos),
  "necessidades": [string] (requisitos e condicionantes críticos priorizados: qualidade, critérios de aceite, normas, premissas, dependências do cliente, indicadores de medição de resultado),
  "modelo_tap": "cnca" se for projeto do Compromisso Nacional Criança Alfabetizada; "ga" se o eixo for Gestão para a Aprendizagem; senão "padrao"
 },
 "calculadora": {
  "c1_fat": um de [${lista(ROTULOS.calc.c1_fat)}] (faturamento médio por ano: valor global dividido pela vigência em anos; 0 = Pró-bono),
  "c2_tipofat": um de [${lista(ROTULOS.calc.c2_tipofat)}],
  "c3_vig": um de [${lista(ROTULOS.calc.c3_vig)}],
  "c4_cli": um de [${lista(ROTULOS.calc.c4_cli)}],
  "c5_mod": um de [${lista(ROTULOS.calc.c5_mod)}],
  "c6_prod": um de [${lista(ROTULOS.calc.c6_prod)}] (pico de produtos entregues no mesmo mês),
  "c7_tipo": [um ou mais de ${lista(ROTULOS.calc.c7_tipo)}],
  "c8_equipe": um de [${lista(ROTULOS.calc.c8_equipe)}] (nunca null: se os documentos não trouxerem o tamanho da equipe, estime pelos perfis, horas, produtos e valor, e comece a justificativa com "Estimado:"),
  "c8_gr85": boolean (outros vínculos como RPA ou temporários superam os efetivos),
  "justificativas": {"c1_fat": string, "c2_tipofat": string, "c3_vig": string, "c4_cli": string, "c5_mod": string, "c6_prod": string, "c7_tipo": string, "c8_equipe": string} (uma linha com a fonte)
 },
 "pendencias": [{"instrumento": string, "pendencia": string, "fontes": string, "pergunta": string}] (tudo que ficou "Não identificado", toda divergência entre documentos e toda inconsistência)
}`;
  return {
    system: base([EIXOS, TIPOLOGIAS, formato].join('\n\n')),
    user: `${cabecalho(p)}\n\nLeia todos os documentos antes de responder. Se faltar o TR ou o contrato, registre nas pendências e siga com o que houver.\n\n${blocoDocumentos(docs)}`,
    maxTokens: 16000,
  };
}

// 2. Cronograma de Produtos (grupo Produtos)
export function promptProdutos(p: ContextoProjeto, docs: DocTexto[]): Prompt {
  const formato = `CRONOGRAMA DE PRODUTOS (grupo "Produtos" do quadro [PLAN]):
Uma linha por produto faturável ou entrega contratual. Produtos com parcelas ou entregas repetidas viram uma linha por parcela, com sufixo "(1/4)" ou "– Encontro 1/4". Se o TR ou o contrato numerar os produtos, use essa numeração (P01, P02...). Se não numerar, ordene cronologicamente pela entrega prevista. Inclua produtos sem valor próprio (plano de trabalho, relatório final) quando o TR ou a proposta os descreverem como etapa ou entrega. Todas as linhas sempre completas, nunca "mesmas condições do Pxx".

FORMATO DA RESPOSTA:
{
 "produtos": [{
  "codigo": string (ex.: "P01"),
  "nome": string (nome como aparece no TR/contrato, sem o código),
  "descricao": string (1 a 3 frases específicas e verificáveis: o que é, para quem, quantitativos, evidência de entrega exigida; sem valor próprio termina com "Sem valor próprio na composição de preço."),
  "objetivo": string (uma frase iniciada por verbo no infinitivo com a finalidade do produto),
  "mes_inicio": number (mês contratual de início, 1 = primeiro mês), "mes_fim": number (mês contratual da entrega),
  "dia_inicio": number|null, "dia_fim": number|null (quando o TR trouxer prazos em dias a partir do início, use-os; senão null),
  "valor": number (0 se não tiver valor próprio),
  "fase": "Fase 1" | "Fase 2" | "Fase 3" | "Fase 4" (fase ou etapa do TR à qual o produto pertence; se o TR não tiver fases, agrupe em ordem cronológica em até 4),
  "tipologia": string (código e modalidade do Manual, ex.: "6A Diagnóstico Operacional e Situacional"),
  "tipo_entrega": um de [${lista(ROTULOS.tipoEntrega)}],
  "fonte": string (documento e item)
 }],
 "checagem": {
  "soma_valores": number, "valor_global": number|null, "diferenca": number|null, "diferenca_pct": number|null,
  "fora_da_vigencia": [string], "max_produtos_mes": number, "media_produtos_mes": number,
  "observacoes": [string] (inconsistências; vazio se não houver)
 }
}`;
  return {
    system: base([TIPOLOGIAS, formato].join('\n\n')),
    user: `${cabecalho(p)}\n\n${blocoDocumentos(docs)}`,
    maxTokens: 16000,
  };
}

export interface ProdutoResumo { codigo: string; nome: string; descricao: string; dia_inicio?: number | null; dia_fim?: number | null; mes_inicio?: number; mes_fim?: number; valor?: number; ordem: number }

const fmtProdutos = (ps: ProdutoResumo[]) =>
  ps.map((x) => `${x.ordem}. ${x.codigo} - ${x.nome} | prazo: ${x.dia_inicio != null && x.dia_fim != null ? `dia ${x.dia_inicio} a ${x.dia_fim}` : `M${x.mes_inicio ?? '?'} a M${x.mes_fim ?? '?'}`} | ${x.descricao}`).join('\n');

// 3. EAP e cronograma (níveis 2 a 4) para um lote de produtos
export function promptEap(p: ContextoProjeto, docs: DocTexto[], lote: ProdutoResumo[], todos: ProdutoResumo[]): Prompt {
  const formato = `FORMATO DA RESPOSTA:
{
 "produtos": [{
  "codigo": string (igual ao da lista),
  "entregaveis": [{
   "nome": string (Nível 2, substantivo curto, ex.: "Diagnóstico institucional"),
   "dia_inicio": number, "dia_fim": number,
   "marcos": [{
    "nome": string (Nível 3, resultado verificável no particípio, ex.: "Diagnóstico validado pela SUFOTUR (até o dia 45)"),
    "dia_inicio": number, "dia_fim": number,
    "atividades": [{"nome": string (Nível 4, começa com verbo no infinitivo), "dia_inicio": number, "dia_fim": number, "frente": um de [${lista(ROTULOS.frentes)}]}]
   }]
  }]
 }]
}
Os dias contam a partir do início da execução (dia 1). Dia de fim nunca menor que o de início. Atividades dentro do intervalo do marco, marcos dentro do intervalo do entregável e entregáveis dentro do prazo do produto (com folga para o fluxo de aceite quando o documento previr).`;
  return {
    system: base([EAP, formato].join('\n\n')),
    user: `${cabecalho(p)}\n\nTODOS OS PRODUTOS DO PROJETO (para contexto de dependências):\n${fmtProdutos(todos)}\n\nGERE A EAP SÓ PARA ESTES PRODUTOS:\n${fmtProdutos(lote)}\n\n${blocoDocumentos(docs)}`,
    maxTokens: 20000,
  };
}

// 4. Riscos específicos
export function promptRiscos(p: ContextoProjeto, docs: DocTexto[], produtos: ProdutoResumo[]): Prompt {
  const formato = `MATRIZ DE RISCOS ESPECÍFICOS (grupo "Riscos" do quadro [PLAN]):
Gere de 10 a 20 riscos ESPECÍFICOS deste projeto, que só fazem sentido com estes documentos. Os riscos genéricos do Cardápio de Riscos são gerados à parte pela Calculadora de Riscos; não os repita. Cada causa cita um elemento concreto dos documentos: prazo, cláusula, volume, local, dependência do cliente, ator, cadeia de produtos ou condição de pagamento. Cubra só as categorias que os documentos sustentarem.
Tema segue a categoria: Operacional, Técnico e de Gerenciamento = "Gestão"; Conformidade Legal/Normativo, Tributário e Político = "Jurídico"; Institucional/Reputacional = "Imagem"; Financeiro = "Financeiro".

FORMATO DA RESPOSTA:
{
 "riscos": [{
  "id": string ("RISCO 01", "RISCO 02"...),
  "titulo": string (até 12 palavras, nomeia o risco),
  "categoria": um de [${lista(ROTULOS.categoria)}],
  "tema": "Gestão" | "Jurídico" | "Imagem" | "Financeiro",
  "impactado": ["Cliente"] | ["FGV DGPE"] | ["Cliente", "FGV DGPE"],
  "causa": string (o gerador, contextualizado),
  "efeito": string (impactos em cadeia, sem dramatizar; cite produtos e dependências, ex.: P01 -> P02),
  "probabilidade": um de [${lista(ROTULOS.probabilidade)}],
  "impacto": um de [${lista(ROTULOS.impacto)}],
  "estrategia": um de [${lista(ROTULOS.estrategia)}],
  "resposta": string (2 a 4 ações objetivas e verificáveis, com momento ou gatilho; não prometa recursos fora do contrato; evite "monitorar" sem ação concreta),
  "cargo_responsavel": string (cargo ou instância, nunca nome),
  "frente": um de [${lista(ROTULOS.frentes)}] (área de execução que responde pelo risco),
  "dia_inicio": number, "dia_fim": number (período em que o risco pode ocorrer, em dias desde o início da execução),
  "produtos": [string] (códigos ligados)
 }]
}`;
  return {
    system: base([TIPOS_RISCO, formato].join('\n\n')),
    user: `${cabecalho(p)}\n\nPRODUTOS:\n${fmtProdutos(produtos)}\n\n${blocoDocumentos(docs)}`,
    maxTokens: 16000,
  };
}

// 5. Partes interessadas (nível institucional)
export function promptPartes(p: ContextoProjeto, docs: DocTexto[], riscos: { id: string; titulo: string }[]): Prompt {
  const formato = `FORMATO DA RESPOSTA:
{
 "partes": [{
  "nome": string ("SIGLA – Nome da instituição ou área", ex.: "CEE/RJ – Conselho Estadual de Educação"),
  "cargo_cliente": string (cargo ou função de quem representa a parte, sem nomes),
  "area": string (posição no arranjo: "Órgão Contratante", "Área Requisitante", "Financiador", "Órgão de controle", "Público beneficiário direto", "Cadeia de fornecimento", "Contratada"...),
  "classe": "Contratante e decisão" | "Execução e validação técnica" | "Público beneficiário" | "Controle e conformidade" | "Parceiros e rede" | "Fornecedores críticos" | "FGV DGPE",
  "papel": [um ou mais de ${lista(ROTULOS.papel)}],
  "interesse": um de [${lista(ROTULOS.nivel)}],
  "poder": um de [${lista(ROTULOS.nivel)}],
  "expectativas": string (parágrafo corrido que começa pelo papel da parte no projeto e segue com o que ela espera; sem números, valores ou datas),
  "riscos_associados": string (IDs da lista de riscos ligados a essa parte, ex.: "RISCO 03; RISCO 05", seguidos de uma frase sobre como a atuação ou omissão dela pode afetar o projeto)
 }]
}
Antes de fechar, releia o TR e a proposta procurando toda instituição citada; cada uma entra ou é descartada por falta de influência real.`;
  return {
    system: base([PARTES_INTERESSADAS, formato].join('\n\n')),
    user: `${cabecalho(p)}\n\nRISCOS JÁ MAPEADOS:\n${riscos.map((r) => `${r.id} - ${r.titulo}`).join('\n') || '(nenhum)'}\n\n${blocoDocumentos(docs)}`,
    maxTokens: 10000,
  };
}

// 6. Painel de indicadores (OKRs)
export function promptIndicadores(p: ContextoProjeto, docs: DocTexto[], produtos: ProdutoResumo[], referencias = ''): Prompt {
  const formato = `FORMATO DA RESPOSTA:
{
 "objetivos": [{
  "objetivo": string (qualitativo; começa com "O projeto será bem-sucedido se"),
  "krs": [{
   "nome": string (nome curto do indicador, ex.: "Percentual de processos redesenhados validados"),
   "descricao": string ("Ao final, [resultado] comprovado por [critério], até [prazo]"),
   "formula": string (forma de cálculo),
   "meta": number, "unidade": um de [${lista(ROTULOS.unidade)}], "polaridade": um de [${lista(ROTULOS.polaridade)}],
   "temporalidade": um de [${lista(ROTULOS.temporalidade)}], "coleta": um de [${lista(ROTULOS.coleta)}],
   "medicoes": [number] (dias, desde o início da execução, em que cada medição acontece; coerente com a temporalidade e a vigência),
   "produtos": [string] (códigos),
   "referencia": string (indicador parecido da base de projetos anteriores que inspirou este, no formato "Projeto: nome do indicador"; vazio se não houver),
   "kpis": [{"nome": string, "descricao": string, "formula": string, "meta": number, "unidade": um de [${lista(ROTULOS.unidade)}], "polaridade": um de [${lista(ROTULOS.polaridade)}], "temporalidade": um de [${lista(ROTULOS.temporalidade)}], "coleta": um de [${lista(ROTULOS.coleta)}], "medicoes": [number], "produtos": [string]}]
  }]
 }]
}
Até 3 objetivos, até 5 KRs por objetivo e até 3 KPIs por KR, proporcional ao escopo. Indicadores de medição de resultado exigidos pelo TR ou contrato entram obrigatoriamente.
BASE DE PROJETOS ANTERIORES: a mensagem traz indicadores já usados em outros planejamentos da FGV DGPE, primeiro os do mesmo eixo. Use-os como referência de redação, forma de cálculo, unidade, temporalidade, coleta e ordem de grandeza de metas. Adapte ao escopo deste projeto: nunca copie nomes de clientes, públicos, quantidades ou datas de outros projetos.`;
  return {
    system: base([OKR, formato].join('\n\n')),
    user: `${cabecalho(p)}\n\nPRODUTOS:\n${fmtProdutos(produtos)}\n\n${referencias ? `INDICADORES DE PROJETOS ANTERIORES (referência):\n${referencias}\n\n` : ''}${blocoDocumentos(docs)}`,
    maxTokens: 12000,
  };
}

export interface RiscoQuadro { id: string; nome: string; causa: string; efeito: string; categoria: string; estrategia: string; resposta: string }

// 7. Complemento dos riscos gerados pela Calculadora (Período, Frente, Estratégia e Resposta)
export function promptComplemento(p: ContextoProjeto, produtos: ProdutoResumo[], riscos: RiscoQuadro[], resumoProjeto: string): Prompt {
  const formato = `Para cada risco abaixo (vindos do Cardápio de Riscos pela Calculadora), complete os campos para ESTE projeto. Não mude causa nem efeito. Use o resumo do projeto e os produtos para situar o período em que o risco pode ocorrer e a área responsável.

FORMATO DA RESPOSTA:
{
 "riscos": [{
  "id": string (o id recebido),
  "dia_inicio": number, "dia_fim": number (período do risco em dias desde o início da execução),
  "frente": um de [${lista(ROTULOS.frentes)}],
  "estrategia": um de [${lista(ROTULOS.estrategia)}],
  "resposta": string (2 a 4 ações objetivas e verificáveis para este projeto, com momento ou gatilho; se já houver resposta adequada, adapte ao projeto em vez de repetir)
 }]
}`;
  return {
    system: base([TIPOS_RISCO, formato].join('\n\n')),
    user: `${cabecalho(p)}\n\nRESUMO DO PROJETO:\n${resumoProjeto}\n\nPRODUTOS:\n${fmtProdutos(produtos)}\n\nRISCOS:\n${riscos.map((r) => JSON.stringify(r)).join('\n')}`,
    maxTokens: 14000,
  };
}
