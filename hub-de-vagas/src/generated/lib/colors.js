// Label colors exactly as configured on the board's status columns.
// Fallback only — replaced at load time by the labels read from the board (applyBoardLabels).
export const COLORS = {
  statusDaVaga: { 'Prevista (não aprovada)': '#00c875', 'Aprovada - em aberto': '#fdab3d', 'Priorizada para realocação': '#df2f4a', 'Em rodada de match': '#579bfc', 'Em recrutamento externo': '#9d50dd', 'Preenchida': '#ff007f', 'Congelada': '#ff6d3b', 'Cancelada': '#9cd326' },
  senioridadeVaga: { 'Junior 2': '#784bd1', 'Júnior 3': '#007eb5', 'Pleno 1': '#ffcb00', 'Pleno 2': '#333333', 'Pleno 3': '#037f4c', 'Senior 1': '#cab641', 'Senior 2': '#ff007f', 'Senior 3': '#ff5ac4', 'Sem senioridade': '#c4c4c4' },
  prioridadeDaVaga: { 'Crítica': '#00c875', 'Alta': '#fdab3d', 'Média': '#df2f4a', 'Baixa': '#579bfc' },
  eixoDeAtuao: { 'EPT': '#fdab3d', 'Gestão para a Aprendizagem': '#00c875', 'Gestão Estratégica': '#df2f4a', 'Gestão do Projeto': '#007eb5', 'Avaliação e Dados': '#9d50dd', 'Formação': '#037f4c', 'Formação de Educadores': '#579bfc', 'Planejamento Estratégico': '#cab641', 'Editorial/Conteúdo': '#ffcb00', 'Gestão das Regionais': '#333333', 'Corporativo / Áreas-meio': '#ff007f', 'Desenvolvimento Institucional': '#ff6d3b' },
  modalidadeDeContratao: { 'CLT': '#00c875', 'PJ': '#df2f4a', 'RPA': '#fdab3d', 'Estágio': '#9d50dd', 'Bolsa': '#579bfc' },
  formaDePreenchimento: { 'Realocação interna': '#00c875', 'Progressão interna': '#579bfc', 'Contratação externa': '#fdab3d', 'Indicação': '#df2f4a', 'Vaga cancelada': '#9d50dd' },
  statusDoPerfil: { 'Gatilho identificado': '#c4c4c4', 'Perfil em mapeamento': '#007eb5', 'Disponivel para match': '#00c875', 'Em rodada de match': '#9d50dd', 'Em entrevista': '#bb3354', 'Aderencia confirmada': '#ff6d3b', 'Aceite confirmado': '#757575', 'Em formalizacao (SupGP)': '#ff007f', 'Aguardando mudanca de residencia': '#037f4c', 'Realocado(a)': '#579bfc', 'Retido(a) na origem': '#cab641', 'Encaminhado(a) para desligamento': '#333333', 'Desligado(a)': '#ff5ac4' },
  gatilhoDaRealocao: { 'Pedido do(a) colaborador(a)': '#fdab3d', 'Projeto em finalização': '#00c875', 'Gerente - desemp. insuficiente': '#df2f4a', 'Redução de escopo': '#9d50dd', 'Reavaliação de desligamento': '#ff6d3b' },
  senioridadeAtual: { 'Estagiário': '#faa1f1', 'Bolsista': '#333333', 'Junior 1': '#007eb5', 'Junior 2': '#fdab3d', 'Junior 2 ou 3': '#ff6d3b', 'Junior 3': '#00c875', 'Pleno 1': '#9d50dd', 'Pleno 2': '#bb3354', 'Pleno 3': '#df2f4a', 'Senior 1': '#757575', 'Senior 2': '#ff007f', 'Senior 3': '#037f4c', 'Senior 4': '#784bd1', 'Especialista': '#ffcb00', 'Coordenador(a) de Area': '#579bfc', 'Coordenador de área': '#66ccff', 'Gerente de Projetos': '#cab641', 'Gerente 1': '#7f5347', 'Gerente 2': '#9cd326', 'Gerente 3': '#ff7575', 'Gerente 4': '#ffadad', 'Gerente 5': '#7e3b8a', 'Gerente 6': '#9aadbd', 'Gerente 7': '#74afcc', 'Articuladores': '#225091', 'Nao se aplica': '#ff5ac4' },
  vnculo: { 'CLT': '#00c875', 'PJ': '#df2f4a', 'RPA': '#fdab3d', 'Bolsista': '#007eb5', 'Bolsa': '#579bfc', 'Estágio': '#9d50dd' },
  interesseEmMudarDeCidade: { 'Sim': '#00c875', 'Talvez': '#9d50dd', 'A definir': '#df2f4a', 'Não': '#fdab3d', 'Nao': '#007eb5' },
  colaboradoraDestaque: { 'Sim': '#00c875', 'Não': '#fdab3d' },
  rodada: { 'Rodada 1': '#00c875', 'Rodada 2': '#fdab3d', 'Rodada 3': '#df2f4a', 'Rodada 4': '#579bfc' },
  resultadoDaRodada: { 'Não Iniciado': '#c4c4c4', 'Não iniciado': '#ffcb00', 'Em andamento': '#007eb5', 'Em busca de realocação': '#fdab3d', 'Perfil indicado para a vaga - aguardando retorno': '#579bfc', 'Proposta feita - aguardando retorno': '#784bd1', 'Sinalização positiva do gerente de destino - aguardando aceite do(a) colaborador(a) para concluir': '#9cd326', 'Aguardando definição do(a) candidato(a) prioritário(a)': '#333333', 'Aceitou a proposta': '#ff5ac4', 'Aprovado(a) e Formalizado(a)': '#cab641', 'Formalizado(a)': '#037f4c', 'Realocado / formalizado': '#00c875', 'Sem match': '#df2f4a', 'Declinou': '#9d50dd', 'Processo travado': '#ff007f', 'Desligado (a)': '#bb3354', 'Despriorizado': '#757575' },
  statusDoMatch: { 'Não Iniciado': '#c4c4c4', 'Não iniciado': '#333333', 'Disponível': '#9d50dd', 'Indicado(a)': '#579bfc', 'Em fila (backup)': '#ff5ac4', 'Em andamento': '#ffcb00', 'Aguardando confirmação': '#fdab3d', 'Aguardando confirmação do(a) profissional': '#784bd1', 'Aceitou': '#007eb5', 'Aprovado(a)': '#00c875', 'Formalizado(a)': '#ff007f', 'Realocado(a)': '#cab641', 'Travado': '#037f4c', 'Oportunidade declinada': '#bb3354', 'Reprovado (a)': '#df2f4a' },
  statusProgresso: { 'Não Iniciado': '#c4c4c4', 'Pendente': '#9d50dd', 'Em andamento': '#fdab3d', 'Travado': '#bb3354', 'Concluído': '#00c875', 'Reprovado(a)': '#df2f4a' },
  criticidade: { 'Alta': '#00c875', 'Média': '#fdab3d', 'Baixa': '#007eb5', 'Não Preenchido': '#c4c4c4' },
  decisoDoComitDePessoas: { 'Aprovado': '#00c875', 'Reprovado': '#df2f4a', 'Não Iniciado': '#c4c4c4' },
  atraso: { 'Atrasada': '#df2f4a', 'No prazo': '#00c875' },
  emAberto: { 'Sim': '#00c875', 'Não': '#c4c4c4' },
  temDias: { 'Sim': '#ff6d3b', 'Não': '#c4c4c4' },
  situacao: { 'Ocioso — após tolerância': '#df2f4a', 'Desalocado — em tolerância': '#fdab3d', 'A desalocar — até 15 dias': '#ff6d3b', 'A desalocar — até 1 mês': '#9d50dd', 'A desalocar — até 2 meses': '#579bfc', 'A desalocar — mais de 2 meses': '#c4c4c4' },
  simNao: { 'Sim': '#00c875', 'Não': '#c4c4c4' },
};

