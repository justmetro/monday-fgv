import { refreshProject } from '@generated/server/importer';
import { parseConfig, type GroupKey } from '@generated/lib/fields';
import { stagesOf, type SubMode } from '@generated/lib/stages';
import { runSubitemParts } from './subparts';

/** Atualiza um projeto em etapas (um grupo por requisição), igual ao botão "Atualizar". */
export async function stagedRefresh(p: { boardId: string; config: string | null | undefined; noIndicators?: boolean }, groups?: GroupKey[]) {
  const cfg = parseConfig(p.config ?? undefined);
  const list = p.noIndicators || !cfg ? [] : stagesOf(cfg, groups);
  const stages: { groups?: GroupKey[]; subMode?: SubMode }[] = list.length ? list : [{ groups }];
  const parts: string[] = [];
  let ok = true;
  let history: { ok: boolean; summary: string } | null = null;
  const lastCommon = stages.map((s) => s.subMode !== 'only').lastIndexOf(true);
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]!;
    if (s.subMode === 'only') {
      const sr = await runSubitemParts(p.boardId, null);
      parts.push(`Subelementos: ${sr.summary}`);
      if (!sr.ok) { ok = false; break; }
      continue;
    }
    const r = await refreshProject({ data: { boardId: p.boardId, groups: s.groups, subMode: s.subMode, history: i === lastCommon } });
    parts.push(r.summary);
    if (r.history) history = r.history;
    if (!r.ok) { ok = false; break; }
  }
  return { ok, summary: parts.join(' · '), history };
}
