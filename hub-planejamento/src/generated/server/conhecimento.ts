// Base de conhecimento da metodologia de planejamento da FGV DGPE usada nos prompts da IA.
// Fontes: Guia de Bolso da Metodologia de Planejamento (2026), prompt do agente "Análise de Planejamento Inicial",
// Eixos de Projeto, Manual de Tipologias de Entrega, Tipos de Riscos, Matriz de Partes Interessadas
// e Instrumento de Planejamento v.2026 (modelos de TAP).

export const EIXOS = `EIXOS DE PROJETO (use exatamente um destes nomes):
- Alfabetização: melhoria da aprendizagem nos anos iniciais do EF. Faz: formação de educadores, gestão e acompanhamento para a aprendizagem, materiais didáticos e pedagógicos, plataformas educacionais, avaliações, assessoria técnica na política. Projetos: Trilhos da Alfabetização, Compromisso Nacional Criança Alfabetizada (CNCA), Qualificação Direta em Primeira Infância.
- Educação de Jovens e Adultos: oportunidades educacionais para jovens, adultos e idosos. Faz: materiais didáticos, avaliações, formação de alfabetizadores, busca ativa, plataforma de acompanhamento, assessoria técnica. Projetos: Alfabetização de Jovens e Adultos, EJA associada à EPT, Brasil Alfabetizado.
- Educação Profissional e Tecnológica: fortalecer políticas de EPT. Faz: apoio à política estadual de EPT, metodologias de oferta de cursos, normativos, monitoramento, matrizes curriculares, formação de profissionais de EPT. Projetos: Pós-graduação Gestão em EPT, Política de Educação Profissional, LINC, Portfólio do Sistema S.
- Formação Continuada: desenvolvimento de educadores e profissionais para implementar políticas educacionais. Faz: desenho e normatização da política de formação, diagnóstico das redes, monitoramento, AVA, conteúdo de formação presencial ou online, materiais de apoio, impressão e distribuição. Projetos: formações para EF e EM, implementação do documento curricular, formação de gestores escolares.
- Gestão Estratégica: qualificar planejamento, coordenação, controle e acompanhamento de programas e projetos para desempenho organizacional e eficiência de políticas públicas. Faz: planejamento estratégico e orçamentário, ferramentas e sistemas de gestão, avaliação, desenho e normatização da estrutura organizacional, regime de colaboração, mapeamento de processos e escritório de projetos. Projetos: Planejamento Estratégico, Apoio ao Regime de Colaboração, Economicidade e otimização de recursos, Gestão estratégica de regionais, Escritório de Projetos e Processos, PAR, Educação Empreendedora.
- Gestão Pública: fortalecimento da gestão de entidades do setor público com assessoria técnica especializada. Faz: capacitação de gestores e técnicos, captação de recursos, documentos e relatórios técnicos, estudos de viabilidade, eventos técnicos com parceiros. Projetos: Rio Grande 2030, metodologia ESG, Governo Aberto, Índice de Inovação, Plano de Transição Ecológica, SIGED/BID.
- Gestão para a Aprendizagem: melhorar resultados educacionais e fluxo escolar com projetos integrados. Faz: avaliações de aprendizagem, materiais didáticos, acompanhamento pedagógico, formação articulada às avaliações, engajamento e mobilização. Projetos: Sistema Estruturado de Ensino, Gestão para a Aprendizagem.
- Pesquisas e Estudos: investigar e propor soluções para desafios das políticas educacionais (pesquisas e publicações).`;

