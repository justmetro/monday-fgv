import { addMonths, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseIso, type Row } from '@generated/lib/painel';
import { MODALIDADES, contagemVazia, type ContagemModalidade, type Modalidade } from '@generated/lib/negocio';

/** Quinzena = 1ª (dias 1–15) ou 2ª (16 ao fim do mês). Chave 'AAAA-MM-1' | 'AAAA-MM-2'. */
export function quinzenaDe(iso: string | null): string | null {
  const d = parseIso(iso);
  if (!d) return null;
  return `${format(d, 'yyyy-MM')}-${d.getDate() <= 15 ? 1 : 2}`;
}

export type Quinzena = { key: string; label: string; titulo: string };

/** Próximas `n` quinzenas, a partir da quinzena atual. */
export function proximasQuinzenas(n = 12): Quinzena[] {
  const hoje = new Date();
  const out: Quinzena[] = [];
  let mes = startOfMonth(hoje);
  let q = hoje.getDate() <= 15 ? 1 : 2;
  while (out.length < n) {
    const ym = format(mes, 'yyyy-MM');
    const m = format(mes, 'MMM/yy', { locale: ptBR });
    out.push({
      key: `${ym}-${q}`,
      label: `${q}ª ${m}`,
      titulo: `${q}ª quinzena de ${format(mes, "MMMM 'de' yyyy", { locale: ptBR })} (${q === 1 ? '1–15' : '16–fim'})`,
    });
    if (q === 1) q = 2;
    else { q = 1; mes = addMonths(mes, 1); }
  }
  return out;
}

export type DQuinzena = Quinzena & ContagemModalidade & { total: number };

/**
 * Pessoas desmobilizadas por quinzena: cada pessoa entra uma única vez, na quinzena
 * da data final do último projeto dela (maior data de finalização entre os projetos).
 */
export function desmobilizadasPorQuinzena(rows: Row[], n = 12): DQuinzena[] {
  const pessoas = new Map<string, { fim: string; modalidade: Modalidade }>();
  for (const r of rows) {
    if (!r.dataFim || !r.equipe) continue;
    for (const x of r.equipe.atual) {
      if (!x.modalidade) continue;
      const cur = pessoas.get(x.id);
      if (!cur || r.dataFim > cur.fim) pessoas.set(x.id, { fim: r.dataFim, modalidade: x.modalidade });
    }
  }
  const qs = proximasQuinzenas(n);
  const by = new Map(qs.map((q) => [q.key, contagemVazia()]));
  for (const p of pessoas.values()) {
    const c = by.get(quinzenaDe(p.fim) ?? '');
    if (c) c[p.modalidade]++;
  }
  return qs.map((q) => {
    const c = by.get(q.key) ?? contagemVazia();
    return { ...q, ...c, total: MODALIDADES.reduce((s, m) => s + c[m], 0) };
  });
}
