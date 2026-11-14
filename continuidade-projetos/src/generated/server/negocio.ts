import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { fatoresCusto, perspectivasRenovacao, statusCatOpcoes, type FatoresCusto, type PerspectivaRenovacao, type StatusCatOpcoes } from '@generated/models';
import { STATUS_CAT_PADRAO } from '@generated/lib/extras';
import { usuarioAtual } from '@generated/server/log.server';
import { NIVEIS_PERSPECTIVA, TEMPERATURAS, TIPOS_PERSPECTIVA } from '@generated/lib/negocio';

/** Dados guardados só no app (nenhum quadro do monday é alterado). */

export const getFatores = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const docs = await db.collection(fatoresCusto).limit(5).get();
    const ultimo = [...docs].sort((a, b) => (b.data.at ?? '').localeCompare(a.data.at ?? ''))[0];
    return { fatores: ultimo ? ultimo.data : null };
  });

const fator = z.number().finite().min(0).max(10);

export const salvarFatores = createServerFn({ method: 'POST' })
  .validator(z.object({ clt: fator, bolsa: fator, estagio: fator, rpaFixo: fator }))
  .handler(async ({ data }) => {
    const user = await usuarioAtual();
    const doc: FatoresCusto = { ...data, user, at: new Date().toISOString() };
    const col = db.collection(fatoresCusto);
    const existentes = await col.limit(5).get();
    const [primeiro, ...extras] = existentes;
    if (primeiro) await col.doc(primeiro.id).set(doc);
    else await col.add(doc);
    for (const d of extras) await col.doc(d.id).delete();
    return doc;
  });

export type PerspectivaDoc = PerspectivaRenovacao & { id: string };

export const getPerspectivas = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const out: PerspectivaDoc[] = [];
    let cursor: string | undefined;
    let guard = 0;
    do {
      const q = cursor ? db.collection(perspectivasRenovacao).startAfter(cursor) : db.collection(perspectivasRenovacao);
      const page = await q.getPage();
      for (const d of page.docs) out.push({ ...d.data, id: d.id });
      cursor = page.cursor;
      guard++;
    } while (cursor && guard < 50);
    out.sort((a, b) => b.at.localeCompare(a.at));
    return { items: out };
  });

export const salvarPerspectiva = createServerFn({ method: 'POST' })
  .validator(z.object({
    projectId: z.string().min(1).max(40),
    nivel: z.enum(NIVEIS_PERSPECTIVA).nullable(),
    temperatura: z.enum(TEMPERATURAS).nullable().optional(),
    tipo: z.enum(TIPOS_PERSPECTIVA).nullable().optional(),
    report: z.string().max(5000),
  }))
  .handler(async ({ data }) => {
    const user = await usuarioAtual();
    const doc: PerspectivaRenovacao = { projectId: data.projectId, nivel: data.nivel, temperatura: data.temperatura ?? null, tipo: data.tipo ?? null, report: data.report.trim(), user, at: new Date().toISOString() };
    const created = await db.collection(perspectivasRenovacao).add(doc);
    return { ...doc, id: created.id } as PerspectivaDoc;
  });

/** Opções do campo "Status" (categorização); sem registro, valem as opções padrão. */
export const getStatusOpcoes = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const docs = await db.collection(statusCatOpcoes).limit(1).get();
    const o = docs[0]?.data.opcoes;
    return { opcoes: o && o.length ? o : STATUS_CAT_PADRAO };
  });

export const salvarStatusOpcoes = createServerFn({ method: 'POST' })
  .validator(z.object({ opcoes: z.array(z.string().trim().min(1).max(60)).min(1).max(30) }))
  .handler(async ({ data }) => {
    const opcoes = [...new Set(data.opcoes.map((x) => x.trim()))];
    const doc: StatusCatOpcoes = { opcoes, user: await usuarioAtual(), at: new Date().toISOString() };
    const col = db.collection(statusCatOpcoes);
    const existentes = await col.limit(5).get();
    const [primeiro, ...extras] = existentes;
    if (primeiro) await col.doc(primeiro.id).set(doc);
    else await col.add(doc);
    for (const d of extras) await col.doc(d.id).delete();
    return { opcoes };
  });
