// Regra única de "Projeto ativo": só o Status do Projeto abaixo conta.
// A Base guarda TODOS os projetos do Histórico com o status de cada um; o filtro é aplicado só ao ler e mostrar.
export const ACTIVE_PROJECT_STATUSES = ['Em planejamento', 'Em execução', 'Em encerramento'] as const;

/** Versão da regra gravada junto com os projetos (a Base antiga guardou só os ativos pela regra antiga). */
export const PROJECTS_STORE_VERSION = 2;

const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const ACTIVE_SET = new Set<string>(ACTIVE_PROJECT_STATUSES.map(norm));

export function isActiveProjectStatus(status: string | null | undefined): boolean {
  return ACTIVE_SET.has(norm(status));
}

/** Mantém só os projetos ativos (Em planejamento, Em execução, Em encerramento). */
export function filterActiveProjects<T extends { status: string }>(projects: T[] | null | undefined): T[] {
  return (projects ?? []).filter((p) => isActiveProjectStatus(p.status));
}
