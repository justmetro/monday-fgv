// Fim do TAP por pessoa: Data de Saída no grupo "Equipe" de cada quadro [PLAN] do workspace
// Coordenação de Planejamento de Projetos. A pessoa é encontrada pelo nome (sem acento/caixa).
// Nunca lança erro: se não conseguir ler, devolve { ok: false } e a tela mostra o aviso.
import { api } from '@api/BoardSDK';
import { normKey } from '@generated/lib/normalize';

const WORKSPACE = 13402503;
const SAIDA = 'date_mm5h8qx4';
const ENTRADA = 'date_mm5h3yyr';
const isPlan = (n) => /^\s*\[PLAN\]/i.test(n ?? '');
const day = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);

async function readBoard(b) {
  const g = (b.groups ?? []).find((x) => normKey(x.title) === 'equipe');
  if (!g) return [];
  const out = [];
  let cursor = null;
  do {
    const fields = `cursor items { name column_values(ids: ["${SAIDA}", "${ENTRADA}"]) { id text } }`;
    const page = cursor
      ? (await api(`query ($c: String!) { next_items_page(cursor: $c, limit: 500) { ${fields} } }`, { c: cursor })).next_items_page
      : (await api(`query ($b: [ID!], $g: String!) { boards(ids: $b) { groups(ids: [$g]) { items_page(limit: 500) { ${fields} } } } }`, { b: [b.id], g: g.id })).boards?.[0]?.groups?.[0]?.items_page;
    (page?.items ?? []).forEach((it) => {
      const v = Object.fromEntries((it.column_values ?? []).map((c) => [c.id, c.text]));
      out.push({ nome: it.name, saida: day(v[SAIDA]), entrada: day(v[ENTRADA]), projeto: b.name });
    });
    cursor = page?.cursor ?? null;
  } while (cursor);
  return out;
}

export async function fetchTap() {
  try {
    const d = await api(`query ($w: [ID!]) { boards(workspace_ids: $w, state: active, limit: 500) { id name groups { id title } } }`, { w: [WORKSPACE] });
    const plans = (d.boards ?? []).filter((b) => isPlan(b.name));
    const rows = [];
    for (let i = 0; i < plans.length; i += 6) {
      const parts = await Promise.all(plans.slice(i, i + 6).map((b) => readBoard(b).catch((e) => { console.error('[tap] falha ao ler', b.name, e); return []; })));
      parts.forEach((p) => rows.push(...p));
    }
    const byName = new Map();
    rows.forEach((r) => {
      const k = normKey(r.nome);
      if (!k) return;
      const cur = byName.get(k) ?? { fim: null, semFim: false, projetos: [] };
      cur.projetos.push(r.projeto);
      if (r.saida) { if (!cur.fim || r.saida > cur.fim) cur.fim = r.saida; } else cur.semFim = true;
      byName.set(k, cur);
    });
    return { ok: true, byName, quadros: plans.length };
  } catch (e) {
    console.error('[tap] não foi possível ler os quadros de planejamento', e);
    return { ok: false, byName: new Map(), quadros: 0 };
  }
}
