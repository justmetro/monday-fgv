import { BoardSDK } from '@api/BoardSDK';
import mondaySdk from 'monday-sdk-js';
import { fetchMeta } from '@generated/lib/boardMeta';
import { fetchTap } from '@generated/lib/tap';
import { MAIN_BOARD, GROUP_IDS } from '@generated/lib/config';

export const board = new BoardSDK();
export const monday = mondaySdk();

export { GROUP_IDS };

const VAGA_COLS = ['projeto', 'projetoDoaSolicitante1109', 'statusDaVaga', 'cargoPapel', 'senioridadeVaga', 'prioridadeDaVaga', 'eixoDeAtuao', 'modalidadeDeContratao', 'ufDeAtuao', 'dataDeIncioPrevista', 'msRefIncioPrevistoVaga', 'previsoDePreenchimento', 'dataDePreenchimento', 'formaDePreenchimento', 'colaboradoraAlocadoa', 'vagaEmAberto', 'vagaAtrasada', 'alocadoNoPrazo', 'dataDeAberturaDaVaga'];
const PERFIL_COLS = ['statusDoPerfil', 'gatilhoDaRealocao', 'gerenteDeOrigem', 'papelDeOrigem', 'senioridadeAtual', 'vnculo', 'ufDeResidncia', 'interesseEmMudarDeCidade', 'dataDeDisponibilidade', 'diasDesalocado1', 'faixaDeDesalocao1', 'perfilReasDeAtuao', 'colaboradoraDestaque', 'linkedin', 'linkCardDePerfilFc10', 'dataDeEncerramentoDoProcesso', 'dataDeIncioNoDestino'];
const PROG_COLS = ['statusProgresso', 'criticidade', 'tipoDeMovimentao', 'motivao', 'projetoReaDeAtuao', 'gerentegestoraResponsvelPelaSolicitao', 'dataDeRecebimentoDoPedido', 'dataDeEnvioParaASupgp', 'decisoDoComitDePessoas', 'dataDeEfetivaoEmFolha'];
const SUB_COLS = ['perfilVinculado', 'rodada', 'resultadoDaRodada', 'statusDoMatch', 'dataDeEnvioDoCard', 'dataDaEntrevista', 'prximaAo', 'pontoFocalResponsvel', 'parecerDoGerenteDeDestino'];

export async function fetchGroup(groupId, cols, withSubs) {
  const all = [];
  let cursor = null;
  do {
    let q = board.items().withColumns(cols);
    if (withSubs) q = q.withSubItems(SUB_COLS);
    if (!cursor) q = q.where({ group: groupId }).orderBy({ column: 'name', direction: 'asc' });
    const res = await q.withPagination(cursor ? { limit: 100, cursor } : { limit: 100 }).execute();
    all.push(...(res.items ?? []));
    cursor = res.cursor;
  } while (cursor);
  return all;
}

export async function fetchHub() {
  const [vagas, perfis, progs, meta, tap] = await Promise.all([
    fetchGroup(GROUP_IDS.vagas, VAGA_COLS, true),
    fetchGroup(GROUP_IDS.perfis, PERFIL_COLS, false),
    fetchGroup(GROUP_IDS.progs, PROG_COLS, false),
    fetchMeta(), // live labels/colors + write permissions (in parallel, never throws)
    fetchTap(), // fim do TAP nos quadros [PLAN] (never throws)
  ]);
  return { vagas, perfis, progs, meta, tap };
}

// Opening items inside monday requires the host bridge — no data queries go through it.
export function openInMonday(id) {
  try { monday.execute('openItemCard', { itemId: Number(id) }); }
  catch (e) { console.error('Falha ao abrir item no monday', e); }
}

const ACCOUNT_URL = 'https://fgvdgpe-projetos.monday.com';

// Each item type opens in its own view of board 18427417720.
export const VIEW_IDS = { vaga: '276490636', perfil: '276490634', prog: '277077482', match: '276510752' };

export function itemUrl(type, id) {
  const view = VIEW_IDS[type];
  return `${ACCOUNT_URL}/boards/${MAIN_BOARD}${view ? `/views/${view}` : ''}/pulses/${id}`;
}

// Navigates to the item inside its board view.
export async function openItemPage(type, id) {
  const url = itemUrl(type, id);
  try { await monday.execute('openLinkInTab', { url }); }
  catch (e) {
    console.error('Falha ao abrir link pelo monday; usando fallback', e);
    window.open(url, '_top');
  }
}

export const toDate = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt) ? null : dt;
};

export const fmtDate = (d) => {
  const dt = toDate(d);
  return dt ? dt.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
};

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const normText = norm;

// "Novembro/2026" → sortable number
export function monthKey(label) {
  const [m, y] = String(label ?? '').split('/');
  const mm = norm(m).trim();
  const idx = mm.length >= 3 ? MONTHS.findIndex((x) => norm(x) === mm || norm(x).startsWith(mm.slice(0, 3))) : -1;
  const year = parseInt(y, 10);
  return idx >= 0 && year ? year * 12 + idx : Number.MAX_SAFE_INTEGER;
}

export const monthLabelOf = (d) => {
  const dt = toDate(d);
  return dt ? `${MONTHS[dt.getUTCMonth()]}/${dt.getUTCFullYear()}` : null;
};

const rodadaNum = (r) => parseInt(String(r ?? '').replace(/\D/g, ''), 10) || 99;
export const byRodada = (a, b) => rodadaNum(a.rodada) - rodadaNum(b.rodada);
