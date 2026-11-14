import { canon, clean, normKey } from '@generated/lib/normalize';
import { nv } from '@generated/lib/autoMatch';
import { compareMatch } from '@generated/lib/aderencia';

const KEY = 'automatch:view:v2';
export const DEFAULT_MIN = 0;
export const DEFAULT_FILTERS = { q: '', projeto: [], eixo: [], senioridade: [], contratacao: [], atuacao: [], uf: [], minScore: DEFAULT_MIN, scoreDir: 'gte', situacao: 'todas' };
export const MULTI = [
  { id: 'projeto', label: 'Projeto' }, { id: 'eixo', label: 'Eixo' }, { id: 'senioridade', label: 'Senioridade' },
  { id: 'contratacao', label: 'Contratação' }, { id: 'atuacao', label: 'Atuação' }, { id: 'uf', label: 'UF' },
];
export const toScore = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_MIN; };

export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!p) return null;
    const f = { ...DEFAULT_FILTERS, ...p.filters };
    MULTI.forEach((m) => { if (!Array.isArray(f[m.id])) f[m.id] = []; });
    return { view: p.view ?? 'vaga', card: p.card ?? null, filters: { ...f, q: String(f.q ?? ''), minScore: toScore(f.minScore), scoreDir: f.scoreDir === 'lte' ? 'lte' : 'gte' } };
  } catch { return null; }
}
export function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { console.error('[automatch] não foi possível salvar filtros', e); } }

const atuacaoOf = (v) => { const k = nv(v.modalidadeDeAtuaoVaga); return k === 'remoto' ? 'Remoto' : k === 'presencial' ? 'Presencial' : k === 'hibrido' ? 'Híbrido' : null; };
const values = (v) => ({
  projeto: [clean(v.projeto) ?? 'Sem projeto'], eixo: [canon(v.eixoDeAtuao)].filter(Boolean), senioridade: [canon(v.senioridadeVaga)].filter(Boolean),
  contratacao: [canon(v.modalidadeDeContratao)].filter(Boolean), atuacao: [atuacaoOf(v)].filter(Boolean),
  uf: (clean(v.ufDeAtuao) ?? []).map((u) => String(u).toUpperCase()),
});

export function optionsFor(results) {
  const o = Object.fromEntries(MULTI.map((m) => [m.id, new Set()]));
  results.forEach((r) => { const vs = values(r.vaga); MULTI.forEach((m) => vs[m.id].forEach((x) => o[m.id].add(x))); });
  return Object.fromEntries(MULTI.map((m) => [m.id, [...o[m.id]].sort((a, b) => a.localeCompare(b, 'pt'))]));
}
export const pruneFilters = (f, opts) => ({ ...f, ...Object.fromEntries(MULTI.map((m) => [m.id, f[m.id].filter((x) => opts[m.id].includes(x))])) });

export const key = (r, s) => `${r.vaga.id}:${s.perfil.id}`;

// Built once per match run: everything normalized up front so filtering is just lookups.
export function buildIndex(run) {
  const pText = new Map(run.perfis.map((p) => [p.id, normKey(p.name ?? '')]));
  const vagas = run.results.map((r) => ({
    r, vals: values(r.vaga), text: normKey(`${r.vaga.name} ${r.vaga.projeto ?? ''} ${r.vaga.id}`),
    topIds: new Set(r.sugestoes.map((s) => s.perfil.id)),
    all: r.all.map((s) => ({ s, k: key(r, s), t: pText.get(s.perfil.id) ?? '' })),
  }));
  const topKeys = new Set(run.results.flatMap((r) => r.sugestoes.map((s) => key(r, s))));
  const hadIds = new Set(run.results.flatMap((r) => r.sugestoes.map((s) => s.perfil.id)));
  const elimKeys = new Set(run.results.flatMap((r) => r.all.filter((s) => s.reason).map((s) => key(r, s))));
  return { run, vagas, pText, topKeys, hadIds, elimKeys };
}

export const pickedFrom = (run, checked) => (run ? run.results.flatMap((r) => r.all.filter((s) => s.reason !== 'existente' && checked.has(key(r, s))).map((s) => ({ vaga: r.vaga, perfil: s.perfil, rodada: r.rodada }))) : []);

const passVals = (vals, f) => !MULTI.some((m) => f[m.id].length && !vals[m.id].some((x) => f[m.id].includes(x)));

