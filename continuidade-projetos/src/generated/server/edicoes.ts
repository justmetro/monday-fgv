import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { logApp, produtoEdicoes, type ProdutoEdicao } from '@generated/models';
import { usuarioAtual } from '@generated/server/log.server';
import { mudancaSchema, type LogEntry, type Mudanca } from '@generated/lib/logCampos';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Todas as edições de produto guardadas no app (nenhuma é gravada no monday). */
export const getEdicoes = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const out: ProdutoEdicao[] = [];
    let cursor: string | undefined;
    let guard = 0;
    do {
      const q = cursor ? db.collection(produtoEdicoes).startAfter(cursor) : db.collection(produtoEdicoes);
      const page = await q.getPage();
      for (const d of page.docs) out.push({ ...d.data, campos: d.data.campos ?? [] });
      cursor = page.cursor;
      guard++;
    } while (cursor && guard < 50);
    return { items: out };
  });

function toEntry(id: string, d: { projectId: string; projectName: string; user: string; at: string; acao: 'alteracao' | 'reversao'; ref: string | null; changesJson: string }): LogEntry {
  let changes: Mudanca[] = [];
  try {
    const parsed = z.array(mudancaSchema).safeParse(JSON.parse(d.changesJson));
    if (parsed.success) changes = parsed.data;
  } catch {
    /* registro inválido */
  }
  return { id, itemId: '', projectId: d.projectId, projectName: d.projectName, user: d.user, at: d.at, acao: d.acao, ref: d.ref ?? null, changes, origem: 'app' };
}

/** Histórico das edições feitas no app. */
export const getLogsApp = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const out: LogEntry[] = [];
    let cursor: string | undefined;
    let guard = 0;
    do {
      const q = cursor ? db.collection(logApp).startAfter(cursor) : db.collection(logApp);
      const page = await q.getPage();
      for (const d of page.docs) out.push(toEntry(d.id, d.data));
      cursor = page.cursor;
      guard++;
    } while (cursor && guard < 50);
    return { items: out.filter((e) => e.changes.length > 0) };
  });

/**
 * Define a edição de um produto (substitui a anterior). `override` vazio remove a edição (volta ao valor do monday).
 * Registra a mudança no histórico do app. Nenhum quadro do monday é alterado.
 */
export const salvarEdicaoProduto = createServerFn({ method: 'POST' })
  .validator(z.object({
    produtoId: z.string().min(1),
    projectId: z.string().min(1),
    projectName: z.string().min(1).max(500),
    override: z.object({
      prazo: z.string().regex(ISO).nullable().optional(),
      atraso: z.string().max(100).nullable().optional(),
      status: z.string().max(100).nullable().optional(),
      valor: z.number().finite().nullable().optional(),
    }),
    changes: z.array(mudancaSchema).min(1).max(10),
    acao: z.enum(['alteracao', 'reversao']),
    ref: z.string().nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const user = await usuarioAtual();
    const at = new Date().toISOString();
    const col = db.collection(produtoEdicoes);
    const existentes = await col.where('produtoId', '==', data.produtoId).get();
    const campos = (['prazo', 'atraso', 'status', 'valor'] as const).filter((k) => k in data.override && data.override[k] !== undefined);
    let edicao: ProdutoEdicao | null = null;
    if (campos.length === 0) {
      for (const d of existentes) await col.doc(d.id).delete();
    } else {
      edicao = { produtoId: data.produtoId, projectId: data.projectId, campos, user, at };
      for (const k of campos) Object.assign(edicao, { [k]: data.override[k] ?? null });
      const [primeiro, ...extras] = existentes;
      if (primeiro) await col.doc(primeiro.id).set(edicao);
      else await col.add(edicao);
      for (const d of extras) await col.doc(d.id).delete();
    }
    const logDoc = await db.collection(logApp).add({
      projectId: data.projectId, projectName: data.projectName, user, at, acao: data.acao,
      ref: data.ref ?? null, changesJson: JSON.stringify(data.changes),
    });
    return { edicao, log: toEntry(logDoc.id, logDoc.data) };
  });
