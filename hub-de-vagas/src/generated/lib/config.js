// ============================================================================
// CONFIGURAÇÃO CENTRAL — quadros, grupos, colunas, rótulos de escrita e limiares.
// Sem dependências: pode ser importado por qualquer módulo.
// ============================================================================
export const MAIN_BOARD = '18427417720';
export const SUB_BOARD = '18427418240';
export const GROUP_IDS = { vagas: 'group_mm6dzxp9', perfis: 'group_mm6dckpe', progs: 'group_mm6hm9yr' };

// Colunas usadas pelo Match Automático. prop = propriedade SDK, id = coluna monday.
// cov: true → aparece no painel "Cobertura de dados".
export const VAGA_FIELDS = [
  { prop: 'statusDaVaga', id: 'color_mm6d3c1k', title: 'Status da Vaga' },
  { prop: 'eixoDeAtuao', id: 'color_mm6dvpp8', title: 'Eixo de Atuação', cov: true },
  { prop: 'cargoPapel', id: 'text_mm6dc7q3', title: 'Cargo / Papel', cov: true },
  { prop: 'senioridadeVaga', id: 'color_mm6dj9pp', title: 'Senioridade (Vaga)' },
  { prop: 'modalidadeDeContratao', id: 'color_mm6ddf0w', title: 'Modalidade de Contratação' },
  { prop: 'modalidadeDeAtuaoVaga', id: 'color_mm6dgv51', title: 'Modalidade de Atuação (Vaga)', cov: true },
  { prop: 'ufDeAtuao', id: 'dropdown_mm6dx652', title: 'UF de Atuação', cov: true },
  { prop: 'salrioPrevistoR', id: 'numeric_mm6de9sb', title: 'Salário Previsto (R$)', cov: true },
  { prop: 'dataDeIncioPrevista', id: 'date_mm6dtgf0', title: 'Data de Início Prevista' },
  { prop: 'projeto', id: 'text_mm6dw0cq', title: 'Projeto' },
  { prop: 'competnciasEssenciais', id: 'dropdown_mm6dx1gs', title: 'Competências Essenciais', cov: true },
  { prop: 'competnciasDesejveis', id: 'dropdown_mm6dwbsw', title: 'Competências Desejáveis', cov: true },
  { prop: 'principaisAtividadesVaga', id: 'long_text_mm6dgpx8', title: 'Principais Atividades (Vaga)', cov: true },
  { prop: 'famliaDeRea', id: 'dropdown_mm8k8yge', title: 'Família de área', cov: true },
];
export const PERFIL_FIELDS = [
  { prop: 'statusDoPerfil', id: 'color_mm6dbe8j', title: 'Status do Perfil' },
  { prop: 'papelDeOrigem', id: 'text_mm6d6aw', title: 'Papel de Origem', cov: true },
  { prop: 'senioridadeAtual', id: 'color_mm6dxjvs', title: 'Senioridade Atual' },
  { prop: 'perfilReasDeAtuao', id: 'dropdown_mm6drc4j', title: 'Perfil / Áreas de Atuação', cov: true },
  { prop: 'competnciasEHabilidades', id: 'dropdown_mm6d2efk', title: 'Competências e Habilidades', cov: true },
  { prop: 'principaisAtividadesEntregas', id: 'long_text_mm6dxz03', title: 'Principais Atividades / Entregas', cov: true },
  { prop: 'pontosFortes', id: 'long_text_mm6dnyew', title: 'Pontos Fortes', cov: true },
  { prop: 'pontosDeMelhoria', id: 'long_text_mm6d8r5d', title: 'Pontos de Melhoria', cov: true },
  { prop: 'principaisInteresses', id: 'dropdown_mm6dvmyb', title: 'Principais Interesses', cov: true },
  { prop: 'observaesPerfil', id: 'long_text_mm6d4rgp', title: 'Observações (Perfil)', cov: true },
  { prop: 'salrioAtualR', id: 'numeric_mm6dbvg9', title: 'Salário Atual (R$)', cov: true },
  { prop: 'ufDeResidncia', id: 'dropdown_mm6d8r13', title: 'UF de Residência' },
  { prop: 'ufsDeInteresse', id: 'dropdown_mm6dz9xa', title: 'UFs de Interesse', cov: true },
  { prop: 'interesseEmMudarDeCidade', id: 'color_mm6dhdty', title: 'Interesse em Mudar de Cidade?' },
  { prop: 'vnculo', id: 'color_mm6dw92', title: 'Vínculo' },
  { prop: 'dataDeDisponibilidade', id: 'date_mm6d68nz', title: 'Data de Disponibilidade' },
  { prop: 'famliaDeRea', id: 'dropdown_mm8k8yge', title: 'Família de área', cov: true },
];
export const SUB_FIELDS = [
  { prop: 'perfilVinculado', id: 'board_relation_mm6dy38x', title: 'Perfil Vinculado' },
  { prop: 'rodada', id: 'color_mm6d1z2k', title: 'Rodada' },
  { prop: 'statusDoMatch', id: 'color_mm6dtr9r', title: 'Status do Match' },
  { prop: 'resultadoDaRodada', id: 'color_mm6d517p', title: 'Resultado da Rodada' },
  { prop: 'msDeRefernciaMatch', id: 'date_mm6dtxsq', title: 'Mês de Referência (Match)' },
];
export const MATCH_VAGA_COLS = VAGA_FIELDS.map((f) => f.prop);
export const MATCH_PERFIL_COLS = PERFIL_FIELDS.map((f) => f.prop);

const byProp = (l) => Object.fromEntries(l.map((f) => [f.prop, f.id]));
export const COL = { ...byProp(VAGA_FIELDS), ...byProp(PERFIL_FIELDS), sub: byProp(SUB_FIELDS) };
export const FAMILIA_COL_ID = 'dropdown_mm8k8yge';

// Rótulos usados nas escritas do "Aplicar e enviar".
export const WRITE_LABELS = {
  statusDoMatch: 'Indicado(a)',
  resultadoDaRodada: 'Perfil indicado para a vaga - aguardando retorno',
  emRodada: 'Em rodada de match',
  rodada: (n) => `Rodada ${n}`,
};
export const MAX_RODADA = 4;

// Viabilidade (score quantitativo) — regras por estado.
export const VIAB = {
  SEN_OK: 1, // vaga até 1 nível acima → ok
  SEN_ATENCAO: 2, // até 2 níveis → atenção; acima → risco
  SAL_OK: 0.15, // diferença relativa ≤ 15% → ok
  SAL_ATENCAO: 0.30, // ≤ 30% → atenção; acima → risco
  PESO_SEN: 60,
  PESO_SAL: 40,
  FATOR: { ok: 1, atencao: 0.5, risco: 0, semdado: 0.75 },
};

// Aderência qualitativa
export const QUALI = { MIN_COBERTURA: 4, DIMENSOES: 6, PESO_DERIVADA: 0.5, PESO_FRACO: 0.5, JANELA_NEGACAO: 40 };

// Gravação em lote
export const BATCH = { CONCORRENCIA: 3, ESPERA_RETRY_MS: 1500 };
