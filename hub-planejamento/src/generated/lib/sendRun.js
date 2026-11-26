import { gql, sleep, errorMessage, isRateLimit, txt, linkedIds } from '@generated/lib/monday';
import { B_PROJ } from '@generated/lib/engineData';
import {
  SYSTEM_BOARDS, norm, listLabels, readDestBoard, mapColumns, readDestExisting, readProjectRisks, readBaseThemes,
  findRiscosView,
} from '@generated/lib/sendData';

const TEMA_MAP = {
  'riscos jurídicos': 'Jurídico',
  'riscos de gestão': 'Gestão',
  'riscos de imagem': 'Imagem',
  'riscos financeiros': 'Financeiro',
};
const BATCH = 5;

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const findLabel = (labels, x) => labels.find((l) => norm(l) === norm(x)) ?? null;
const riskCode = (r) => {
  const id = txt(r.cols.id_risco).trim();
  return id || String(r.name).match(/^\s*(R\d*-\d+)/)?.[1] || '';
};

/** Monta os column_values do item destino, acumulando avisos de rótulos inexistentes. */
function buildValues(r, base, map, warnings) {
  const cv = {};
  const code = riskCode(r) || r.name;
  const text = (key, value) => { if (map[key] && value.trim()) cv[map[key].id] = { text: value }; };
  const labels = (key, values, alias) => {
    const col = map[key];
    if (!col || !values.length) return;
    const found = [];
    values.forEach((x) => {
      let hit = findLabel(col.labels, x);
      if (!hit && alias) hit = alias(x, col.labels);
      if (hit) { if (!found.includes(hit)) found.push(hit); } else warnings.push(`${code}: '${x}' não existe em ${col.title} no destino`);
    });
    if (found.length) cv[col.id] = { labels: found };
  };
  const status = (key, value) => {
    const col = map[key];
    const x = value.trim();
    if (!col || !x) return;
    const hit = findLabel(col.labels, x);
    if (hit) cv[col.id] = { label: hit };
    else warnings.push(`${code}: '${x}' não existe em ${col.title} no destino`);
  };

  text('causa', txt(r.cols.causa));
  text('efeito', txt(r.cols.efeito));
  text('resposta', txt(r.cols.resposta));
  labels('categoria', listLabels(r.cols.categoria));
  labels('tema', (base?.tema || []).map((t) => TEMA_MAP[norm(t)] ?? t));
  labels('impactado', base?.impactado || [], (x, ls) => (norm(x) === 'parceiro' ? findLabel(ls, 'Cliente') : null));
  status('prob', txt(r.cols.prob));
  status('imp', txt(r.cols.imp));
  status('estrategia', txt(r.cols.estrategia));

  // Opcionais: Aplicabilidade (status) e Justificativa, só se existirem no destino; sem aviso
  const aplic = txt(r.cols.aplic).trim();
  if (map.aplic && aplic) {
    const hit = findLabel(map.aplic.labels, aplic);
    if (hit) cv[map.aplic.id] = { label: hit };
  }
  text('justif', txt(r.cols.justif));

  if (map.responsavel) {
    let people = [];
    try { people = JSON.parse(r.cols.responsavel?.value || 'null')?.personsAndTeams || []; } catch { people = []; }
    if (people.length) cv[map.responsavel.id] = { personsAndTeams: people.map((p) => ({ id: Number(p.id), kind: p.kind || 'person' })) };
  }
  return cv;
}

async function createMany(boardId, groupId, batch) {
  const defs = [];
  const body = [];
  const vars = { b: String(boardId), g: String(groupId) };
  batch.forEach((it, i) => {
    defs.push(`$n${i}: String!, $v${i}: JSON!`);
    body.push(`c${i}: create_item(board_id: $b, group_id: $g, item_name: $n${i}, column_values: $v${i}, create_labels_if_missing: false) { id }`);
    vars[`n${i}`] = it.name;
    vars[`v${i}`] = JSON.stringify(it.cv);
  });
  await gql(`mutation ($b: ID!, $g: String!, ${defs.join(', ')}) { ${body.join(' ')} }`, vars);
}

export async function postProjectUpdate(itemId, body) {
  await gql('mutation ($i: ID!, $t: String!) { create_update(item_id: $i, body: $t) { id } }', { i: String(itemId), t: body });
}

export const updateBody = (userName, main) => `${escapeHtml(main)}<br>Executado por: ${escapeHtml(userName)} pelo app Rodar Calculadora`;

