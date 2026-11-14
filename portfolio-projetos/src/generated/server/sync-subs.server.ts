import { db } from '@vibe/db/server';
import { projects, scheduleSubitems, syncLogs } from '@generated/models';
import type { ScheduleSubitemDoc } from '@generated/models';
import type { ProjectConfig } from '@generated/lib/fields';
import { fetchBoardStructure, fetchSubitemsOf, listGroupItemIds } from './monday.server';
import { idsOf, toSubitem } from './extract-ops.server';
import { flagSchedule } from './flags-ops.server';
import { findProject, inChunks, loadWhere, parseGroupSync, retry, strip, type GroupSync } from './sync.server';

/** Atividades por parte: cada requisição lê e grava só os subelementos dessas atividades. */
export const SUB_PART = 40;

/**
 * Subelementos do Cronograma em partes (uma requisição por fatia de atividades), para nunca exceder o
 * tempo limite. Cada parte é consistente: lê tudo da fatia antes de gravar, faz upsert por (pai, item) e
 * inativa os subelementos que sumiram dessas atividades. A última parte inativa os de atividades removidas
 * e atualiza contador e status do grupo. Uma falha preserva os dados das partes não processadas.
 */
export async function syncSubitemsPart(boardId: string, cfgOverride: ProjectConfig | null, offset: number) {
  const proj = await findProject(boardId);
  const cfg = cfgOverride ?? (proj?.data.config ? (JSON.parse(proj.data.config) as ProjectConfig) : null);
  const prevSync: GroupSync = parseGroupSync(proj?.data.groupSync);
  const at = () => new Date().toISOString();
  const saveSync = async (gs: GroupSync, extra: Record<string, unknown> = {}) => {
    if (proj) await db.collection(projects).doc(proj.id).update({ groupSync: JSON.stringify(gs), ...extra });
  };
  try {
    if (!cfg?.scheduleGroupId || !cfg.importSubitems) {
      await saveSync({ ...prevSync, sub: { status: 'off', message: 'Subelementos não importados', at: at() } });
      return { ok: true as const, summary: 'Subelementos não importados.', next: null, total: 0 };
    }
    const subCols = idsOf(cfg.subitemCols);
    if (offset === 0) {
      // Validação só na primeira parte (estrutura do quadro de subitens).
      const board = await fetchBoardStructure(boardId);
      if (!board.subitemBoardId) throw new Error('Este quadro não tem subelementos configurados. Desmarque "Importar subelementos" no mapeamento.');
      const sc = new Set(board.subitemColumns.map((c) => c.id));
      const miss = subCols.filter((c) => !sc.has(c));
      if (miss.length) throw new Error(`Colunas de subelementos não encontradas: ${miss.join(', ')}. Refaça o mapeamento.`);
    }
    const t0 = Date.now();
    const all = await listGroupItemIds(boardId, cfg.scheduleGroupId);
    const slice = all.slice(offset, offset + SUB_PART);
    const byParent = await fetchSubitemsOf(slice, subCols);
    const now = at();
    const today = now.slice(0, 10);
    const news = slice.flatMap((pid) => (byParent.get(pid) ?? []).map((s) => flagSchedule<ScheduleSubitemDoc>(toSubitem(s, pid, boardId, cfg, now), cfg, today, now)));
    console.info('[sync-sub] leitura', { boardId, offset, parents: slice.length, subs: news.length, ms: Date.now() - t0 });

    const olds = await loadWhere<ScheduleSubitemDoc>(scheduleSubitems, 'projectBoardId', boardId);
    const key = (x: { parentItemId: string; itemId: string }) => `${x.parentItemId}:${x.itemId}`;
    const byKey = new Map(olds.map((d) => [key(d.data), d]));
    const seen = new Set<string>();
    const st = { novos: 0, atualizados: 0, inativados: 0 };
    await inChunks(news, async (n) => {
      const k = key(n);
      seen.add(k);
      const ex = byKey.get(k);
      if (!ex) { st.novos++; await retry(() => db.collection(scheduleSubitems).add(n)); return; }
      if (strip(ex.data) === strip(n)) return;
      st.atualizados++;
      await retry(() => db.collection(scheduleSubitems).doc(ex.id).set(n));
    }, 12);
    const inSlice = new Set(slice);
    const isLast = offset + SUB_PART >= all.length;
    const allSet = new Set(all);
    const gone = olds.filter((d) => d.data.active && !seen.has(key(d.data)) && (inSlice.has(d.data.parentItemId) || (isLast && !allSet.has(d.data.parentItemId))));
    st.inativados = gone.length;
    await inChunks(gone, (d) => retry(() => db.collection(scheduleSubitems).doc(d.id).update({ active: false })), 12);

    const done = Math.min(offset + SUB_PART, all.length);
    const summary = `Atividades ${offset + 1}–${done} de ${all.length}: ${news.length} subelementos lidos · ${st.novos} novos · ${st.atualizados} atualizados · ${st.inativados} inativados`;
    if (isLast) {
      const active = await db.collection(scheduleSubitems).where('projectBoardId', '==', boardId).where('active', '==', true).count();
      const msg = `${active} subelementos ativos (leitura em ${Math.ceil(all.length / SUB_PART) || 1} parte(s))`;
      await saveSync({ ...prevSync, sub: { status: 'ok', message: msg, at: at() } }, { subitemCount: active });
      await db.collection(syncLogs).add({ projectBoardId: boardId, at: at(), ok: true, summary: `Subelementos: ${msg}` });
    }
    return { ok: true as const, summary, next: isLast ? null : offset + SUB_PART, total: all.length };
  } catch (e) {
    console.error('sync-sub failed', boardId, offset, e);
    const msg = e instanceof Error ? e.message : 'Falha desconhecida.';
    const summary = `Falha ao ler subelementos: ${msg} Os dados das partes não processadas foram preservados.`;
    await saveSync({ ...prevSync, sub: { status: 'error', message: msg, at: at() } }).catch(() => undefined);
    await db.collection(syncLogs).add({ projectBoardId: boardId, at: at(), ok: false, summary }).catch(() => undefined);
    return { ok: false as const, summary, next: null, total: 0 };
  }
}
