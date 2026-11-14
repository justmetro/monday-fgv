import { board } from '@generated/lib/data';
import { MAIN_BOARD, writeColumn, errMsg } from '@generated/lib/boardMeta';
import { monthStartISO, nv } from '@generated/lib/autoMatch';
import { COL, WRITE_LABELS, MAX_RODADA } from '@generated/lib/config';

const CREATE = `mutation ($p: ID!, $n: String!, $v: JSON!) { create_subitem(parent_item_id: $p, item_name: $n, column_values: $v) { id } }`;
const SUBS = `query ($id: [ID!]) { items(ids: $id) { id subitems { id name column_values(ids: ["${COL.sub.perfilVinculado}", "${COL.sub.rodada}"]) { id text ... on BoardRelationValue { linked_item_ids } } } } }`;

let inFlight = false;
export const isApplying = () => inFlight;

// Fresh subitems of a vaga → { linked: Set(perfilId), names: Set(nome), max }
async function freshSubs(vagaId) {
  const res = await board.executeGraphQL(SUBS, { id: [String(vagaId)] });
  const subs = res?.items?.[0]?.subitems ?? [];
  const linked = new Set(); const names = new Set(); let max = 0;
  subs.forEach((s) => {
    names.add(nv(s.name));
    (s.column_values ?? []).forEach((c) => {
      if (c.id === COL.sub.perfilVinculado) (c.linked_item_ids ?? []).forEach((id) => linked.add(String(id)));
      if (c.id === COL.sub.rodada) max = Math.max(max, Number(String(c.text ?? '').match(/\d+/)?.[0] ?? 0));
    });
  });
  return { linked, names, max };
}

// picks: [{ vaga, perfil }]. Re-checks each vaga's subitems right before creating. Errors are per item; the batch never stops.
export async function applyMatches(picks, monthKey, onProgress) {
  if (inFlight) return { created: 0, statusOk: 0, errors: [], skipped: [], busy: true };
  inFlight = true;
  const created = []; const errors = []; const skipped = [];
  try {
    const byVaga = new Map();
    picks.forEach((p) => { if (!byVaga.has(p.vaga.id)) byVaga.set(p.vaga.id, []); byVaga.get(p.vaga.id).push(p); });
    let done = 0; const total = picks.length;
    for (const group of byVaga.values()) {
      const vaga = group[0].vaga;
      let fresh;
      try { fresh = await freshSubs(vaga.id); } catch (e) {
        console.error('[automatch] falha ao reconsultar subitens', vaga.name, e);
        group.forEach(({ perfil }) => errors.push({ what: `${perfil.name} → ${vaga.name}`, msg: `não foi possível conferir os subitens atuais: ${errMsg(e)}` }));
        done += group.length; onProgress?.(done, total); continue;
      }
      if (fresh.max >= MAX_RODADA) {
        group.forEach(({ perfil }) => skipped.push({ what: `${perfil.name} → ${vaga.name}`, why: `vaga já na Rodada ${MAX_RODADA} — avaliar manualmente` }));
        done += group.length; onProgress?.(done, total); continue;
      }
      const rodada = fresh.max + 1;
      for (const { perfil } of group) {
        if (fresh.linked.has(String(perfil.id)) || fresh.names.has(nv(perfil.name))) {
          skipped.push({ what: `${perfil.name} → ${vaga.name}`, why: 'já existia' });
        } else {
          const values = {
            [COL.sub.perfilVinculado]: { item_ids: [Number(perfil.id)] },
            [COL.sub.statusDoMatch]: { label: WRITE_LABELS.statusDoMatch },
            [COL.sub.resultadoDaRodada]: { label: WRITE_LABELS.resultadoDaRodada },
            [COL.sub.rodada]: { label: WRITE_LABELS.rodada(rodada) },
            [COL.sub.msDeRefernciaMatch]: { date: monthStartISO(monthKey) },
          };
          try {
            const res = await board.executeGraphQL(CREATE, { p: String(vaga.id), n: perfil.name, v: JSON.stringify(values) });
            created.push({ vaga, perfil, id: res?.create_subitem?.id });
            fresh.linked.add(String(perfil.id));
          } catch (e) {
            console.error('[automatch] falha ao criar subitem', vaga.name, perfil.name, e);
            errors.push({ what: `${perfil.name} → ${vaga.name}`, msg: errMsg(e) });
          }
        }
        done += 1; onProgress?.(done, total);
      }
    }

    // Status updates only for vagas/perfis that actually received a new subitem.
    const vagas = [...new Map(created.map((c) => [c.vaga.id, c.vaga])).values()];
    const perfis = [...new Map(created.map((c) => [c.perfil.id, c.perfil])).values()];
    const status = [
      ...vagas.map((v) => ({ id: v.id, col: COL.statusDaVaga, label: `Status da vaga · ${v.name}` })),
      ...perfis.map((p) => ({ id: p.id, col: COL.statusDoPerfil, label: `Status do perfil · ${p.name}` })),
    ];
    let statusOk = 0;
    for (const s of status) {
      try {
        await writeColumn({ boardId: MAIN_BOARD, itemId: s.id, columnId: s.col, value: { label: WRITE_LABELS.emRodada } });
        statusOk += 1;
      } catch (e) {
        console.error('[automatch] falha ao atualizar status', s.label, e);
        errors.push({ what: s.label, msg: errMsg(e) });
      }
    }
    return { created: created.length, statusOk, errors, skipped };
  } finally {
    inFlight = false;
  }
}
