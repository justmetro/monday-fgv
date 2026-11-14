import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { equipeAjustes, logApp, type EquipeAjuste } from '@generated/models';
import { usuarioAtual } from '@generated/server/log.server';
import { mudancaSchema, type LogEntry } from '@generated/lib/logCampos';

/** Ajustes manuais de equipe guardados no app (nunca gravados no monday). */
export const getAjustes = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const out: EquipeAjuste[] = [];
    let cursor: string | undefined;
    let guard = 0;
    do {
      const q = cursor ? db.collection(equipeAjustes).startAfter(cursor) : db.collection(equipeAjustes);
      const page = await q.getPage();
      for (const d of page.docs) out.push({ ...d.data, campos: d.data.campos ?? [] });
      cursor = page.cursor;
      guard++;
    } while (cursor && guard < 50);
    return { items: out };
  });

/** Define o ajuste de equipe do projeto (override vazio remove) e registra no histórico do app. */
export const salvarAjusteEquipe = createServerFn({ method: 'POST' })
  .validator(z.object({
    projectId: z.string().min(1),
    projectName: z.string().min(1).max(500),
    override: z.object({
      nClt: z.number().int().min(0).max(10000).nullable().optional(),
      custoMensal: z.number().finite().min(0).nullable().optional(),
    }),
    changes: z.array(mudancaSchema).min(1).max(4),
    acao: z.enum(['alteracao', 'reversao']),
    ref: z.string().nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const user = await usuarioAtual();
    const at = new Date().toISOString();
    const col = db.collection(equipeAjustes);
    const existentes = await col.where('projectId', '==', data.projectId).get();
    const campos = (['nClt', 'custoMensal'] as const).filter((k) => data.override[k] !== undefined);
    let ajuste: EquipeAjuste | null = null;
    if (campos.length === 0) {
      for (const d of existentes) await col.doc(d.id).delete();
    } else {
      ajuste = { projectId: data.projectId, campos, user, at };
      for (const k of campos) Object.assign(ajuste, { [k]: data.override[k] ?? null });
      const [primeiro, ...extras] = existentes;
      if (primeiro) await col.doc(primeiro.id).set(ajuste);
      else await col.add(ajuste);
      for (const d of extras) await col.doc(d.id).delete();
    }
    const logDoc = await db.collection(logApp).add({
      projectId: data.projectId, projectName: data.projectName, user, at, acao: data.acao,
      ref: data.ref ?? null, changesJson: JSON.stringify(data.changes),
    });
    const log: LogEntry = {
      id: logDoc.id, itemId: '', projectId: data.projectId, projectName: data.projectName, user, at,
      acao: data.acao, ref: data.ref ?? null, changes: data.changes, origem: 'app',
    };
    return { ajuste, log };
  });
