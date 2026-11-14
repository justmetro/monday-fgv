import { monthKey, monthLabelOf } from '@generated/lib/data';
import { vagaAge, perfilAge } from '@generated/components/Age';
import { ESTEIRA, VAGA_ESTEIRA, SITU_ORDER_ALL, situacaoOf, desalocInfo, vagaCodigo, vagaPrazo, TAP_PLACEHOLDERS, TAP_ORDER, tapSituOf } from '@generated/lib/esteira';

const f = (key, label, type, extra = {}) => ({ key, label, type, ...extra });
const isOne = (v) => String(v ?? '').trim() === '1';
const numOrNull = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const firstNum = (s) => { const m = String(s ?? '').match(/\d+/); return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER; };

export const VAGA_FIELDS = [
  f('name', 'Vaga', 'text'),
  f('codigo', 'Código', 'text', { get: vagaCodigo }),
  f('etapaEsteira', 'Etapa da esteira', 'status', { get: (i) => i._etapa ?? null, order: VAGA_ESTEIRA }),
  f('projeto', 'Projeto', 'text'),
  f('projetoDoaSolicitante1109', 'Projeto do(a) Solicitante', 'list'),
  f('statusDaVaga', 'Status da Vaga', 'status'),
  f('cargoPapel', 'Cargo / Papel', 'text'),
  f('senioridadeVaga', 'Senioridade', 'status'),
  f('prioridadeDaVaga', 'Prioridade', 'status'),
  f('eixoDeAtuao', 'Eixo de Atuação', 'status'),
  f('modalidadeDeContratao', 'Contratação', 'status'),
  f('ufDeAtuao', 'UF de Atuação', 'list'),
  f('dataDeIncioPrevista', 'Início Previsto', 'date'),
  f('mesRef', 'Mês Ref. Início', 'month', { get: (i) => i.msRefIncioPrevistoVaga || null, sortKey: monthKey }),
  f('previsoDePreenchimento', 'Previsão de Preenchimento', 'date'),
  f('dataDePreenchimento', 'Data de Preenchimento', 'date'),
  f('formaDePreenchimento', 'Forma de Preenchimento', 'status'),
  f('colaboradoraAlocadoa', 'Colaborador(a) Alocado(a)', 'text'),
  f('emAberto', 'Vaga em aberto', 'status', { get: (i) => (isOne(i.vagaEmAberto) ? 'Sim' : 'Não') }),
  f('atraso', 'Prazo', 'status', { get: vagaPrazo, order: ['Atrasada', 'No prazo', 'Sem data'] }),
  f('alocadoNoPrazo', 'Alocado no Prazo?', 'text'),
  f('nMatches', 'Matches', 'number', { get: (i) => i._matches?.length ?? 0 }),
  f('tempoVaga', 'Tempo', 'number', { get: (i) => { const a = vagaAge(i); return a ? (a.text.includes('atraso') ? 100000 + a.days : a.days) : null; }, age: vagaAge }),
];

export const PERFIL_FIELDS = [
  f('name', 'Pessoa', 'text'),
  f('statusDoPerfil', 'Status do Perfil', 'status', { order: ESTEIRA, placeholders: TAP_PLACEHOLDERS, emptyHint: 'Campo “Status do Perfil” vazio no quadro' }),
  f('situacao', 'Situação de desalocação', 'status', { get: situacaoOf, order: SITU_ORDER_ALL, placeholders: TAP_PLACEHOLDERS }),
  f('tap', 'Situação no TAP', 'status', { get: tapSituOf, order: TAP_ORDER }),
  f('fimTap', 'Fim do TAP', 'date', { get: (i) => i._fimTap ?? null }),
  f('gatilhoDaRealocao', 'Gatilho', 'status'),
  f('gerenteDeOrigem', 'Gerente de Origem', 'text'),
  f('papelDeOrigem', 'Papel de Origem', 'text'),
  f('senioridadeAtual', 'Senioridade Atual', 'status'),
  f('vnculo', 'Vínculo', 'status'),
  f('ufDeResidncia', 'UF de Residência', 'list'),
  f('interesseEmMudarDeCidade', 'Muda de cidade?', 'status'),
  f('dataDeDisponibilidade', 'Disponível em', 'date'),
  f('dias', 'Prazo (disponibilidade)', 'number', { get: (i) => desalocInfo(i)?.days ?? null, age: perfilAge }),
  f('emRodada', 'Em rodada de match', 'status', { get: (i) => (i._emRodada ? 'Sim' : 'Não') }),
  f('entrevistado', 'Já entrevistado(a)', 'status', { get: (i) => (i._entrevistado ? 'Sim' : 'Não') }),
  f('faixa', 'Faixa de desalocação', 'text', { get: (i) => i.faixaDeDesalocao1 || null, sortKey: firstNum }),
  f('temDias', 'Com dias desalocado', 'status', { get: (i) => (numOrNull(i.diasDesalocado1) != null ? 'Sim' : 'Não') }),
  f('perfilReasDeAtuao', 'Perfil / Áreas', 'list'),
  f('colaboradoraDestaque', 'Destaque?', 'status'),
  f('nMatches', 'Vagas em match', 'number', { get: (i) => i._matches?.length ?? 0 }),
  f('linkedin', 'LinkedIn', 'link'),
  f('linkCardDePerfilFc10', 'Card de Perfil', 'link'),
];

export const PROG_FIELDS = [
  f('name', 'Colaborador(a)', 'text'),
  f('statusProgresso', 'Status (Progressão)', 'status'),
  f('criticidade', 'Criticidade', 'status'),
  f('tipoDeMovimentao', 'Tipo de Movimentação', 'list'),
  f('motivao', 'Motivação', 'list'),
  f('projetoReaDeAtuao', 'Projeto / Área', 'text'),
  f('gerentegestoraResponsvelPelaSolicitao', 'Gerente Responsável', 'text'),
  f('dataDeRecebimentoDoPedido', 'Recebimento do Pedido', 'date'),
  f('mesReceb', 'Mês de recebimento', 'month', { get: (i) => monthLabelOf(i.dataDeRecebimentoDoPedido), sortKey: monthKey }),
  f('dataDeEnvioParaASupgp', 'Envio à SupGP', 'date'),
  f('decisoDoComitDePessoas', 'Decisão do Comitê', 'status'),
  f('dataDeEfetivaoEmFolha', 'Efetivação em Folha', 'date'),
];

export const MATCH_FIELDS = [
  f('_pessoa', 'Pessoa', 'text'),
  f('_vagaName', 'Vaga', 'text'),
  f('rodada', 'Rodada', 'status'),
  f('resultadoDaRodada', 'Resultado da Rodada', 'status'),
  f('statusDoMatch', 'Status do Match', 'status'),
  f('dataDeEnvioDoCard', 'Envio do Card', 'date'),
  f('dataDaEntrevista', 'Entrevista', 'date'),
  f('prximaAo', 'Próxima Ação', 'text'),
  f('pontoFocalResponsvel', 'Ponto Focal', 'text'),
  f('parecerDoGerenteDeDestino', 'Parecer do Gerente de Destino', 'longtext'),
];

export const fieldMap = (fields) => Object.fromEntries(fields.map((x) => [x.key, x]));