export const PALETTE = ['#579bfc', '#00c875', '#fdab3d', '#9d50dd', '#ff6d3b', '#037f4c', '#df2f4a', '#007eb5', '#cab641', '#ff5ac4', '#784bd1', '#66ccff'];

const strip = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const buildLookup = () => Object.fromEntries(Object.entries(COLORS).map(([k, m]) => [k, Object.fromEntries(Object.entries(m).map(([l, c]) => [strip(l).replace(/\bhibrida\b/, 'hibrido'), c]))]));
let LOOKUP = buildLookup();

// Exact label → index as configured on the board (filled from the live column settings).
export const LABEL_INDEX = {};

// Replace the fallback lists above with the board's real labels/colors (read at load time).
export function applyBoardLabels(byKey) {
  Object.entries(byKey ?? {}).forEach(([key, list]) => {
    COLORS[key] = Object.fromEntries(list.map((l) => [l.label, l.color ?? COLORS[key]?.[l.label] ?? '#c4c4c4']));
    LABEL_INDEX[key] = Object.fromEntries(list.map((l) => [l.label, l.index]));
  });
  LOOKUP = buildLookup();
}

// Exact label color; falls back to accent/case-insensitive match so normalized labels keep their board color.
// Computed fields that reuse another column's palette.
const COLOR_ALIAS = { etapaEsteira: 'statusDoPerfil', emRodada: 'simNao', entrevistado: 'simNao' };
export const colorFor = (fieldKey0, label, idx = 0) => {
  if (label === 'Sem informação' || label === 'Sem candidatos') return '#c4c4c4';
  const fieldKey = COLOR_ALIAS[fieldKey0] ?? fieldKey0;
  const exact = COLORS[fieldKey]?.[label];
  if (exact) return exact;
  const loose = LOOKUP[fieldKey]?.[strip(label).replace(/\bhibrida\b/, 'hibrido')];
  if (loose) return loose;
  return COLORS[fieldKey] ? '#c4c4c4' : PALETTE[idx % PALETTE.length];
};
