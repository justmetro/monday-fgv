// Espelha no quadro as linhas editadas na aba Base (a Base já foi gravada antes) e confere por leitura de volta.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { mirrorQueueCollection } from '@generated/models';
import { baseRowKey, isoOf } from '@generated/lib/baseRows';
import { WEEKDAYS, extractEmail, isCheckedValue, normText } from '@generated/lib/weekdays';
import { boardColumnRoles, engagementBoardId, loadBaseRows, readBoardMeta, requireBaseAccess, type BoardColumn } from './base.server';
import { isWritableType, mondayReadGroupItems, mondayUpsertItemsBatch, toColumnValue, type GroupItemState } from './mondayWrite.server';
import { dbWriteBestEffort } from './vibeDbRetry.server';

const claimSchema = z
  .object({ id: z.union([z.string(), z.number()]).optional(), email: z.string().optional(), name: z.string().optional(), isAdmin: z.boolean().optional() })
  .optional();

const queueId = (group: string) => `q_${normText(group).replace(/[^a-z0-9]+/g, '_').slice(0, 80) || 'grupo'}`;
const teamSet = (raw: string | null | undefined) => (raw ?? '').split(/[,;]/).map((t) => normText(t)).filter(Boolean).sort().join('|');

export interface EditMirrorFailure { name: string; group: string; reason: string }

/** Guarda na fila da semana quem não foi confirmado no quadro (sem apagar o que já estava na fila). */
async function enqueue(group: string, names: string[], reason: string) {
  if (names.length === 0) return;
  const ref = db.collection(mirrorQueueCollection).doc(queueId(group));
  const cur = (await ref.get().catch(() => null))?.data;
  const merged = Array.from(new Set([...(cur?.pendingNames ?? []), ...names]));
  await dbWriteBestEffort('editMirrorQueue', () =>
    ref.set({
      group: group.trim(),
      pendingCount: Math.max(cur?.pendingCount ?? 0, merged.length),
      pendingNames: merged.slice(0, 200),
      checksPending: cur?.checksPending ?? 0,
      lastError: reason.slice(0, 500),
      updatedAt: new Date().toISOString(),
    })
  );
}

function findItem(items: GroupItemState[], emailCols: BoardColumn[], name: string, email: string) {
  const e = extractEmail(email);
  if (e) {
    const byEmail = items.find((it) => emailCols.some((c) => extractEmail(it.values[c.id]?.text) === e) || extractEmail(it.name) === e);
    if (byEmail) return byEmail;
  }
  return items.find((it) => normText(it.name) === normText(name));
}