export const TIPOLOGIAS = `MANUAL DE TIPOLOGIAS DE ENTREGA (código, modalidade, descrição curta):
1. Formação (percurso formativo reconhecível: objetivos, carga horária, metodologia e, se aplicável, avaliação e certificação; eventos só de articulação não contam)
 1A Formação Presencial: cursos, oficinas, workshops, seminários formativos, imersões, encontros presenciais; logística de local, alimentação e deslocamento.
 1B Formação Virtual Síncrona: aulas ao vivo, webinários, mentoria e tutoria online, encontros síncronos, bancas por videoconferência.
 1C Formação Virtual Assíncrona: cursos autoinstrucionais em AVA, trilhas com módulos, atividades avaliativas em plataforma, fóruns com tutoria.
 1D Formação Híbrida: combina presencial, síncrono e assíncrono num percurso único.
 1E Programas Especiais: pós-graduação lato sensu, certificação profissional, residência técnica, comunidades de prática.
 1F Capacitação Técnica Embutida: treinamento curto para a equipe do contratante operar o que foi entregue (ferramentas, processos, rotinas de monitoramento).
2. Material Pedagógico (orienta como ensinar ou formar; destinatário é o educador)
 2A Digital: guias metodológicos, matrizes curriculares e de competências, sequências didáticas, planos de curso e de aula.
 2B Físico: os mesmos materiais impressos em tiragem, com diagramação, impressão e distribuição.
3. Material Didático (carrega o conteúdo a ser aprendido)
 3A Digital: cadernos de conteúdo e de atividades, textos de referência, bancos de questões.
 3B Físico: os mesmos impressos em tiragem.
4. Recursos Educacionais Digitais
 4A Conteúdos audiovisuais (videoaulas, podcasts, animações). 4B Objetos e recursos interativos (OEDs, simulações, quizzes). 4C Ambientes virtuais de aprendizagem configurados com conteúdo.
5. Avaliação
 5A Avaliação de aprendizagem (diagnósticas, formativas, somativas, rubricas, bancos de itens, relatórios de desempenho). 5B Avaliação institucional e de programas (índices de maturidade, avaliação de programas). 5C Avaliação causal e de impacto. 5D Avaliação de desempenho operacional (métricas de uso e adoção).
6. Diagnóstico e Estudos
 6A Diagnóstico operacional e situacional (diagnóstico de rede ou organizacional, mapeamento de processos e fluxos, inventários, escutas e entrevistas, mapeamento de atores). 6B Estudos técnicos e modelagens (estudos de viabilidade, bases unificadas, modelagem financeira, cenários). 6C Pesquisas acadêmicas e publicações.
7. Assessoramento Estratégico
 7A Planejamento, estratégia e estruturação organizacional (planejamento estratégico, planos de ação, modelos de governança e estrutura, redesenho de processos, manuais operacionais, matrizes de indicadores). 7B Ferramentas, dashboards e painéis de gestão (painéis de indicadores, planilhas de controle, templates). 7C Normativo e regulatório (minutas de leis, decretos, portarias, regimentos e normativos internos, notas técnicas jurídicas).
8. Solução Tecnológica
 8A Plataformas e sistemas (desenvolvimento ou integração de software). 8B Modelos algorítmicos e de IA.`;

export const TIPOS_RISCO = `CATEGORIAS DE RISCO (Categoria -> Tema):
- Risco Operacional (Gestão): dificuldades na operação das atividades: mobilização de participantes, logística de eventos presenciais, articulação com muitos municípios ou escolas, infraestrutura, sobreposição de agendas.
- Risco Técnico (Gestão): complexidade metodológica, aderência a diretrizes, qualidade dos materiais, adequação ao contexto, integração entre frentes.
- Risco de Gerenciamento (Gestão): falhas de governança, comunicação insuficiente com o cliente, papéis indefinidos, ausência de instâncias decisórias, atrasos de validação.
- Risco de Conformidade Legal/Normativo (Jurídico): aderência a normas da administração pública e da política ou programa vinculado; questionamento de órgãos de controle; ajustes contratuais.
- Risco Tributário (Jurídico): mudanças ou interpretações tributárias que afetem notas, retenções, enquadramento fiscal.
- Risco Político (Jurídico): mudanças de governo, de liderança das secretarias ou de prioridades.
- Risco Institucional/Reputacional (Imagem): percepção pública ou institucional sobre qualidade, efetividade ou conformidade.
- Risco Financeiro (Financeiro): atrasos de pagamento, contingenciamento, restrições fiscais, descompasso entre cronograma físico e financeiro.
Probabilidade depende do controle da equipe sobre a causa (menos controle, mais probabilidade). Impacto reflete o pior efeito plausível (prazo, custo, desgaste, contrato).
Estratégias: Prevenir, Mitigar, Transferir, Escalar, Aceitar.
Redação: "Se [causa], então pode ocorrer [risco], gerando [efeito]". Sem riscos genéricos: cada causa cita um elemento concreto do projeto.`;

export const PARTES_INTERESSADAS = `MATRIZ DE PARTES INTERESSADAS (metodologia FGV DGPE):
Identifica grupos ou instituições com poder de impactar o projeto (decidir, validar, aprovar, mobilizar, executar, avaliar ou influenciar). No planejamento o mapeamento é institucional: órgãos, secretarias, áreas, conselhos, financiadores, redes, públicos e fornecedores críticos. Não liste pessoas físicas. Não infle a matriz com quem não interfere de fato (cargo não é influência). Normalmente de 5 a 12 partes.
Etapas: identificar; papel; interesse; poder/influência; estratégia pelo cruzamento; expectativas; riscos da relação (atrasos em decisões ou validações, baixa adesão, mobilização, mudança de direcionamento, retrabalho, comunicação, percepção de resultados).
Estratégia (fórmula da monday): Poder Alto + Interesse Alto = Gerenciar de perto; Poder Alto + Interesse Médio ou Baixo = Engajar institucionalmente; Poder Médio ou Baixo + Interesse Alto = Consultar frequentemente; demais = Manter informado.`;

