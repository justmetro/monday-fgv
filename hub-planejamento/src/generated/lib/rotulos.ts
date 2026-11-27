// Rótulos permitidos nas colunas do quadro [PLAN] v6 e do 09.1 (Calculadora de Riscos v3).
export const ROTULOS = {
  eixo: ['Gestão Estratégica', 'Alfabetização', 'Gestão para a aprendizagem', 'Gestão pública', 'Educação profissional e tecnológica', 'Educação de jovens e adultos', 'Formação continuada', 'Pesquisas e estudos'],
  tipoEntrega: ['Formação Presencial', 'Formação Virtual Síncrona', 'Formação Virtual Assíncrona', 'Formação Híbrida', 'Material Pedagógico Físico', 'Material Pedagógico Digital', 'Recursos Educacionais Digitais', 'Avaliação Presencial', 'Avaliação Digital', 'Avaliação Analítica', 'Diagnóstico e Estudos', 'Assessoramento Estratégico Analítico', 'Assessoramento Estratégico Institucional', 'Solução Tecnológica'],
  frentes: ['Gestão do Projeto', 'Produto', 'Pedagógica', 'Dados', 'Logística', 'Mobilização', 'Comunicação', 'Qualidade', 'Apoio à Gestão', 'Gestão de Time', 'Rotinas do Projeto'],
  categoria: ['Risco Operacional', 'Risco Técnico', 'Risco de Gerenciamento', 'Risco de Conformidade Legal/Normativo', 'Risco Tributário', 'Risco Político', 'Risco Institucional/Reputacional', 'Risco Financeiro'],
  probabilidade: ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito Alto'],
  impacto: ['Muito Baixo', 'Baixo', 'Médio', 'Alto', 'Muito Alto'],
  estrategia: ['Prevenir', 'Mitigar', 'Transferir', 'Escalar', 'Aceitar'],
  papel: ['Decisor', 'Influenciador', 'Executor', 'Técnico', 'Administrativo', 'Validação'],
  nivel: ['Alto', 'Médio', 'Baixo'],
  // Unidades revisadas na padronização dos indicadores (nov/2026); criadas no quadro na gravação se faltarem.
  unidade: ['Percentual', 'Média', 'Pontuação ou escala', 'Binário', 'Unidade'],
  temporalidade: ['Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'],
  coleta: ['Relatório', 'Formulário', 'Registro em ata', 'Análise documental', 'Grupo focal'],
  polaridade: ['Quanto mais, melhor', 'Quanto menos, melhor'],
  natureza: ['Privado', 'Municipal', 'Estadual', 'Federal', 'Multissetorial'],
  modalidade: ['Presencial', 'Remoto', 'Híbrido'],
  // Rótulos do quadro 09.1 Projetos | Calculadora de Riscos (v3)
  calc: {
    c1_fat: ['Pró-bono', 'Até R$ 7.999.999,99 ao ano', 'Entre R$ 8.000.000,00 e R$ 39.999.999,99 ao ano', 'A partir de R$ 40.000.000,00 ao ano'],
    c2_tipofat: ['Parcela', 'Produto faturável', 'Não faturável'],
    c3_vig: ['Até 12 meses', 'Entre 13 e 24 meses', 'A partir de 25 meses'],
    c4_cli: ['Público | Municipal', 'Público | Estadual / Federal', 'Privado', 'Multissetorial'],
    c5_mod: ['Presencial', 'Remoto', 'Híbrido'],
    c6_prod: ['Até 2 produtos por mês', 'Entre 3 a 6 produtos por mês', 'Igual ou acima de 7 produtos por mês'],
    c7_tipo: ['Formação', 'Material Pedagógico', 'Material Didático', 'Recursos Educacionais Digitais', 'Avaliação', 'Diagnóstico e Estudos', 'Assessoramento Estratégico', 'Solução Tecnológica'],
    c8_equipe: ['Até 10 membros na equipe', 'Entre 11 e 30 membros na equipe', 'Entre 31 e 99 membros na equipe', 'A partir de 100 membros na equipe'],
  },
} as const;

/** Nome de cada etapa no registro do 09.0 e na tela. */
export const ROTULO_ETAPA = {
  analise: 'Análise', tap: 'TAP', produtos: 'Produtos', eap: 'EAP e Cronograma', riscos: 'Riscos específicos', complemento: 'Riscos da calculadora',
  indicadores: 'Indicadores', partes: 'Partes Interessadas', calculadora: 'Calculadora de Riscos',
} as const;
