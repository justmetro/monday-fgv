/** Normalized person name for matching: no accents, lowercase, single spaces. */
export function normNome(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Filter value meaning "Ponto Focal column is empty". */
export const SEM_PONTO_FOCAL = '__sem_ponto_focal__';
