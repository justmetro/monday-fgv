import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db, type VibeDoc } from '@vibe/db/server';
import type { VibeCollection } from '@vibe/db';
import {
  alocAcoes, type AlocAcao, alocAjustes, alocComentarios, alocProjecoes, alocHistorico, alocImportPendentes, alocRegraCapacidade, ACAO_TIPOS, type JsonObj,
} from '@generated/models';
import { autoria, corteRetencao, estavel, json, Registro } from '@generated/server/acoes.server';

const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const COLECOES = new Set([
  alocAjustes.name, alocComentarios.name, alocProjecoes.name, alocHistorico.name, alocImportPendentes.name, alocRegraCapacidade.name,
]);
const AVISO_VALIDACAO = 'O que foi gravado no 02.01 (Gerente, dropdown e Alocação Gerente) não é desfeito — ajuste no monday se necessário.';

/** "Registro de ações": newest first, 25 per page, last 90 days. */
export const listarAcoes = createServerFn({ method: 'GET' })
  .validator(z.object({
    autor: z.string().max(200).optional(),
    tipo: z.enum(ACAO_TIPOS).optional(),
    busca: z.string().max(100).optional(),
    cursor: z.string().max(4000).optional(),
  }))
  .handler(async ({ data }) => {
    // Only 'em' is indexed: the query is always em ≥ cut-off ordered by em, and autor / tipo / busca are
    // applied in memory over whole scanned pages (so no doc is skipped between pages). Scans up to
    // MAX_PAGINAS pages per call; the returned cursor resumes right after the last scanned page.
    // Exactly up to 25 rows per page: each scan asks only for the rows still missing, so the returned
    // cursor resumes right after the last row read (nothing skipped, nothing beyond 25).
    const POR_PAGINA = 25;
    const MAX_PAGINAS = 40;
    const termo = norm(data.busca ?? '');
    const casa = (d: VibeDoc<AlocAcao>) => {
      const x = d.data;
      if (data.autor && x.autor !== data.autor) return false;
      if (data.tipo && x.tipo !== data.tipo) return false;
      if (termo && ![x.descricao, x.autor, x.tipo, ...(x.mudancas ?? []).map((m) => m.alvo)].some((v) => norm(v ?? '').includes(termo))) return false;
      return true;
    };
    const docs: VibeDoc<AlocAcao>[] = [];
    let cursor: string | undefined = data.cursor;
    let fim = false;
    for (let i = 0; i < MAX_PAGINAS && docs.length < POR_PAGINA; i++) {
      let q = db.collection(alocAcoes).where('em', '>=', corteRetencao()).orderBy('em', 'desc').limit(POR_PAGINA - docs.length);
      if (cursor) q = q.startAfter(cursor);
      const page = await q.getPage();
      docs.push(...page.docs.filter(casa));
      cursor = page.cursor ?? undefined;
      if (!cursor) { fim = true; break; }
    }
    const page = { docs, cursor: fim ? null : cursor ?? null };
    return {
      itens: page.docs.map((d) => ({
        id: d.id, tipo: d.data.tipo, descricao: d.data.descricao, autor: d.data.autor, em: d.data.em,
        desfeita: !!d.data.desfeita, desfeitaPor: d.data.desfeitaPor ?? '', desfeitaEm: d.data.desfeitaEm ?? '',
        itens: d.data.itens ?? d.data.mudancas?.length ?? 0,
      })),
      cursor: page.cursor ?? null,
    };
  });

/** People who appear in the log (filter options, whole collection). */
export const autoresAcoes = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const rows = await db.collection(alocAcoes).aggregate().groupBy('autor').count();
    return rows.map((r) => (typeof r.key === 'string' ? r.key : '')).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

/**
 * Undo: restores `antes` of every change (recreates deleted docs, deletes created ones, rewrites changed ones),
 * marks the record as undone and logs "Desfeito: …". When a doc changed afterwards (current ≠ `depois`),
 * returns the conflicts unless `forcar` is set. monday (02.01) is never touched.
 */
export const desfazerAcao = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string().min(1).max(64), forcar: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const a = await autoria();
    const col = db.collection(alocAcoes);
    const doc = await col.doc(data.id).get();
    if (!doc) throw new Error('Registro não encontrado (registros com mais de 90 dias são apagados).');
    if (doc.data.desfeita) throw new Error('Esta ação já foi desfeita.');
    if (doc.data.tipo === 'desfazer') throw new Error('Um registro de desfazer não pode ser desfeito.');
    const ms = (doc.data.mudancas ?? []).filter((m) => COLECOES.has(m.colecao));
    const handle = (nome: string): VibeCollection<JsonObj> => ({ name: nome, indexes: [] });
    const atuais = await Promise.all(ms.map((m) => db.collection(handle(m.colecao)).doc(m.docId).get()));
    const conflitos = [...new Set(ms.filter((m, i) => estavel(json(atuais[i]?.data ?? null)) !== estavel(m.depois)).map((m) => m.alvo))];
    if (conflitos.length && !data.forcar) return { status: 'conflito' as const, conflitos: conflitos.slice(0, 20), acao: null, aviso: null };

    const reg = new Registro(a);
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i];
      if (!m) continue;
      const atual = atuais[i]?.data ?? null;
      if (m.antes === null) await reg.remove(handle(m.colecao), m.docId, m.alvo, atual);
      else await reg.set(handle(m.colecao), m.docId, m.antes, m.alvo, atual);
    }
    await col.doc(doc.id).update({ desfeita: true, desfeitaPor: a.autor, desfeitaEm: a.em });
    const acao = await reg.salvar('desfazer', `Desfeito: ${doc.data.descricao}`, { itens: doc.data.itens, desfazDe: doc.id });
    return { status: 'ok' as const, conflitos: [], acao, aviso: doc.data.tipo === 'validar' ? AVISO_VALIDACAO : null };
  });

/** Logs "Gerar relatório" (no data changed — nothing to undo); shows up in the Registro de ações. */
export const registrarRelatorio = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ descricao: z.string().min(1).max(600), itens: z.number().int().min(0).max(5000) }).parse(d))
  .handler(async ({ data }) => {
    const a = await autoria();
    const col = db.collection(alocAcoes);
    const doc = await col.add({
      lote: globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      tipo: 'relatorio', descricao: data.descricao, ...a,
      desfeita: false, desfeitaPor: '', desfeitaEm: '', itens: data.itens, mudancas: [],
    });
    return { id: doc.id };
  });