/** Link do resultado: view "Riscos" do destino; se não houver, o próprio quadro (nunca outra aba). */
export function monHost(slug, fallbackUrl) {
  if (slug) return `https://${slug}.monday.com`;
  try {
    const u = new URL(fallbackUrl);
    if (u.host.endsWith('monday.com')) return `${u.protocol}//${u.host}`;
  } catch { /* link inválido: usa o domínio padrão */ }
  return 'https://monday.com';
}

function destLink(host, boardId, views) {
  const view = findRiscosView(views);
  return view ? `${host}/boards/${boardId}/views/${view.id}` : `${host}/boards/${boardId}`;
}

/** Copia TODOS os riscos do projeto no 09.4 para o grupo "Riscos" do quadro de planejamento do próprio projeto. */
export async function sendProject(project, { slug } = {}, onPhase) {
  const bid = project.boardId;
  if (!bid) throw new Error("Preencha o 'Link do Planejamento' com o endereço do quadro [PLAN] do projeto.");
  if (SYSTEM_BOARDS.has(String(bid)) || String(bid) === String(B_PROJ)) {
    throw new Error(`O 'Link do Planejamento' aponta para um quadro da calculadora (${bid}), não para o quadro [PLAN] do projeto.`);
  }
  onPhase?.('Lendo o quadro de planejamento…', 0.05);
  const dest = await readDestBoard(bid);
  if (!dest) throw new Error(`Quadro de planejamento ${bid} não encontrado ou sem acesso.`);
  const group = (dest.groups || []).find((g) => norm(g.title) === 'riscos');
  if (!group) throw new Error(`O quadro '${dest.name}' não tem um grupo chamado 'Riscos'.`);

  const warnings = [];
  const { map, missing } = mapColumns(dest.columns || []);
  if (missing.length) warnings.push(`Colunas não encontradas no destino (não copiadas): ${missing.join(', ')}`);

  onPhase?.('Lendo os riscos do projeto (09.4)…', 0.15);
  const risks = await readProjectRisks(project.id);
  const result = {
    destName: dest.name, boardId: String(bid), destUrl: destLink(monHost(slug, project.url), bid, dest.views),
    total: risks.length, copied: 0, skipped: 0, warnings,
  };
  if (!risks.length) {
    warnings.push('Nenhum risco encontrado no 09.4 para este projeto.');
    return result;
  }
  risks.sort((a, b) => riskCode(a).localeCompare(riskCode(b), 'pt-BR', { numeric: true }));

  onPhase?.('Lendo tema e impactado na Base (09.2)…', 0.25);
  const baseIds = [...new Set(risks.map((r) => linkedIds(r.cols.rel_base)[0]).filter(Boolean))];
  const base = await readBaseThemes(baseIds);

  onPhase?.('Conferindo riscos já existentes no destino…', 0.35);
  const existing = await readDestExisting(bid, group.id);
  const isDup = (it) => (it.code && existing.ids.has(it.code.toUpperCase())) || existing.names.has(norm(it.name));
  const markDone = (it) => { if (it.code) existing.ids.add(it.code.toUpperCase()); existing.names.add(norm(it.name)); };

  const toCreate = [];
  risks.forEach((r) => {
    const it = { code: riskCode(r), name: String(r.name || riskCode(r)).slice(0, 255) };
    if (isDup(it)) { result.skipped += 1; return; }
    it.cv = buildValues(r, base.get(linkedIds(r.cols.rel_base)[0]), map, warnings);
    markDone(it);
    toCreate.push(it);
  });

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    onPhase?.(`Copiando riscos ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length}…`, 0.4 + 0.55 * (i / toCreate.length));
    try {
      await createMany(bid, group.id, batch);
      result.copied += batch.length;
    } catch (err) {
      if (isRateLimit(err)) throw err;
      console.error('Lote de cópia falhou, conferindo o destino e repetindo item a item:', err);
      const now = await readDestExisting(bid, group.id);
      for (const it of batch) {
        if ((it.code && now.ids.has(it.code.toUpperCase())) || now.names.has(norm(it.name))) { result.copied += 1; continue; }
        try {
          await createMany(bid, group.id, [it]);
          result.copied += 1;
        } catch (e) {
          throw new Error(`Falha ao copiar o risco ${it.code || it.name}: ${errorMessage(e)} (${result.copied} já copiados)`);
        }
        await sleep(300);
      }
    }
    await sleep(600);
  }
  return result;
}
