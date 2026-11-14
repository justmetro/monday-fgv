import type { StoredProjectItem } from '@generated/models';

// Valor usado na tabela de-para para equipes administrativas
export const NOT_A_PROJECT_FLAG = 'Não é projeto';

/** Ignora maiúsculas, acentos e espaços extras */
export function normalizeName(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Verifica se o nome da equipe possui algo entre colchetes (ex: "[BR | GIZ | MMA] Plano clima", "[MA] SEMAG") */
export function hasBracketPrefix(teamName: string | null | undefined): boolean {
  if (!teamName) return false;
  return /\[[^\]]+\]/.test(teamName);
}

/** Conjunto de nomes conhecidos (chaves do de-para, nomes e SGIs dos projetos), já normalizados */
export function buildKnownTeamNames(
  projects: StoredProjectItem[],
  deParaTable: Record<string, string>
): Set<string> {
  const known = new Set<string>();
  Object.keys(deParaTable).forEach((k) => known.add(normalizeName(k)));
  projects.forEach((p) => {
    if (p.name) known.add(normalizeName(p.name));
    if (p.sgi) known.add(normalizeName(p.sgi));
  });
  return known;
}

/**
 * Separa a célula Equipe nas equipes componentes:
 * - Divide por vírgulas, ponto-e-vírgula e quebras de linha;
 * - Ignora vírgulas que estejam DENTRO de colchetes (ex: "[BR | GIZ, MMA] Plano clima");
 * - Usa o nome completo de cada equipe, sem cortar nada.
 */
export function splitTeams(raw: string | null | undefined, _known?: Set<string>): string[] {
  if (!raw) return [];

  const results: string[] = [];
  let current = '';
  let bracketDepth = 0;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (char === '[') {
      bracketDepth++;
      current += char;
    } else if (char === ']') {
      if (bracketDepth > 0) bracketDepth--;
      current += char;
    } else if (bracketDepth === 0 && (char === ',' || char === ';' || char === '\n' || char === '\r')) {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !results.includes(trimmed)) {
        results.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const lastTrimmed = current.trim();
  if (lastTrimmed.length > 0 && !results.includes(lastTrimmed)) {
    results.push(lastTrimmed);
  }

  return results;
}

/**
 * Liga uma equipe a um projeto ativo:
 * 1. Uma equipe só pode ser projeto se tiver algo entre colchetes. Sem colchetes, nunca é projeto (não casa e não é erro).
 * 2. Se tiver colchetes:
 *    - Primeiro procura na tabela de-para (igualdade normalizada);
 *    - Se não achar no de-para, procura por igualdade com o Nome ou SGI de um projeto ativo.
 */
export function matchTeamToActiveProject(
  teamName: string,
  activeProjects: StoredProjectItem[],
  deParaTable: Record<string, string>
): {
  project: StoredProjectItem | null;
  isIgnored: boolean; // Marcada explicitamente como "Não é projeto" no de-para
  isBracketCandidate: boolean; // Possui colchetes e é candidata a projeto
} {
  const isBracket = hasBracketPrefix(teamName);
  if (!isBracket) {
    // Equipes sem colchetes nunca são projeto e não entram na lista de pendências
    return { project: null, isIgnored: false, isBracketCandidate: false };
  }

  const normTeam = normalizeName(teamName);
  if (!normTeam) {
    return { project: null, isIgnored: false, isBracketCandidate: true };
  }

  // 1. Procura na tabela de-para
  const key = Object.keys(deParaTable).find((k) => normalizeName(k) === normTeam);
  if (key !== undefined) {
    const target = deParaTable[key] ?? '';
    if (normalizeName(target) === normalizeName(NOT_A_PROJECT_FLAG)) {
      return { project: null, isIgnored: true, isBracketCandidate: true };
    }
    const found = activeProjects.find((p) => normalizeName(p.name) === normalizeName(target));
    if (found) return { project: found, isIgnored: false, isBracketCandidate: true };
  }

  // 2. Procura por igualdade com o Nome do projeto ativo
  const byName = activeProjects.find((p) => normalizeName(p.name) === normTeam);
  if (byName) return { project: byName, isIgnored: false, isBracketCandidate: true };

  // 3. Procura por igualdade com o SGI do projeto ativo
  const bySgi = activeProjects.find((p) => p.sgi && normalizeName(p.sgi) === normTeam);
  if (bySgi) return { project: bySgi, isIgnored: false, isBracketCandidate: true };

  return { project: null, isIgnored: false, isBracketCandidate: true };
}
