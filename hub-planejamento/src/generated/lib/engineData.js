import { gql, fetchAllItems, fetchItemsByIds, txt, isChecked, linkedIds, sleep } from '@generated/lib/monday';

// Calculadora de Riscos v3: 4 quadros.
export const B_PROJ = 18439788380;   // 09.1 Projetos
export const B_MET = 18439788479;    // 09.3 Metodologia (grupos de risco + regras)
export const B_BASE = 18439788427;   // 09.2 Base de Riscos (com Código GR)
export const B_RISCOS = 18439788527; // 09.4 Riscos do Projeto
export const B_CFG = B_MET;
export const B_GR = B_MET;

export const QUESTIONS = [
  { col: 'c1_fat', n: 1 },
  { col: 'c2_tipofat', n: 2 },
  { col: 'c3_vig', n: 3 },
  { col: 'c4_cli', n: 4 },
  { col: 'c5_mod', n: 5 },
  { col: 'c6_prod', n: 6 },
  { col: 'c7_tipo', n: 7 },
  { col: 'c8_equipe', n: 8 },
];

export const PROJECT_COLS = [...QUESTIONS.map((q) => q.col), 'c8_gr85', 'calc'];

const t = (cv) => txt(cv).trim();

/** Carrega configuração, catálogo, risco×grupo, base e chaves existentes (uma vez por execução). */
export async function loadContext(onPhase) {
  onPhase('Identificando usuário…');
  const me = await gql('query { me { id name } }');

  onPhase('Lendo metodologia (09.3)…');
  const metItems = await fetchAllItems(B_MET, ['chave', 'valor', 'codigo_gr', 'eixo', 'rotulo', 'ativo', 'versao']);
  const cfg = new Map(metItems.filter((it) => t(it.cols.chave)).map((it) => [t(it.cols.chave), t(it.cols.valor)]));
  const VERSAO = cfg.get('VERSAO_VIGENTE') || '2026-v2';
  const STATUS_OK = (cfg.get('BASE_STATUS_INCLUIDOS') || 'Pendente;Em revisão;Confirmado')
    .split(';').map((s) => s.trim()).filter(Boolean);
  const valid = (it) => isChecked(it.cols.ativo) && t(it.cols.versao) === VERSAO;

  const answerMap = new Map();
  let GR_TRANS = null;
  let GR_85 = null;
  metItems.filter(valid).forEach((it) => {
    const code = t(it.cols.codigo_gr);
    if (!code) return;
    const eixo = t(it.cols.eixo).slice(0, 2);
    const rotulo = t(it.cols.rotulo).toLowerCase();
    const key = `${eixo}|${rotulo}`;
    if (rotulo && !answerMap.has(key)) answerMap.set(key, code);
    if (code === 'Transversal') GR_TRANS = code;
    if (!GR_85 && code.startsWith('GR8.5')) GR_85 = code;
  });
  await sleep(250);

  onPhase('Lendo base de riscos (09.2)…');
  const baseItems = await fetchAllItems(B_BASE, [
    'id_risco', 'causa', 'efeito', 'categoria', 'prob_ref', 'imp_ref',
    'status_met', 'parecer', 'dup_status', 'ativo', 'versao', 'codigo_gr',
  ]);
  const base = new Map();
  const rxg = new Map();
  baseItems.forEach((it) => {
    const statusMet = t(it.cols.status_met);
    if (!valid(it) || !STATUS_OK.includes(statusMet)) return;
    const code = t(it.cols.codigo_gr);
    if (code) {
      if (!rxg.has(code)) rxg.set(code, []);
      rxg.get(code).push(it.id);
    }
    base.set(it.id, {
      id: it.id,
      name: it.name,
      idRisco: t(it.cols.id_risco),
      causa: txt(it.cols.causa),
      efeito: txt(it.cols.efeito),
      categoria: t(it.cols.categoria),
      prob: t(it.cols.prob_ref),
      imp: t(it.cols.imp_ref),
      statusMet,
      parecer: t(it.cols.parecer),
      dup: t(it.cols.dup_status),
    });
  });
  await sleep(250);

  onPhase('Lendo riscos já gerados (09.4)…');
  const riskItems = await fetchAllItems(B_RISCOS, ['chave']);
  const keys = new Set();
  const counts = new Map();
  const ctx = { userName: me?.me?.name || 'usuário', VERSAO, STATUS_OK, answerMap, GR_TRANS, GR_85, rxg, base, keys, counts };
  riskItems.forEach((it) => addKey(ctx, t(it.cols.chave)));
  return ctx;
}

/** Registra uma chave "projetoId|id_risco" no conjunto e no contador por projeto. */
export function addKey(ctx, key) {
  if (!key || ctx.keys.has(key)) return;
  ctx.keys.add(key);
  const pid = key.split('|')[0];
  ctx.counts.set(pid, (ctx.counts.get(pid) || 0) + 1);
}

export async function readProjects(ids) {
  const items = await fetchItemsByIds(ids, PROJECT_COLS);
  const byId = new Map(items.map((it) => [it.id, it]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}
