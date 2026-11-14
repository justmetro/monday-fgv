import { MAIN_BOARD, writeColumn, fetchSchema, errMsg } from '@generated/lib/boardMeta';
import { FAMILIA_COL, familiaLabels } from '@generated/lib/compatibilidadeArea';
import { BATCH } from '@generated/lib/config';

export const RELOAD_EVENT = 'automatch:reload';
const isLimit = (m) => /complex|rate|limit|429|too many/i.test(m);
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Live options of "Família de área" (read from the column settings).
async function liveOptions() {
  let s = await fetchSchema();
  if (!s.familiaOptions.length) s = await fetchSchema(true);
  if (!s.ok) throw new Error(`Não foi possível ler as opções da coluna “${FAMILIA_COL.title}”: ${s.error}`);
  return new Set(s.familiaOptions);
}
function validate(labels, opts) {
  if (!labels.length) throw new Error('Nenhuma família para gravar');
  const bad = labels.filter((l) => !opts.has(l));
  if (bad.length) throw new Error(`Rótulo inexistente na coluna “${FAMILIA_COL.title}”: ${bad.join(', ')}`);
}
async function write(itemId, labels) {
  try { await writeColumn({ boardId: MAIN_BOARD, itemId: String(itemId), columnId: FAMILIA_COL.id, value: { labels } }); } catch (e) {
    if (!isLimit(errMsg(e))) throw e;
    await wait(BATCH.ESPERA_RETRY_MS);
    await writeColumn({ boardId: MAIN_BOARD, itemId: String(itemId), columnId: FAMILIA_COL.id, value: { labels } });
  }
}

// Writes the suggested families into "Família de área". Only called after an explicit user confirmation.
export async function confirmFamilia(itemId, fams) {
  const labels = familiaLabels(fams);
  validate(labels, await liveOptions());
  await write(itemId, labels);
  return labels;
}

// items: [{ id, name, fams }] → { ok: [...], fail: [{ name, msg }] }. Up to BATCH.CONCORRENCIA in parallel.
export async function confirmMany(items, onProgress) {
  const ok = []; const fail = [];
  let opts;
  try { opts = await liveOptions(); } catch (e) { return { ok, fail: items.map((it) => ({ name: it.name, msg: errMsg(e) })) }; }
  let i = 0; let done = 0;
  const worker = async () => {
    while (i < items.length) {
      const it = items[i]; i += 1;
      try {
        const labels = familiaLabels(it.fams);
        validate(labels, opts);
        await write(it.id, labels);
        ok.push({ ...it, labels });
      } catch (e) { console.error('[familia] falha', it.name, e); fail.push({ name: it.name, msg: errMsg(e) }); }
      done += 1; onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(BATCH.CONCORRENCIA, items.length) }, worker));
  return { ok, fail };
}
// detail.patches: [{ id, labels }] → applied locally right away, then a full reload.
export const requestReload = (patches = []) => window.dispatchEvent(new CustomEvent(RELOAD_EVENT, { detail: { patches } }));
