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

// Manual de Tipologias de Serviço da FGV DGPE (Superintendência de Projetos, 2026): 8 categorias e suas modalidades.
export interface Tipologia { codigo: string; categoria: string; modalidade: string; descricao: string }
export const TIPOLOGIAS_MANUAL: Tipologia[] = [
  { codigo: '1A-F', categoria: 'Formação', modalidade: 'Formação Presencial', descricao: 'cursos, oficinas, workshops, seminários formativos com avaliação e imersões em espaço físico; envolve logística de local, alimentação e deslocamento' },
  { codigo: '1B-F', categoria: 'Formação', modalidade: 'Formação Virtual Síncrona', descricao: 'aulas ao vivo por videoconferência, webinários formativos, tutoria online e bancas por videoconferência' },
  { codigo: '1C-F', categoria: 'Formação', modalidade: 'Formação Virtual Assíncrona', descricao: 'cursos autoinstrucionais em AVA, trilhas com módulos sequenciais, atividades avaliativas em plataforma, fóruns com tutoria e leituras dirigidas' },
  { codigo: '1D-F', categoria: 'Formação', modalidade: 'Formação de Longa Duração', descricao: 'pós-graduação lato sensu e certificação profissional, com carga horária elevada e caráter acadêmico ou certificador' },
  { codigo: '1E-F', categoria: 'Formação', modalidade: 'Formações Técnicas', descricao: 'treinamentos curtos, que não são o objeto principal, para a equipe do parceiro operar ferramentas, processos redesenhados, metodologias e rotinas de monitoramento entregues no projeto' },
  { codigo: '2A-MP', categoria: 'Material Pedagógico', modalidade: 'Material Pedagógico Digital', descricao: 'orienta como ensinar ou formar (destinatário é o educador), em formato digital: guias metodológicos, matrizes curriculares e de competências, sequências didáticas, planos de curso e de aula' },
  { codigo: '2B-MP', categoria: 'Material Pedagógico', modalidade: 'Material Pedagógico Físico', descricao: 'os mesmos materiais pedagógicos impressos, com diagramação, impressão e distribuição' },
  { codigo: '3A-MD', categoria: 'Material Didático', modalidade: 'Material Didático Digital', descricao: 'carrega o conteúdo a ser aprendido, em formato digital: cadernos de conteúdo e de atividades, textos de referência, livros e apostilas, bancos de questões' },
  { codigo: '3B-MD', categoria: 'Material Didático', modalidade: 'Material Didático Físico', descricao: 'os mesmos materiais didáticos impressos em tiragem, com diagramação, impressão e logística de distribuição' },
  { codigo: '4A-RD', categoria: 'Recursos Educacionais Digitais', modalidade: 'Conteúdos Audiovisuais', descricao: 'videoaulas, gravações de aulas, podcasts, animações e vídeos explicativos com finalidade educacional' },
  { codigo: '4B-RD', categoria: 'Recursos Educacionais Digitais', modalidade: 'Objetos e Recursos Interativos', descricao: 'objetos educacionais digitais, simulações, infográficos interativos, quizzes com correção automática e atividades gamificadas' },
  { codigo: '4C-RD', categoria: 'Recursos Educacionais Digitais', modalidade: 'Ambientes Virtuais de Aprendizagem', descricao: 'plataformas AVA configuradas e carregadas com trilhas completas, bibliotecas e repositórios digitais' },
  { codigo: '5A-A', categoria: 'Avaliação', modalidade: 'Avaliação de Aprendizagem', descricao: 'avaliações diagnósticas, formativas e somativas, rubricas, bancos de itens e relatórios de desempenho' },
  { codigo: '5B-A', categoria: 'Avaliação', modalidade: 'Avaliação Institucional e de Programas', descricao: 'índices de maturidade, prontidão ou elegibilidade e avaliações de programas e políticas' },
  { codigo: '5C-A', categoria: 'Avaliação', modalidade: 'Avaliação de Desempenho Operacional', descricao: 'métricas de uso e adoção de ferramentas, sistemas ou processos implantados' },
  { codigo: '6A-DE', categoria: 'Diagnóstico e Estudos', modalidade: 'Diagnóstico Operacional e Situacional', descricao: 'fotografia da situação atual: diagnósticos de rede ou organizacionais, mapeamento de processos e fluxos, levantamento de normativos e contratos, escutas, entrevistas e mapeamento de atores' },
  { codigo: '6B-DE', categoria: 'Diagnóstico e Estudos', modalidade: 'Estudos Técnicos e Modelagens', descricao: 'estudos de viabilidade, bases unificadas de fontes oficiais, modelagens financeiras, matrizes de custo, cenários e simulações' },
  { codigo: '7A-AE', categoria: 'Assessoramento Especializado', modalidade: 'Planejamento e Estratégia', descricao: 'planejamentos estratégicos e planos de ação, modelos de governança, redesenho de processos, matrizes de indicadores, metodologias de monitoramento, manuais operacionais' },
  { codigo: '7B-AE', categoria: 'Assessoramento Especializado', modalidade: 'Ferramentas de Gestão', descricao: 'painéis e dashboards de indicadores, planilhas de controle, formulários e templates, de baixa a média complexidade, operados pelo parceiro' },
  { codigo: '7C-AE', categoria: 'Assessoramento Especializado', modalidade: 'Assessoria Técnica Continuada', descricao: 'acompanhamento recorrente da execução de modelos e processos já definidos: escritório de projetos, apoio à implementação, ciclos de assessoria com relatórios periódicos' },
  { codigo: '7D-AE', categoria: 'Assessoramento Especializado', modalidade: 'Normativo e Regulatório', descricao: 'minutas de leis, decretos, portarias, resoluções, regimentos e normativos internos, notas técnicas de viabilidade jurídica' },
  { codigo: '7E-AE', categoria: 'Assessoramento Especializado', modalidade: 'Assessoria Pedagógica', descricao: 'acompanhamento técnico-pedagógico de rotinas de gestão da aprendizagem nas escolas, devolutivas e apoio a coordenadores e gestores escolares' },
  { codigo: '8A-ST', categoria: 'Solução Tecnológica', modalidade: 'Plataformas e Sistemas', descricao: 'desenvolvimento ou integração de software com múltiplas funcionalidades num ambiente digital unificado' },
];

