/** Labels configured on the board "02.01 Projetos em Planejamento" (from the board schema). */
export const OPT = {
  statusPlanejamento: [
    'Em andamento', 'Em replanejamento', 'Em revisão', 'Planejado aguardando assinatura',
    'Instrumento Concluído', 'Finalizado (Plan + SGI)', 'Pausado', 'Novo Cadastro - 30 a 45 dias', 'Novo Cadastro - 45 a 60 dias',
    'Despriorizado', 'Sem planejamento [ANTIGOS]',
  ],
  statusSgi: [
    'Não Iniciado', 'Aguardando planejamento', 'Aguardando cadastro no SGI', 'Em registro no SGI',
    'Em validação no SGI', 'Validado no SGI', 'TAP Reprovado', 'Pausado', 'Despriorizado', 'Sem planejamento [ANTIGOS]',
  ],
  prioridade: ['Crítico', 'Alta', 'Média', 'Baixa', 'Não'],
  radarMonitoramento: ['Alta Prob. de Repactuação', 'Crono Produtos Pactuado', 'Crono Produtos em Construção'],
  alocaoDeEquipe: ['Equipe alocada', 'Sem equipe', 'Não preenchido', 'Verificar'],
  dimensionamentoConcludo: ['Concluído', 'Não concluído'],
  eixo: [
    'Gestão Estratégica', 'Alfabetização', 'Gestão para a aprendizagem', 'Gestão pública',
    'Educação profissional e tecnológica', 'Educação de jovens e adultos', 'Formação continuada', 'Pesquisas e estudos',
  ],
  uf: [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO', 'BR', 'INT',
  ],
  tipoPlanejamento: ['Revisão', 'Antigo Sem Planejamento', 'Novo Contrato', 'Planejamento antigo', 'Novo Aditivo'],
  gerente1: [
    'Victor Martins Feitosa', 'Leonardo Milhomem Rezende', 'Adriana Matos Seidel', 'Ana Angela de Medeiros Sousa',
    'Bruna Luisa Martins Barbosa', 'Bruno de Toledo Martins', 'Camila Nolasco dos Passos', 'Caroline Almeida Martins',
    'Catherine de Sa Paixao Teixeira', 'Claudia Maria Micheluci Petri', 'Gabriel Guedes Gama de Lima',
    'Isabelle dos Santos Neles', 'Ives Nahama Gomes', 'Jaana Flavia Fernandes Nogueira', 'Joseph Razouk Junior',
    'Juliana Mattedi Dalvi', 'Kate Dayana Rodrigues de Abreu', 'Luiz Felipe Espinola', 'Mariana Holanda Carvalho Fireman',
    'Mariana Ribeiro do Nascimento', 'Nathalia de Paula Vieira', 'Rafael Gotti Guimaraes', 'Rafaela Caruline Rodrigues',
    'Raquel Breda dos Santos', 'Renata Tenorio de Melo', 'Ricardo dos Santos Batista', 'Tamires Matos de Paula Goncalves',
    'Thales Henrique Pereira', 'Tullia Maria Ribeiro Oliveira Erseni', 'Vinicius Evangelista da Costa',
    'Roberta Fernanda Cesar Correia de Albuquerque Santana', 'Vivyane Caldeira', 'Daniela Ribeiro Guarieiro',
    'Kheitt Lamas', 'Tatiana Barcelos', 'Layla Nayara Gomes da Silva', 'Luana Galeno', 'Bruna dos Santos Lersch',
    'Isabella Nogueira', 'Roberto Rocha Leandro', 'Gustavo Wei', 'Tullio Monteiro Prota', 'Fabio dos Anjos',
    'Umberto Bezerra Neto', 'Adirce Senna', 'Vitor Knobl Moneo', 'camil', 'Aline Bocamino',
  ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
};

/** Status Planejamento values considered inactive: open stages never raise late/due alerts. */
export const STATUS_INATIVOS: Record<string, string> = {
  'Finalizado (Plan + SGI)': 'Não se aplica',
  Pausado: 'Pausado',
  Despriorizado: 'Despriorizado',
  'Sem planejamento [ANTIGOS]': 'Sem planejamento',
};

export function isInativo(statusPlanejamento: string | null | undefined): boolean {
  return !!statusPlanejamento && statusPlanejamento in STATUS_INATIVOS;
}

/** "Mês Referência Resultado" different from N/A → project counts for result KPIs. */
export function temMesReferencia(v: string | null | undefined): boolean {
  const s = v?.trim();
  return !!s && s.toLowerCase() !== 'null' && s !== 'N/A';
}