// Score filter: ≥ 0 and ≤ 100 mean "no filter".
export const scoreActive = (f) => { const n = toScore(f.minScore); return f.scoreDir === 'lte' ? n < 100 : n > 0; };
export const scoreLabel = (f) => `Score ${f.scoreDir === 'lte' ? '≤' : '≥'} ${toScore(f.minScore)}`;
export const scorePass = (f) => { const n = toScore(f.minScore); if (!scoreActive(f)) return () => true; return f.scoreDir === 'lte' ? (t) => t <= n : (t) => t >= n; };
export function otherFilters(f, cardLabel) {
  const out = [];
  if (cardLabel) out.push(cardLabel);
  if (String(f.q ?? '').trim()) out.push(`busca “${f.q.trim()}”`);
  MULTI.forEach((m) => { if (f[m.id].length) out.push(`${m.label}: ${f[m.id].join(', ')}`); });
  if (f.situacao !== 'todas') out.push(f.situacao === 'marcadas' ? 'só marcadas' : 'só desmarcadas');
  return out;
}

// View-only filtering over the prebuilt index. Never recomputes match/score.
// Base = every perfil that passed the eliminatory rules (plus, in Todos os perfis, the eliminated ones). Score filter is strict.
export function applyFilters(ix, f, card, view, checked) {
  const pass = scorePass(f);
  // Order in every view: quadrant → qualitative index → viability → urgency → name.
  const sorter = (a, b) => compareMatch(a.s, b.s);
  const q = normKey(String(f.q ?? '').trim());
  const sit = card === 'marcadas' ? 'marcadas' : f.situacao;
  const base = ix.vagas.filter((v) => passVals(v.vals, f));
  const out = { vagaRows: [], perfilRows: [], todosRows: [], visibleKeys: new Set(), scoreHidden: 0 };
  const hiddenP = new Set();

  const rowsOf = (v, includeEliminated) => {
    const hit = !q || v.text.includes(q);
    const rows = []; const inc = [];
    v.all.forEach((x) => {
      if (x.s.reason && !(includeEliminated || (x.s.reason !== 'existente' && checked.has(x.k)))) return;
      if (!(hit || x.t.includes(q))) return;
      if (!includeEliminated && sit !== 'todas' && (sit === 'marcadas') !== checked.has(x.k)) return;
      if (!pass(x.s.total)) { hiddenP.add(x.s.perfil.id); return; }
      // Incompatible area: kept out of the main ranking, listed in a collapsed section.
      if (x.s.compat?.level === 0) { inc.push(x); return; }
      rows.push(x);
    });
    rows.sort(sorter); inc.sort(sorter);
    rows.incompat = inc;
    return rows;
  };

  if (view === 'todos') {
    base.forEach((v) => {
      const rows = rowsOf(v, true);
      if (!rows.length && !rows.incompat.length) return;
      out.todosRows.push({ ...v.r, sugestoes: rows.map((x) => x.s), incompat: rows.incompat.map((x) => x.s) });
      rows.forEach((x) => { if (!x.s.reason) out.visibleKeys.add(x.k); });
    });
  } else {
    base.forEach((v) => {
      if (card === 'sem') { if (!v.r.sugestoes.length && (!q || v.text.includes(q))) out.vagaRows.push({ ...v.r, sugestoes: [] }); return; }
      const rows = rowsOf(v, false);
      if (!rows.length && !rows.incompat.length) return;
      out.vagaRows.push({ ...v.r, sugestoes: rows.map((x) => x.s), incompat: rows.incompat.map((x) => x.s) });
      rows.forEach((x) => out.visibleKeys.add(x.k));
    });
    if (view === 'perfil') {
      const by = new Map(ix.run.perfis.map((p) => [p.id, { perfil: p, items: [], all: [] }]));
      out.vagaRows.forEach((r) => r.sugestoes.forEach((s) => by.get(s.perfil.id)?.items.push({ r, s })));
      base.forEach((v) => v.all.forEach((x) => { if (pass(x.s.total) && (!q || v.text.includes(q) || x.t.includes(q))) by.get(x.s.perfil.id)?.all.push({ r: v.r, s: x.s }); }));
      const narrowing = MULTI.some((m) => f[m.id].length) || scoreActive(f) || sit !== 'todas';
      out.perfilRows = [...by.values()].filter((b) => {
        if (b.items.length) return true;
        if (ix.hadIds.has(b.perfil.id) || narrowing) return false;
        return !q || (ix.pText.get(b.perfil.id) ?? '').includes(q);
      }).map((b) => ({ ...b, items: b.items.sort(sorter), all: b.all.sort(sorter) }))
        .sort((a, b) => (a.items[0] && b.items[0] ? sorter(a.items[0], b.items[0]) : (b.items.length ? 1 : 0) - (a.items.length ? 1 : 0)) || a.perfil.name.localeCompare(b.perfil.name, 'pt'));
    }
  }
  const visibleP = new Set([...out.visibleKeys].map((k) => k.split(':')[1]));
  out.scoreHidden = [...hiddenP].filter((id) => !visibleP.has(String(id))).length;
  return out;
}