export const OKR = `PAINEL DE INDICADORES (OKRs) da FGV DGPE:
- Objetivo (O): qualitativo e aspiracional, a principal mudança que o projeto quer gerar. Racional: "O projeto será bem-sucedido se...". Ideal: até 3 por projeto, conforme o tamanho do escopo.
- Resultado-chave (KR): quantitativo, SMART, sem subjetividade; mede "o que mudou". Racional: "Ao final, [resultado] comprovado por [critério], até [prazo]". Ideal: até 5 por objetivo.
- KPI de processo: acompanha a execução operacional (prazo, cobertura, aderência ao padrão); mede "executamos como planejado?". Ideal: até 3 por KR.
- Relacione KRs e KPIs aos produtos do cronograma. Confronte com o TR e o contrato (indicadores de medição de resultado exigidos pelo cliente entram obrigatoriamente).`;

export const EAP = `EAP E CRONOGRAMA DA FGV DGPE (grupo Cronograma do quadro [PLAN]):
- Nível 1 = Produto (já existe no grupo Produtos; não repetir).
- Nível 2 = Entregável: o que precisa existir para o produto estar concluído. 2 a 4 por produto.
- Nível 3 = Marco: resultado intermediário e verificável que leva o entregável à conclusão; traz quantitativos e condicionantes do contrato quando existirem (ex.: "Recebimento provisório (5 dias) e definitivo (10 dias)"). 2 a 4 por entregável. Inclua como marco o fluxo de aceite e faturamento de cada produto faturável.
- Nível 4 = Atividade do cronograma de execução: o que fazer para atingir o marco. 2 a 4 por marco. A redação é importantíssima: SEMPRE começa com verbo no infinitivo (Elaborar, Realizar, Validar, Consolidar, Enviar, Mapear...), é específica e verificável, sem gerúndio e sem substantivo no início.
- Padrões usuais (adapte, não copie se não couber): eventos e formações = Preparação Pedagógica e Logística, Execução, Avaliação, Relatório e Aceite; documentos, estudos e diagnósticos = Levantamento/Mapeamento, Elaboração/Produção, Validação e Entrega; plano de trabalho ou início = Mobilização e Governança, Planejamento Operacional, Plano de Trabalho.
- Prazos em dias corridos contados a partir do início da execução (dia 1). Respeite as fases e marcos do TR e as datas de entrega dos produtos; nenhuma atividade passa do fim da vigência.`;

export const REGRAS_GERAIS = `REGRAS INVIOLÁVEIS
- Fonte dos dados: todo dado do projeto (nomes, números, datas, valores, públicos, locais) vem SÓ dos documentos do projeto enviados. A metodologia serve para método, vocabulário e taxonomias. Nunca invente.
- Hierarquia documental: TR assinado > Contrato/Termo de Colaboração > Proposta > Minuta de escopo > ETP e demais anexos. Exceção: se o contrato ou a proposta disser expressamente que a proposta prevalece, siga e cite o item e o trecho.
- Divergências: use o documento de maior hierarquia e registre a divergência nas pendências, com a fonte de cada versão.
- Lacunas: quando a informação não existir, escreva "Não identificado nos documentos" e registre nas pendências.
- Rastreabilidade: indique a fonte (documento + item, cláusula, página ou anexo) quando pedido. Copie o número do item como aparece; sem certeza, cite a seção pelo título.
- Linguagem: português, institucional, direta, simples, sem jargão jurídico, sem citações longas. Qualquer pessoa da DGPE deve entender o projeto lendo só o seu texto. Não use travessão como conector de frases.
- Sem nomes de pessoas físicas: use cargo ou instância (ex.: "Superintendente", "Gestor do contrato"). Signatários da proposta (diretoria da FGV DGPE) não são equipe gestora.
- Prazos: transcreva como estão ("10 dias", sem acrescentar "úteis" ou "corridos").
- Valores: número com ponto decimal, sem "R$" e sem separador de milhar (ex.: 551526.22).`;

// Responsabilidades fixas do TAP por tipo de projeto (Instrumento de Planejamento v.2026: FP.02 TAP, TAP (CNCA), TAP (GA)).
export const RESP_SUPERINTENDENCIA = [
  'Orientar as decisões estratégicas e custos do projeto, garantindo alinhamento ao escopo e às diretrizes institucionais.',
  'Validar ajustes relevantes de planejamento, escopo, metodologia, orçamentário ou composição da equipe.',
  'Acompanhar a qualidade técnica das entregas e apoiar a interlocução com o cliente em temas estratégicos.',
  'Assegurar que os ritos de planejamento, gestão e monitoramento sejam cumpridos.',
];

