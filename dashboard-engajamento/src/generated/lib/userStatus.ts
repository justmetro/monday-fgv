// Regra única: só contam pessoas com "Status do usuário" exatamente "Ativado"
// (ignorando maiúsculas, acentos e espaços extras). Vazio ou ausente fica fora.
export const ACTIVE_USER_STATUS = 'Ativado';

function norm(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isActivatedStatus(status: string | null | undefined): boolean {
  return norm(status) === norm(ACTIVE_USER_STATUS);
}

/** Conta pessoas únicas (por e-mail, ou nome quando não há e-mail). */
export function countDistinctPeople(rows: { name: string; email: string }[]): number {
  const set = new Set<string>();
  rows.forEach((r) => {
    const e = norm(r.email).replace(/\s/g, '');
    set.add(e.includes('@') ? e : norm(r.name));
  });
  set.delete('');
  return set.size;
}
