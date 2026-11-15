import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { snapshotsSemanais } from '@generated/models';

const metricas = z.object({
  semana: z.string().regex(/^\d{4}-W\d{2}$/),
  inicioSemana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emPlanejamento: z.number().int().min(0).max(100000),
  pctNoPrazo: z.number().min(0).max(100).nullable(),
  saldoTotal: z.number().finite(),
  saldoInsumo: z.number().finite(),
  saldoEquipe: z.number().finite(),
  mediaAtivosPorGerente: z.number().min(0).max(1000).nullable(),
});

/** Every weekly snapshot (oldest first; small collection — one doc per week). */
export const listarSnapshots = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const out = [];
    let page = await db.collection(snapshotsSemanais).orderBy('semana', 'asc').limit(200).getPage();
    out.push(...page.docs);
    for (let i = 0; page.cursor && i < 10; i++) {
      page = await db.collection(snapshotsSemanais).orderBy('semana', 'asc').limit(200).startAfter(page.cursor).getPage();
      out.push(...page.docs);
    }
    return out.map((d) => d.data);
  });

/** Upserts the current week's snapshot (the latest reading of the week wins). */
export const gravarSnapshot = createServerFn({ method: 'POST' })
  .validator((d: unknown) => metricas.parse(d))
  .handler(async ({ data }) => {
    const col = db.collection(snapshotsSemanais);
    const [atual, ...extras] = await col.where('semana', '==', data.semana).get();
    await Promise.all(extras.map((e) => col.doc(e.id).delete()));
    const doc = { ...data, em: new Date().toISOString() };
    if (atual) await col.doc(atual.id).set(doc);
    else await col.add(doc);
    return { ok: true };
  });
