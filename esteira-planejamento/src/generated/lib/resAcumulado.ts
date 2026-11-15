import { type Projeto, toDate } from '@generated/lib/format';
import { normNome } from '@generated/lib/nomes';

/**
 * "Res. Acumulado" — the same filter as the widget of the monday dashboard on board 02.01:
 * - Tipo Planejamento ≠ "Antigo Sem Planejamento" / "Planejamento antigo";
 * - Status Planejamento ≠ Novo Cadastro (30–45 / 45–60), Pausado, Despriorizado, Sem planejamento;
 * - Início Planejamento between 01/01 and 15/12 of the year (inclusive);
 * - Conclusão do Planejamento on or before 31/12 of the year.
 * The monday date filter "on or before" never matches an empty date, so projects without Conclusão do Planejamento
 * are left out there too (that is how the dashboard reaches its number). They are not dropped silently here:
 * they come back in `semConclusao` (and those without Início in `semInicio`) so the UI can show the count and why.
 * The caller passes the items already cut by the top filters (FilterBar), with Finalizados always included.
 */
const TIPOS_FORA = ['antigo sem planejamento', 'planejamento antigo'];
const STATUS_FORA = ['Novo Cadastro - 30 a 45 dias', 'Novo Cadastro - 45 a 60 dias', 'Pausado', 'Despriorizado', 'Sem planejamento', 'Sem planejamento [ANTIGOS]'];

export interface ResAcumulado {
  ano: number;
  items: Projeto[];
  /** Início Planejamento inside the window, but Conclusão do Planejamento empty. */
  semConclusao: Projeto[];
  /** Conclusão do Planejamento in the year, but Início Planejamento empty. */
  semInicio: Projeto[];
}

export const elegivelResAcumulado = (p: Projeto) =>
  !(p.tipoPlanejamento ?? []).some((t) => TIPOS_FORA.includes(normNome(t))) &&
  !(p.statusPlanejamento && STATUS_FORA.includes(p.statusPlanejamento));

/** `ate` (optional) narrows the window to dates up to that day — used by the monthly report (accumulated up to the month). */
export function baseResAcumulado(items: Projeto[], ano: number, ate?: Date): ResAcumulado {
  const iniJanela = new Date(ano, 0, 1);
  const fimInicio = new Date(ano, 11, 15);
  const fimConclusao = new Date(ano, 11, 31);
  const limIni = ate && ate < fimInicio ? ate : fimInicio;
  const limConc = ate && ate < fimConclusao ? ate : fimConclusao;
  const out: ResAcumulado = { ano, items: [], semConclusao: [], semInicio: [] };
  for (const p of items) {
    if (!elegivelResAcumulado(p)) continue;
    const ini = toDate(p.incioPlanejamento);
    const conc = toDate(p.conclusoDoPlanejamento);
    if (!ini) {
      if (conc && conc >= iniJanela && conc <= limConc) out.semInicio.push(p);
      continue;
    }
    if (ini < iniJanela || ini > limIni) continue;
    if (!conc) { out.semConclusao.push(p); continue; }
    if (conc <= limConc) out.items.push(p);
  }
  return out;
}

/** Text of the (i): the rule + how many projects were left out because of missing data. */
export function regraResAcumulado(r: ResAcumulado): string {
  const fora = [
    r.semConclusao.length ? `${r.semConclusao.length} com Início Planejamento no ano e sem Conclusão do Planejamento` : null,
    r.semInicio.length ? `${r.semInicio.length} com Conclusão do Planejamento no ano e sem Início Planejamento` : null,
  ].filter(Boolean);
  return `Base “Res. Acumulado” ${r.ano} (mesmo filtro do dashboard da monday): Tipo Planejamento diferente de “Antigo Sem Planejamento” e “Planejamento antigo”; Status Planejamento diferente de Novo Cadastro, Pausado, Despriorizado e Sem planejamento; Início Planejamento entre 01/01 e 15/12/${r.ano}; Conclusão do Planejamento até 31/12/${r.ano}. Finalizados sempre entram; os demais filtros do topo são aplicados. ${r.items.length} projeto(s) na base.${fora.length ? ` Fora por dado faltando: ${fora.join('; ')}.` : ''}`;
}

/** Month (1–12) of "Mês Referência Resultado" ("11.Novembro" → 11); null for N/A or empty. */
export function mesReferencia(p: Projeto): number | null {
  const m = /^(\d{1,2})\./.exec(p.msRefernciaResultado ?? '');
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 12 ? n : null;
}
