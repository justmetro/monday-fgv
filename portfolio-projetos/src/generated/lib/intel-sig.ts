import type { IndicatorDoc } from '@generated/models';

/** Campos usados na classificação temática (desempenho NÃO entra). */
export function classText(i: IndicatorDoc) {
  return {
    nome: i.name, descricao: i.descricao, objetivo: i.objetivo, unidade: i.unidade,
    formula: i.formula, tipo: i.tipo, temporalidade: i.temporalidade, polaridade: i.polaridade,
  };
}

/** Assinatura determinística (hash djb2) dos textos relevantes. */
export function signatureOf(i: IndicatorDoc): string {
  const s = JSON.stringify(classText(i));
  let h = 5381;
  for (let x = 0; x < s.length; x++) h = ((h << 5) + h + s.charCodeAt(x)) | 0;
  return `v1-${(h >>> 0).toString(36)}-${s.length}`;
}

export const ikey = (boardId: string, itemId: string) => `${boardId}:${itemId}`;

/** Data de referência no fuso America/Fortaleza (YYYY-MM-DD). */
export function refDateFortaleza(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
