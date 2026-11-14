import { loadContext, readProjects } from '@generated/lib/engineData';
import { selectRisks } from '@generated/lib/engineRun';
import { readProjects as rp } from '@generated/lib/fields';
import { getReviewRisks, getAplicCounts } from '@generated/data/risks';
import { getProjectSummary } from '@generated/data/summary';
import { getProjects } from '@generated/data/projects';
(async () => {
  const ctx = await loadContext(() => {});
  console.log('grupos mapeados', ctx.answerMap.size, 'riscos base', ctx.base.size, 'GRs', ctx.rxg.size, 'versao', ctx.VERSAO, ctx.STATUS_OK);
  const projs = await rp();
  const full = await readProjects(projs.map((p: any) => p.id));
  for (const p of full) { const s = selectRisks(ctx, p); const old = projs.find((x: any) => x.id === p.id); console.log(p.name.slice(0, 40), '| novo', s.nTot, s.groups.join(','), '| gravado', old.riscosGerados, old.grsIdentificados); }
  const pid = projs[0].id;
  console.log(await getAplicCounts({ data: { projectId: pid } }));
  const rv = await getReviewRisks({ data: { projectId: pid } }); console.log('revisão', rv.items.length, rv.items[0]);
  const sm = await getProjectSummary({ data: { projectId: pid } }); console.log('resumo', sm.total, sm.aplicabilidade, sm.criticos.length);
  console.log('lista', (await getProjects({ data: {} })).items.length);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
