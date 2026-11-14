import { GROUP_IDS, board } from '@generated/lib/data';
import { COLORS, LABEL_INDEX } from '@generated/lib/colors';
import { MAIN_BOARD, SUB_BOARD, WRITE_COL_IDS, writeColumn } from '@generated/lib/boardMeta';
import { canon, normKey } from '@generated/lib/normalize';

// The ONLY fields the app may write. Everything else stays read-only.
export const EDITABLE = {
  match: { rodada: 'status', resultadoDaRodada: 'status', statusDoMatch: 'status', prximaAo: 'text', dataDaEntrevista: 'date', dataDeEnvioDoCard: 'date' },
  vaga: { statusDaVaga: 'status', prioridadeDaVaga: 'status', dataDeIncioPrevista: 'date' },
  perfil: { statusDoPerfil: 'status' },
};

export const FIELD_LABEL = {
  rodada: 'Rodada', resultadoDaRodada: 'Resultado da Rodada', statusDoMatch: 'Status do Match', prximaAo: 'Próxima Ação',
  dataDaEntrevista: 'Data da Entrevista', dataDeEnvioDoCard: 'Data de Envio do Card', statusDaVaga: 'Status da Vaga',
  prioridadeDaVaga: 'Prioridade da Vaga', dataDeIncioPrevista: 'Data de Início Prevista', statusDoPerfil: 'Status do Perfil',
};

export const SENSITIVE = {
  statusDaVaga: ['Preenchida', 'Cancelada'],
  statusDoPerfil: ['Realocado(a)', 'Desligado(a)', 'Encaminhado(a) para desligamento'],
};

export function kindOf(fieldKey, item) {
  if (!item) return null;
  if (item._isMatch) return EDITABLE.match[fieldKey] ? 'match' : null;
  const g = item.group?.id;
  if (EDITABLE.vaga[fieldKey] && (g === GROUP_IDS.vagas || (!g && 'statusDaVaga' in item))) return 'vaga';
  if (EDITABLE.perfil[fieldKey] && (g === GROUP_IDS.perfis || (!g && 'statusDoPerfil' in item))) return 'perfil';
  return null;
}

// Exact board labels for a status column (live from the board; fallback list otherwise).
export const optionsFor = (fieldKey) => Object.keys(COLORS[fieldKey] ?? {});
export function rawLabel(fieldKey, display) {
  if (display == null) return null;
  return optionsFor(fieldKey).find((k) => normKey(canon(k)) === normKey(display)) ?? display;
}

export const isSensitive = (fieldKey, value) => (SENSITIVE[fieldKey] ?? []).some((l) => normKey(l) === normKey(value));

const isoDay = (d) => { const dt = d instanceof Date ? d : new Date(d); return isNaN(dt) ? null : dt.toISOString().slice(0, 10); };

function encode(kind, key, value) {
  const type = EDITABLE[kind][key];
  // Clearing: empty text, or null for status/date (removes the label/date in monday).
  if (value == null || value === '') return type === 'text' ? '' : null;
  if (type === 'status') {
    const idx = LABEL_INDEX[key]?.[value];
    return idx != null ? { index: idx } : { label: value }; // index when known, otherwise the exact label
  }
  if (type === 'date') return { date: isoDay(value) };
  return String(value);
}

// Writes one column. Subitems always go to their own board (18427418240), never via the parent.
export async function persist(kind, item, key, value) {
  const boardId = kind === 'match' ? (item._boardId ?? SUB_BOARD) : MAIN_BOARD;
  try {
    return await writeColumn({ boardId, itemId: item.id, columnId: WRITE_COL_IDS[kind][key], value: encode(kind, key, value) });
  } catch (e) {
    if (isPermissionError(e)) throw e;
    // Fallback: same write through the board SDK (exact label text).
    console.warn('Gravação direta falhou; tentando pelo SDK do quadro', e);
    if (kind === 'match') {
      if (item._vagaId == null) throw e;
      return board.item(item._vagaId).subitem(item.id).update({ [key]: value }).execute();
    }
    return board.item(item.id).update({ [key]: value }).execute();
  }
}

export const sameValue = (a, b) => {
  const n = (v) => {
    if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
    if (v == null || v === '') return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    return v;
  };
  return n(a) === n(b);
};

export const isPermissionError = (e) => /permiss|not allowed|unauthori|forbidden|read.?only|view.?only/i.test(String(e?.message ?? e));
