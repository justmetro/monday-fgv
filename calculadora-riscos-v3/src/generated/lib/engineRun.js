import { gql, sleep, errorMessage, isRateLimit, dropdownLabels, isChecked, txt, todayISO } from '@generated/lib/monday';
import { QUESTIONS, B_PROJ, B_RISCOS, addKey } from '@generated/lib/engineData';
import { fetchProjectRisks, planReconcile, applyUpdates } from '@generated/lib/engineReconcile';

const UPDATE_MUTATION = `mutation ($b: ID!, $i: ID!, $v: JSON!) {
  change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }`;

export async function updateProject(itemId, values) {
  await gql(UPDATE_MUTATION, { b: String(B_PROJ), i: String(itemId), v: JSON.stringify(values) });
}

/** Etapas 6.1–6.3: grupos, avisos e seleção de riscos para um projeto. */
export function selectRisks(ctx, project) {
  const warnings = [];
  const groups = [];
  QUESTIONS.forEach(({ col, n }) => {
    const labels = dropdownLabels(project.cols[col]);
    if (!labels.length) { warnings.push(`Pergunta ${n} sem resposta.`); return; }
    if (labels.length > 1) warnings.push(`Pergunta ${n} com mais de uma resposta: os grupos de todas as respostas foram somados.`);
    labels.forEach((label) => {
      const gr = ctx.answerMap.get(`${n}.|${label.trim().toLowerCase()}`);
      if (gr) groups.push(gr);
      else warnings.push(`Resposta '${label.trim()}' (pergunta ${n}) não tem grupo na base: não gerou riscos.`);
    });
  });
  if (isChecked(project.cols.c8_gr85) && ctx.GR_85) groups.push(ctx.GR_85);
  if (ctx.GR_TRANS) groups.push(ctx.GR_TRANS);
  const uniqueGroups = [...new Set(groups)];

  const selec = new Map();
  uniqueGroups.forEach((g) => {
    (ctx.rxg.get(g) || []).forEach((riskId) => {
      if (!ctx.base.has(riskId)) return;
      const origins = selec.get(riskId);
      if (!origins) selec.set(riskId, [g]);
      else if (!origins.includes(g)) origins.push(g);
    });
  });
  const nTot = selec.size;
  let nTr = 0;
  selec.forEach((o) => { if (o.length === 1 && o[0] === ctx.GR_TRANS) nTr += 1; });
  return { warnings, groups: uniqueGroups, selec, nTot, nTr, nEsp: nTot - nTr };
}

function buildRiskPayload(ctx, projectId, risk, origins) {
  const key = `${projectId}|${risk.idRisco || risk.id}`;
  const sinais = [];
  if (risk.parecer && risk.parecer !== 'OK') sinais.push(`Parecer da revisão: ${risk.parecer}.`);
  if (risk.dup.startsWith('Repetido')) sinais.push('Texto repetido na planilha com atributos divergentes.');
  if (risk.statusMet === 'Em revisão') sinais.push('Risco em revisão metodológica na base.');
  const cv = {
    rel_proj: { item_ids: [Number(projectId)] },
    rel_base: { item_ids: [Number(risk.id)] },
    id_risco: risk.idRisco,
    chave: key,
    grs_origem: { labels: origins },
    causa: { text: risk.causa },
    efeito: { text: risk.efeito },
    aplic: { label: 'Identificado' },
    status_trat: { label: 'Não iniciado' },
    ref_pi: `P: ${risk.prob || '-'} / I: ${risk.imp || '-'} (base ${ctx.VERSAO})`,
    versao: ctx.VERSAO,
  };
  if (risk.categoria) cv.categoria = { labels: [risk.categoria] };
  if (risk.prob) cv.prob = { label: risk.prob };
  if (risk.imp) cv.imp = { label: risk.imp };
  if (sinais.length) cv.sinal = { text: sinais.join(' ') };
  return { key, idRisco: risk.idRisco, name: (risk.name || risk.idRisco || 'Risco').slice(0, 255), cv };
}

async function createMany(batch) {
  const defs = [];
  const body = [];
  const vars = {};
  batch.forEach((b, i) => {
    defs.push(`$n${i}: String!, $v${i}: JSON!`);
    body.push(`m${i}: create_item(board_id: ${B_RISCOS}, group_id: "topics", item_name: $n${i}, column_values: $v${i}, create_labels_if_missing: false) { id }`);
    vars[`n${i}`] = b.name;
    vars[`v${i}`] = JSON.stringify(b.cv);
  });
  await gql(`mutation (${defs.join(', ')}) { ${body.join(' ')} }`, vars);
}

