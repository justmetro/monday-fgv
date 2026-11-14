import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { loadProjectRisks, parseGrau } from '@generated/data/risks.server';
import { LIMITE_CRITICO } from '@generated/lib/config';

type Count = { label: string; total: number };

function tally(values: (string | null | undefined)[], empty: string): Count[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = v && v.trim() ? v.trim() : empty;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, total]) => ({ label, total }));
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    console.error('Agregação falhou; usando contagem do conjunto carregado', e);
    return null;
  }
}

/** Resumo do projeto: contagens por agregação; nível/críticos/pendências a partir do conjunto completo (fórmulas). */
export const getProjectSummary = createServerFn({ method: 'GET' })
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Agg = { [k: string]: any; total?: number }[] | null;
    const none = Promise.resolve(null as Agg);
    const [aplicAgg, catAgg, catAplicAgg, tratAgg, all] = await Promise.all([none, none, none, none, loadProjectRisks(data.projectId)]);

    const items = all.items;
    const aplicaveis = items.filter((i) => i.aplicabilidade === 'Aplicável');

    const aplicabilidade: Count[] = aplicAgg
      ? aplicAgg.map((r) => ({ label: r.aplicabilidade || 'Identificado', total: r.total ?? 0 }))
      : tally(items.map((i) => i.aplicabilidade), 'Identificado');
    const categoriaTodos: Count[] = catAgg
      ? catAgg.map((r) => ({ label: r.categoria || 'Sem categoria', total: r.total ?? 0 }))
      : tally(items.flatMap((i) => (i.categoria?.length ? i.categoria : [null])), 'Sem categoria');
    const categoriaAplic: Count[] = catAplicAgg
      ? catAplicAgg.map((r) => ({ label: r.categoria || 'Sem categoria', total: r.total ?? 0 }))
      : tally(aplicaveis.flatMap((i) => (i.categoria?.length ? i.categoria : [null])), 'Sem categoria');
    const tratamento: Count[] = tratAgg
      ? tratAgg.map((r) => ({ label: r.statusDoTratamento || 'Sem status', total: r.total ?? 0 }))
      : tally(aplicaveis.map((i) => i.statusDoTratamento), 'Sem status');

    const criticos = items
      .filter((i) => i.aplicabilidade !== 'Não aplicável')
      .filter((i) => (parseGrau(i.grauDeRisco) ?? -1) >= LIMITE_CRITICO)
      .sort((a, b) => (parseGrau(b.grauDeRisco) ?? 0) - (parseGrau(a.grauDeRisco) ?? 0))
      .map((i) => ({
        id: i.id,
        name: i.name,
        idDoRisco: i.idDoRisco,
        grauDeRisco: i.grauDeRisco,
        nvelDeRisco: i.nvelDeRisco,
        aplicabilidade: i.aplicabilidade,
        statusDoTratamento: i.statusDoTratamento,
        semEstrategia: !i.estratgia,
        semResponsavel: !(i.responsvelPeloMonitoramento?.length ?? 0),
        semPrazo: !i.prazo,
        semPlano: !i.respostaPlanoDeAo?.trim(),
      }));

    return {
      total: items.length,
      truncated: all.truncated,
      aplicabilidade,
      nivelTodos: tally(items.map((i) => i.nvelDeRisco), 'Sem nível'),
      nivelAplic: tally(aplicaveis.map((i) => i.nvelDeRisco), 'Sem nível'),
      categoriaTodos,
      categoriaAplic,
      tratamento,
      pendencias: {
        semEstrategia: aplicaveis.filter((i) => !i.estratgia).length,
        semResponsavel: aplicaveis.filter((i) => !(i.responsvelPeloMonitoramento?.length ?? 0)).length,
        semPrazo: aplicaveis.filter((i) => !i.prazo).length,
        semPlano: aplicaveis.filter((i) => !i.respostaPlanoDeAo?.trim()).length,
      },
      criticos,
    };
  });