export const RESP_CDPE = [
  'Garantir o alinhamento estratégico das frentes de trabalho pedagógicas e técnicas do projeto, assegurando aderência às diretrizes institucionais, ao escopo contratado e às orientações metodológicas da FGV DGPE.',
  'Elaborar e monitorar o planejamento financeiro do projeto, assegurando a execução orçamentária.',
  'Acompanhar e validar os produtos do projeto, assegurando a qualidade técnica e pedagógica e a organização da documentação das entregas.',
  'Articular os atores pedagógicos, assegurando alinhamento técnico e metodológico às diretrizes do projeto e coerência das ações.',
];

export const RESP_SAE = [
  'Orientar as decisões estratégicas e custos do projeto, garantindo a aplicação da metodologia de Gestão para Aprendizagem da FGV DGPE.',
  'Disponibilizar recursos padronizados para a implementação da metodologia.',
  'Disponibilizar especialistas, formadores e demais profissionais para garantir a implementação adequada da metodologia de Gestão para Aprendizagem da FGV DGPE.',
  'Realizar integração entre os projetos de Gestão para Aprendizagem para compartilhamento de boas práticas.',
  'Atuar como mediador do processo de alocação de equipe e novas negociações de modo a garantir a aplicação da metodologia de Gestão para Aprendizagem da FGV DGPE.',
  'Assegurar que os ritos de Gestão para Aprendizagem sejam cumpridos.',
  'Estruturar os processos basilares dos eixos da Gestão para Aprendizagem (Fluxo, Assessoria Educacional, RPP, entre outros).',
  'Monitorar os indicadores de Gestão para Aprendizagem e atuar na correção de rota, se necessário.',
  'Formar em serviço a equipe de projetos de Gestão para Aprendizagem.',
];

export const RESP_EQUIPE_PADRAO = [
  'Garantir o alinhamento estratégico das partes envolvidas no projeto, conduzindo a execução conforme o escopo contratado e as orientações institucionais.',
  'Planejar, organizar e acompanhar as atividades do projeto, assegurando a integração entre aspectos pedagógicos, operacionais e logísticos.',
  'Distribuir e coordenar as tarefas entre os membros da equipe, garantindo clareza de responsabilidades e cumprimento dos prazos.',
  'Realizar a interlocução com o cliente, registrando demandas, encaminhamentos e ajustes necessários ao andamento do projeto.',
  'Monitorar cronograma, escopo, custos e riscos, sinalizando desvios e propondo soluções quando necessário.',
  'Validar internamente entregas parciais e finais, garantindo qualidade técnica antes de encaminhar para validação institucional ou envio ao cliente.',
  'Produzir e atualizar relatórios, documentos e registros, mantendo a organização e a rastreabilidade das informações do projeto.',
  'Acompanhar o desempenho das ações previstas, analisando resultados, indicadores e evidências de execução.',
  'Articular especialistas, formadores e demais envolvidos, assegurando alinhamento técnico e coerência das ações.',
  'Promover a comunicação contínua dentro da equipe, garantindo que todos estejam informados sobre prioridades, pendências e decisões.',
  'Apoiar discussões e ajustes operacionais com o cliente, sempre alinhados à coordenação interna da FGV DGPE.',
];

export const RESP_EQUIPE_CNCA = [
  'Assegurar o alinhamento do projeto com a equipe executora e com o cliente/parceiro, conduzindo a comunicação institucional, o engajamento das partes envolvidas e a tradução das diretrizes estratégicas em ações operacionais.',
  'Planejar, organizar e acompanhar as atividades do projeto, assegurando a integração entre aspectos pedagógicos, operacionais e logísticos.',
  'Distribuir e coordenar as tarefas entre os membros da equipe, garantindo clareza de responsabilidades e cumprimento dos prazos.',
  'Realizar a interlocução com o cliente, registrando demandas, encaminhamentos e ajustes necessários ao andamento do projeto.',
  'Monitorar o cronograma, o escopo e os riscos do projeto em articulação com a CDPE, sinalizando desvios, impactos e necessidades de replanejamento.',
  'Validar internamente entregas parciais e finais, garantindo qualidade técnica antes de encaminhar para validação institucional ou envio ao cliente.',
  'Acompanhar o desempenho das ações previstas, analisando resultados, indicadores e evidências de execução.',
  'Promover a comunicação contínua dentro da equipe, garantindo que todos estejam informados sobre prioridades, pendências e decisões.',
  'Apoiar discussões e ajustes operacionais com o cliente, sempre alinhados à coordenação interna da FGV DGPE.',
];

export type ModeloTap = 'padrao' | 'cnca' | 'ga';

export function responsabilidades(modelo: ModeloTap) {
  return {
    superintendencia: RESP_SUPERINTENDENCIA,
    cdpe: modelo === 'cnca' ? RESP_CDPE : null,
    sae: modelo === 'ga' ? RESP_SAE : null,
    equipe: modelo === 'cnca' ? RESP_EQUIPE_CNCA : RESP_EQUIPE_PADRAO,
  };
}