/** Confere no 09.4 quais chaves já existem (usado após falha parcial de um lote). */
async function existingKeys(keys) {
  const res = await gql(
    `query ($b: ID!, $cols: [ItemsPageByColumnValuesQuery!]) { items_page_by_column_values(limit: 50, board_id: $b, columns: $cols) { items { column_values(ids: ["chave"]) { text } } } }`,
    { b: String(B_RISCOS), cols: [{ column_id: 'chave', column_values: keys }] }
  );
  return new Set((res?.items_page_by_column_values?.items || []).map((it) => txt(it.column_values?.[0]).trim()));
}

async function createBatch(ctx, batch) {
  try {
    await createMany(batch);
    batch.forEach((b) => addKey(ctx, b.key));
    return;
  } catch (err) {
    if (isRateLimit(err)) throw err;
    console.error('Lote falhou, conferindo itens criados:', err);
  }
  const found = await existingKeys(batch.map((b) => b.key));
  for (const b of batch) {
    if (found.has(b.key)) { addKey(ctx, b.key); continue; }
    try {
      await createMany([b]);
      addKey(ctx, b.key);
    } catch (err) {
      throw new Error(`Falha ao criar o risco ${b.idRisco || b.name}: ${errorMessage(err)}`);
    }
    await sleep(200);
  }
}

/** Executa o motor completo para um projeto e atualiza o 09.1. */
export async function processProject(ctx, project, onFraction) {
  const sel = selectRisks(ctx, project);
  const hoje = todayISO();

  // 1. Riscos que o projeto já tem no 09.4 (leitura atual, paginação completa)
  const existing = await fetchProjectRisks(project.id);
  existing.forEach((r) => addKey(ctx, r.key));
  const existingKeys = new Set(existing.map((r) => r.key));
  onFraction?.(0.1);

  // 2. Novos riscos (chave ainda inexistente)
  const toCreate = [];
  const selectedOrigins = new Map();
  sel.selec.forEach((origins, riskId) => {
    const payload = buildRiskPayload(ctx, project.id, ctx.base.get(riskId), origins);
    selectedOrigins.set(payload.key, origins);
    if (!existingKeys.has(payload.key) && !ctx.keys.has(payload.key)) toCreate.push(payload);
  });
  toCreate.sort((a, b) => String(a.idRisco).localeCompare(String(b.idRisco), 'pt-BR', { numeric: true }));

  for (let i = 0; i < toCreate.length; i += 10) {
    await createBatch(ctx, toCreate.slice(i, i + 10));
    onFraction?.(0.1 + Math.min(1, (i + 10) / toCreate.length) * 0.5);
    await sleep(350);
  }

  // 3. Descartes, sinalizações, reativações e grupos de origem dos existentes
  const plan = planReconcile(existing, selectedOrigins, hoje);
  await applyUpdates(plan.updates, (f) => onFraction?.(0.6 + f * 0.3));

  const alteracoes = { novos: toCreate.length, ...plan.counts };
  const total = plan.ativos + toCreate.length;
  const lines = [
    `${hoje} | base ${ctx.VERSAO} | ${sel.groups.length} grupos | ${total} riscos no projeto (${toCreate.length} novos nesta execução)`,
    `Executado por: ${ctx.userName} pelo app Rodar Calculadora`,
    `RESULTADO: ${sel.nTot} riscos = ${sel.nEsp} específicos + ${sel.nTr} transversais.`,
    `ALTERAÇÕES: ${alteracoes.novos} novos, ${alteracoes.descartados} descartados automaticamente, ${alteracoes.sinalizados} sinalizados para revisão (já avaliados), ${alteracoes.reativados} reativados.`,
    `GRUPOS: ${sel.groups.join(', ')}`,
    'AVISOS:',
    ...sel.warnings.map((w) => `  - ${w}`),
  ];
  const log = lines.join('\n');
  const status = sel.warnings.length ? 'Executada c/ avisos' : 'Executada';
  await updateProject(project.id, {
    grs_ident: sel.groups.join(', '),
    n_riscos: String(total),
    versao: ctx.VERSAO,
    data_calc: { date: hoje },
    log_calc: { text: log },
    calc: { label: status },
  });
  onFraction?.(1);
  return {
    id: project.id, name: project.name, status, groups: sel.groups, novos: toCreate.length, alteracoes,
    total, nTot: sel.nTot, nEsp: sel.nEsp, nTr: sel.nTr, warnings: sel.warnings, log, date: hoje,
  };
}