/** "7A-AE" -> "Assessoramento Especializado: Planejamento e Estratégia (7A-AE)". Aceita o código sozinho ou já com o nome. */
export function nomeTipologia(x: string): string {
  const cod = x.trim().match(/^(\d[A-Z])(-[A-Z]{1,2})?/i)?.[0]?.toUpperCase() ?? '';
  const t = TIPOLOGIAS_MANUAL.find((y) => y.codigo === cod) ?? TIPOLOGIAS_MANUAL.find((y) => cod && y.codigo.startsWith(cod));
  return t ? `${t.categoria}: ${t.modalidade} (${t.codigo})` : x.trim();
}

export const TIPOLOGIAS = `MANUAL DE TIPOLOGIAS DE SERVIÇO DA FGV DGPE (código, categoria, modalidade, o que caracteriza):
${TIPOLOGIAS_MANUAL.map((t) => `- ${t.codigo} | ${t.categoria} | ${t.modalidade}: ${t.descricao}.`).join('\n')}
Critérios: Formação exige percurso formativo reconhecível (objetivos, carga horária, metodologia); eventos só de articulação não contam. Material Pedagógico orienta como ensinar (destinatário é o educador); Material Didático carrega o que aprender. Recursos Educacionais Digitais têm finalidade educacional e são interativos ou audiovisuais; Solução Tecnológica tem finalidade operacional. Manuais operacionais e documentações metodológicas de gestão são Assessoramento Especializado, não Material Pedagógico. Um mesmo produto pode combinar mais de um serviço.`;

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
Identifica grupos ou instituições com poder de impactar o projeto (decidir, validar, aprovar, mobilizar, executar, avaliar ou influenciar). No planejamento o mapeamento é institucional: órgãos, secretarias, áreas, conselhos, financiadores, redes, públicos e fornecedores críticos. Não liste pessoas físicas. A FGV DGPE (contratada) nunca entra na matriz, nem suas áreas, diretorias ou equipes: a matriz mapeia só partes externas. Não infle a matriz com quem não interfere de fato (cargo não é influência). Normalmente de 5 a 12 partes.
Etapas: identificar; papel; interesse; poder/influência; estratégia pelo cruzamento; expectativas; riscos da relação (atrasos em decisões ou validações, baixa adesão, mobilização, mudança de direcionamento, retrabalho, comunicação, percepção de resultados).
Estratégia (fórmula da monday): Poder Alto + Interesse Alto = Gerenciar de perto; Poder Alto + Interesse Médio ou Baixo = Engajar institucionalmente; Poder Médio ou Baixo + Interesse Alto = Consultar frequentemente; demais = Manter informado.`;

export const OKR = `PAINEL DE INDICADORES (OKRs) da FGV DGPE:
- Objetivo (O): qualitativo e aspiracional, a principal mudança que o projeto quer gerar. Racional: "O projeto será bem-sucedido se...". Ideal: até 3 por projeto, conforme o tamanho do escopo.
- Resultado-chave (KR): mensurável, SMART, sem subjetividade; mede "o que mudou". Racional: "Ao final, [resultado] comprovado por [critério], até [prazo]". Ideal: até 5 por objetivo.
- KPI de processo: acompanha a execução operacional (prazo, cobertura, aderência ao padrão); mede "executamos como planejado?". Ideal: até 3 por KR.
- Relacione KRs e KPIs aos produtos do cronograma. Confronte com o TR e o contrato (indicadores de medição de resultado exigidos pelo cliente entram obrigatoriamente).`;

// Padronização dos indicadores (Revisão e padronização dos indicadores dos projetos, CoPlan, nov/2026).
export const INDICADORES_PADRAO = `PADRÃO DE REDAÇÃO DOS INDICADORES (revisão de 376 indicadores de 30 projetos da FGV DGPE):
- Estrutura do nome: unidade de medida por extenso + objeto mensurado + recorte ou condição, só quando necessário. Começa com "Percentual de", "Média de", "Número de" ou "Pontuação de".
- Sem siglas no nome (sistemas, órgãos, programas e "NPS" por extenso: "Pontuação de satisfação (Net Promoter Score) das formações").
- "Taxa" vira "Percentual". "Índice de" só para índice com metodologia própria; senão "Percentual de".
- Média de satisfação e Net Promoter Score são indicadores diferentes; o Net Promoter Score já é um cálculo próprio, não escreva "média de NPS".
- Nome genérico e comparável entre projetos: sem nota de corte, etapa, série, trilha, módulo, nome de cliente, rede ou sistema no nome. Esses recortes vão na forma de cálculo ou na descrição. Ex.: "Percentual de cursistas aprovados por módulo com nota final ≥ 7" vira "Percentual de cursistas aprovados nas avaliações da formação".
- Forma de cálculo coerente com o nome e a unidade, com %, Nº ou Σ explícitos. Ex.: "(Nº de produtos validados pelo cliente / Nº de produtos previstos) x 100".
- Quantidade absoluta é exceção: contagem de entregas, documentos, produtos ou eventos vira percentual de alcance do previsto ("Número de documentos normativos elaborados" vira "Percentual de documentos normativos elaborados", meta 100). Use "Número de" só quando não existir um total previsto que sirva de denominador.
UNIDADE (use exatamente um destes):
- Percentual: proporções, coberturas, participação ou alcance em relação a um total de referência. É a unidade padrão.
- Média: valor médio de um conjunto de observações (por turma, por profissional, por período).
- Pontuação ou escala: Net Promoter Score, escala de satisfação ou de proficiência com metodologia própria.
- Binário: cumprimento ou não de uma condição (0 ou 1), como aprovação integral de um documento nas instâncias de governança ou implantação de uma metodologia. Meta 1.
- Unidade: contagem em unidade própria, só quando não houver denominador.
METAS PADRÃO POR TIPO (use quando o TR ou o contrato não fixarem outra):
- Execução de entregas e atividades planejadas: 100 (%). Entregas revisadas e validadas: 100 (%). Entregas validadas sem necessidade de revisão: 85 (%).
- Participação e presença em formações e eventos: 80 (%). Conclusão, aprovação e certificação de cursistas: 80 (%). Taxa de resposta a pesquisas: 70 (%).
- Satisfação por respostas positivas: 80 (%). Net Promoter Score: 80. Satisfação em nota média numa escala de 1 a 5: 4.
- Adoção e uso pela rede ou parceiro: 85 (%). Participação de estudantes em avaliações: 85 (%).
- Resultados educacionais (aprendizagem, fluxo, frequência) e indicadores específicos do projeto: meta do contexto, tirada dos documentos.`;

export const EAP = `EAP E CRONOGRAMA DA FGV DGPE (grupo Cronograma do quadro [PLAN]):
- Nível 1 = Produto (já existe no grupo Produtos; não repetir).
- Nível 2 = Entregável: o que precisa existir para o produto estar concluído. 2 a 4 por produto.
- Nível 3 = Marco: resultado intermediário e verificável que leva o entregável à conclusão; traz condicionantes do contrato quando existirem (ex.: "Recebimento provisório (5 dias) e definitivo (10 dias)"). 2 a 4 por entregável. Inclua como marco o fluxo de aceite e faturamento de cada produto faturável.
- Nomes dos Níveis 2 e 3 sem prefixo de rótulo (nunca "ENTREGÁVEL", "MARCO", "Entregável:" ou "Marco:" no nome) e sem quantidade solta: em vez de "1 sistema de gestão diagnosticado", escreva "Diagnóstico do sistema de gestão concluído".
- Nível 4 = Atividade do cronograma de execução: o que fazer para atingir o marco. 2 a 4 por marco. Fica como subitem do seu marco (Nível 3) no quadro: toda atividade pertence a um marco. A redação é importantíssima: SEMPRE começa com verbo no infinitivo (Elaborar, Realizar, Validar, Consolidar, Enviar, Mapear...), é específica e verificável, sem gerúndio e sem substantivo no início.
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
- Quantitativos: só use número quando ele for informação real do escopo (público atendido, carga horária, municípios). Nunca "1 X" para dizer que existe uma entrega ("1 sistema de gestão" é "construção do sistema de gestão"), nem contagem de produtos, lote, item ou quantitativo de licitação.
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
