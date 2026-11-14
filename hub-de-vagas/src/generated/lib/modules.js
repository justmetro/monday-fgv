import { VAGA_FIELDS, PERFIL_FIELDS, PROG_FIELDS, MATCH_FIELDS, fieldMap } from '@generated/lib/fields';
import { SITU, TAP_ORDER } from '@generated/lib/esteira';

export const VAGA_GROUP = '__vaga';
const ABERTAS = ['Aprovada - em aberto', 'Em rodada de match'];

const base = { view: 'table', filters: {}, mfilters: {}, search: '', sort: null, columns: null, kanbanBy: null, dateKey: null };
const preset = (id, label, desc, state) => ({ id, label, desc, state: { ...base, ...state } });

export const MODULES = {
  vagas: {
    id: 'vagas', label: 'Vagas & Matches', noun: 'vagas',
    fields: VAGA_FIELDS, fmap: fieldMap(VAGA_FIELDS), mfmap: fieldMap(MATCH_FIELDS),
    groupOptions: ['projeto', 'mesRef', 'etapaEsteira', 'statusDaVaga', 'eixoDeAtuao', 'prioridadeDaVaga', 'senioridadeVaga', 'ufDeAtuao', 'atraso', VAGA_GROUP],
    filterKeys: ['statusDaVaga', 'etapaEsteira', 'projeto', 'emAberto', 'atraso', 'prioridadeDaVaga', 'eixoDeAtuao', 'senioridadeVaga', 'modalidadeDeContratao', 'ufDeAtuao', 'mesRef', 'formaDePreenchimento'],
    matchFilterKeys: ['rodada', 'statusDoMatch', 'resultadoDaRodada'],
    searchKeys: ['name', 'codigo', 'projeto', 'cargoPapel', 'colaboradoraAlocadoa'],
    defaultColumns: ['name', 'codigo', 'projeto', 'statusDaVaga', 'cargoPapel', 'senioridadeVaga', 'prioridadeDaVaga', 'dataDeIncioPrevista', 'tempoVaga', 'nMatches'],
    cardFields: ['codigo', 'statusDaVaga', 'etapaEsteira', 'prioridadeDaVaga', 'senioridadeVaga', 'dataDeIncioPrevista'],
    kanbanKeys: ['etapaEsteira', 'm:rodada', 'm:statusDoMatch', 'statusDaVaga', 'prioridadeDaVaga'],
    dateKeys: ['dataDeIncioPrevista', 'previsoDePreenchimento', 'dataDePreenchimento'],
    presets: [
      preset('rodadas', 'Rodadas de match por projeto', 'Abertas ou em rodada · Projeto → Vaga', { filters: { statusDaVaga: ABERTAS }, groupBy: ['projeto', VAGA_GROUP] }),
      preset('mes', 'Vagas por mês de referência', 'Aprovadas e previstas · por mês', { filters: { statusDaVaga: ['Aprovada - em aberto', 'Prevista (não aprovada)'] }, groupBy: ['mesRef'] }),
      preset('atraso', 'Vagas em aberto e atrasadas', 'Em aberto · Atrasadas / No prazo', { filters: { emAberto: ['Sim'] }, groupBy: ['atraso'] }),
      preset('match', 'Match de Perfis e Vagas', 'Todas · por Status da Vaga', { groupBy: ['statusDaVaga'] }),
      preset('esteira', 'Esteira das vagas', 'Kanban pela etapa mais avançada dos candidatos', { view: 'kanban', kanbanBy: 'etapaEsteira', groupBy: [] }),
      preset('todas', 'Vagas', 'Todas as vagas', { groupBy: [] }),
    ],
  },
  perfis: {
    id: 'perfis', label: 'Perfis para Realocação', noun: 'pessoas',
    fields: PERFIL_FIELDS, fmap: fieldMap(PERFIL_FIELDS),
    groupOptions: ['statusDoPerfil', 'situacao', 'tap', 'faixa', 'gatilhoDaRealocao', 'senioridadeAtual', 'ufDeResidncia', 'vnculo'],
    filterKeys: ['statusDoPerfil', 'situacao', 'tap', 'emRodada', 'entrevistado', 'faixa', 'temDias', 'gatilhoDaRealocao', 'senioridadeAtual', 'vnculo', 'ufDeResidncia', 'interesseEmMudarDeCidade', 'perfilReasDeAtuao', 'colaboradoraDestaque'],
    searchKeys: ['name', 'gerenteDeOrigem', 'papelDeOrigem'],
    defaultColumns: ['name', 'statusDoPerfil', 'situacao', 'tap', 'dataDeDisponibilidade', 'fimTap', 'dias', 'papelDeOrigem', 'senioridadeAtual', 'nMatches'],
    cardFields: ['statusDoPerfil', 'situacao', 'dataDeDisponibilidade', 'senioridadeAtual'],
    kanbanKeys: ['statusDoPerfil', 'situacao', 'tap', 'gatilhoDaRealocao'],
    dateKeys: ['dataDeDisponibilidade'],
    presets: [
      preset('perfis', 'Perfis para realocação', 'Por Status do Perfil', { groupBy: ['statusDoPerfil'] }),
      preset('desaloc', 'Pessoas em desalocação', 'Disponibilidade já passou · por situação · mais antigas primeiro', { filters: { situacao: [SITU.ocioso, SITU.tolerancia] }, groupBy: ['situacao'], sort: { key: 'dataDeDisponibilidade', dir: 'asc' } }),
      preset('ociosos', 'Pessoas ociosas', 'Disponibilidade + 15 dias já vencida', { filters: { situacao: [SITU.ocioso] }, groupBy: [], sort: { key: 'dataDeDisponibilidade', dir: 'asc' } }),
      preset('adesalocar', 'Pessoas a desalocar (60 dias)', 'Até 15 dias · até 1 mês · até 2 meses', { filters: { situacao: [SITU.ate15, SITU.ate30, SITU.ate60] }, groupBy: ['situacao'], sort: { key: 'dataDeDisponibilidade', dir: 'asc' } }),
      preset('tap', 'Ociosas e em desalocação', 'Função terminando ou terminada × fim do TAP no planejamento', { filters: { tap: TAP_ORDER }, groupBy: ['tap'], sort: { key: 'dataDeDisponibilidade', dir: 'asc' } }),
      preset('esteira', 'Esteira do perfil', 'Kanban pelas etapas do perfil', { view: 'kanban', kanbanBy: 'statusDoPerfil', groupBy: [] }),
    ],
  },
  progs: {
    id: 'progs', label: 'Progressões', noun: 'pedidos',
    fields: PROG_FIELDS, fmap: fieldMap(PROG_FIELDS),
    groupOptions: ['statusProgresso', 'criticidade', 'tipoDeMovimentao', 'projetoReaDeAtuao', 'mesReceb'],
    filterKeys: ['statusProgresso', 'criticidade', 'tipoDeMovimentao', 'motivao', 'projetoReaDeAtuao', 'decisoDoComitDePessoas', 'mesReceb'],
    searchKeys: ['name', 'projetoReaDeAtuao', 'gerentegestoraResponsvelPelaSolicitao'],
    defaultColumns: ['name', 'statusProgresso', 'criticidade', 'tipoDeMovimentao', 'projetoReaDeAtuao', 'gerentegestoraResponsvelPelaSolicitao', 'dataDeRecebimentoDoPedido', 'decisoDoComitDePessoas'],
    cardFields: ['statusProgresso', 'criticidade', 'tipoDeMovimentao', 'dataDeRecebimentoDoPedido'],
    kanbanKeys: ['statusProgresso', 'criticidade', 'decisoDoComitDePessoas'],
    dateKeys: ['dataDeRecebimentoDoPedido', 'dataDeEnvioParaASupgp', 'dataDeEfetivaoEmFolha'],
    presets: [preset('progs', 'Progressões', 'Por Status (Progressão)', { groupBy: ['statusProgresso'] })],
  },
};

export const defaultState = (id) => ({ ...MODULES[id].presets[0].state, presetId: MODULES[id].presets[0].id });

export const withPreset = (id, presetId, extra = {}) => {
  const p = MODULES[id].presets.find((x) => x.id === presetId) ?? MODULES[id].presets[0];
  return { ...p.state, presetId: p.id, ...extra, filters: { ...p.state.filters, ...(extra.filters ?? {}) } };
};

// Resolve a field (supports "m:" prefix for match fields in the vagas module)
export function resolveField(mod, key) {
  if (key?.startsWith('m:')) return { ...mod.mfmap[key.slice(2)], scope: 'match' };
  if (key === VAGA_GROUP) return { key: VAGA_GROUP, label: 'Vaga (pessoas como linhas)', type: 'vaga' };
  return mod.fmap[key];
}