export const mirrorEditedRows = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      keys: z.array(z.string().min(1).max(800)).min(1).max(200),
      token: z.string().trim().max(2000).optional(),
      clientClaim: claimSchema,
    })
  )
  .handler(async ({ data }) => {
    await requireBaseAccess(data.clientClaim);
    const { rows } = await loadBaseRows();
    const wanted = new Set(data.keys);
    const edited = rows.filter((r) => wanted.has(baseRowKey(r)));
    const byGroup = new Map<string, typeof edited>();
    edited.forEach((r) => {
      const g = (r.group ?? '').trim();
      byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
    });

    const failures: EditMirrorFailure[] = [];
    let confirmed = 0;
    const token = data.token?.trim() ?? '';

    if (!token) {
      for (const [group, list] of byGroup) await enqueue(group, list.map((r) => r.name), 'Editado na Base sem token: aguardando envio ao quadro.');
      return { confirmed: 0, failures: edited.map((r) => ({ name: r.name, group: r.group ?? '', reason: 'Sem token: ficou na fila da semana.' })), skipped: true };
    }

    const boardId = await engagementBoardId();
    const board = await readBoardMeta(token, boardId);
    const roles = boardColumnRoles(board.columns);
    const emailCols = board.columns.filter((c) => c.type === 'email' || normText(c.title).includes('email'));
    const writable = (c: BoardColumn | null) => (c && (isWritableType(c.type) || c.type === 'checkbox') ? c : null);
    const laCol = writable(roles.lastAccess);
    const teamCol = writable(roles.team);
    const deptCol = writable(roles.department);
    const statusCol = writable(roles.status);
    const dayCols = WEEKDAYS.map((w) => ({ key: w.key, col: roles.days[w.key] ?? null }));
    const readIds = [...emailCols, laCol, teamCol, deptCol, statusCol, ...dayCols.map((d) => d.col)].filter(Boolean).map((c) => (c as BoardColumn).id);

    for (const [group, list] of byGroup) {
      const fail = (r: { name: string }, reason: string) => failures.push({ name: r.name, group, reason });
      const g = board.groups.find((x) => normText(x.title) === normText(group));
      if (!g) {
        list.forEach((r) => fail(r, `Grupo "${group}" não existe no quadro.`));
        await enqueue(group, list.map((r) => r.name), `Grupo "${group}" não existe no quadro.`);
        continue;
      }
      const before = await mondayReadGroupItems(token, boardId, g.id, readIds);
      if (!before.ok) {
        list.forEach((r) => fail(r, `Erro do monday ao ler o grupo: ${before.message}`));
        await enqueue(group, list.map((r) => r.name), before.message);
        continue;
      }
      const ops: { key: string; name: string; itemId: string; values: Record<string, unknown> }[] = [];
      list.forEach((r) => {
        const it = findItem(before.items, emailCols, r.name, r.email);
        if (!it) { fail(r, 'Item da pessoa não encontrado neste grupo do quadro.'); return; }
        const cv: Record<string, unknown> = {};
        if (laCol) cv[laCol.id] = r.lastAccess ? toColumnValue(laCol.type, r.lastAccess) : null;
        if (teamCol) cv[teamCol.id] = r.team?.trim() ? toColumnValue(teamCol.type, r.team) : null;
        if (deptCol && r.department?.trim()) cv[deptCol.id] = toColumnValue(deptCol.type, r.department);
        if (statusCol && r.userStatus?.trim()) cv[statusCol.id] = toColumnValue(statusCol.type, r.userStatus);
        // Checks: marca os dias da Base e desmarca os demais (edição manual; uploads nunca desmarcam)
        dayCols.forEach(({ key, col }) => { if (col) cv[col.id] = (r.checkedDays ?? []).includes(key) ? { checked: 'true' } : null; });
        ops.push({ key: baseRowKey(r), name: r.name, itemId: it.id, values: cv });
      });

      for (let i = 0; i < ops.length; i += 25) {
        const slice = ops.slice(i, i + 25);
        const res = await mondayUpsertItemsBatch(token, boardId, g.id, slice.map((o) => ({ key: o.key, op: 'update' as const, itemId: o.itemId, name: o.name, columnValues: o.values })));
        if (!res.delivered) console.error(`[edição Base] lote rejeitado (${res.kind}): ${res.message}`);
      }

      // Leitura de volta: só conta como gravado o que o quadro mostra igual à Base
      const after = ops.length ? await mondayReadGroupItems(token, boardId, g.id, readIds) : { ok: true as const, items: [] };
      const notConfirmed: string[] = list.filter((r) => failures.some((f) => f.group === group && f.name === r.name)).map((r) => r.name);
      ops.forEach((o) => {
        const r = list.find((x) => baseRowKey(x) === o.key);
        if (!r) return;
        if (!after.ok) { fail(r, `Erro do monday na leitura de volta: ${after.message}`); notConfirmed.push(r.name); return; }
        const it = after.items.find((x) => x.id === o.itemId);
        const diffs: string[] = [];
        if (!it) diffs.push('item não lido');
        else {
          dayCols.forEach(({ key, col }) => {
            if (!col) return;
            const on = isCheckedValue(it.values[col.id]?.value, it.values[col.id]?.text);
            if (on !== (r.checkedDays ?? []).includes(key)) diffs.push(`check ${key}`);
          });
          if (laCol && (isoOf(it.values[laCol.id]?.text) ?? '') !== (isoOf(r.lastAccess) ?? '')) diffs.push('último acesso');
          if (teamCol && teamSet(it.values[teamCol.id]?.text) !== teamSet(r.team)) diffs.push('equipe');
          if (deptCol && r.department?.trim() && normText(it.values[deptCol.id]?.text) !== normText(r.department)) diffs.push('departamento');
          if (statusCol && r.userStatus?.trim() && normText(it.values[statusCol.id]?.text) !== normText(r.userStatus)) diffs.push('status');
        }
        if (diffs.length) { fail(r, `Quadro diferente da Base após gravar: ${diffs.join(', ')}.`); notConfirmed.push(r.name); }
        else confirmed++;
      });
      await enqueue(group, notConfirmed, failures.find((f) => f.group === group)?.reason ?? '');
    }

    return { confirmed, failures, skipped: false };
  });
