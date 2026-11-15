/** Single source for every monday link in the app — always the account domain, never the generic one. */
export const MONDAY_BASE = 'https://fgvdgpe-projetos.monday.com';
/** Quadro 02.01 Projetos em Planejamento. */
export const BOARD_ID = '18412010674';
/** Quadro Mapa de Gerentes de Projeto (read-only in the app). */
export const MAPA_BOARD_ID = '18422833691';

export const urlQuadro = (boardId: string = BOARD_ID) => `${MONDAY_BASE}/boards/${boardId}`;
export const urlItem = (id: string, boardId: string = BOARD_ID) => `${MONDAY_BASE}/boards/${boardId}/pulses/${id}`;

/** Rewrites https://monday.com/ or https://www.monday.com/ (from column values) to the account domain. */
export function normalizarUrlMonday(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  return u.replace(/^https?:\/\/(www\.)?monday\.com(?=\/|$)/i, MONDAY_BASE);
}
