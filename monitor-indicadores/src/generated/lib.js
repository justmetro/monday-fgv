export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MES_REF_LABELS = ['01.Janeiro', '02.Fevereiro', '03.Março', '04.Abril', '05.Maio', '06.Junho', '07.Julho', '08.Agosto', '09.Setembro', '10.Outubro', '11.Novembro', '12.Dezembro'];
export const BOARD_IND = '18400760018';
export const BOARD_PROJ = '18412010674';
export const itemUrl = (board, id) => `https://fgvdgpe-projetos.monday.com/boards/${board}/pulses/${id}`;
export const toDate = (v) => { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? null : d; };
export const fmtDate = (d) => (d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
/** signed "goodness" — positive means better than goal regardless of polarity */
export const score = (a, m, lower) => (lower ? m - a : a - m);

export const fmtNum = (n, d = 1) =>
  Number(n).toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const fmtPct = (n) => (n == null || isNaN(n) ? '—' : `${fmtNum(n)}%`);
export const diffPP = (a, m) => {
  if (a == null || m == null) return '—';
  const d = Math.round((a - m) * 10) / 10;
  return `${d >= 0 ? '+' : '−'}${fmtNum(Math.abs(d))} p.p.`;
};
export const isHit = (a, m, lower) => (m == null || a == null ? null : lower ? a <= m : a >= m);
export const fmtDiff = (a, m, lower) => (m == null ? 'Sem meta definida' : `${isHit(a, m, lower) ? 'Meta atingida' : 'Abaixo da meta'}: ${diffPP(a, m)}`);

export function parseStart(periodo) {
  const from = periodo?.from;
  if (!from) return null;
  const s = typeof from === 'string' ? from.slice(0, 10) : new Date(from).toISOString().slice(0, 10);
  const [y, m] = s.split('-').map(Number);
  if (!y || !m) return null;
  return { key: y * 100 + m, month: m - 1, label: `${MESES[m - 1]}/${String(y).slice(2)}`, year: y };
}
export const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

/** "sem casos": Total Período empty or 0 */
export const noCase = (m) => !!m && !(m.d > 0);
/** state: hit | miss | nometa | nocase | parcial | na */
export const stateOf = (a, m, lower) => (m == null ? 'nometa' : isHit(a, m, lower) ? 'hit' : 'miss');
export function cellState(m, lower) {
  if (!m) return 'na';
  if (m.parcial) return 'parcial';
  if (noCase(m)) return 'nocase';
  return stateOf(m.apurado, m.meta, lower);
}
const UNID = { 1: 'projetos', 2: 'profissionais', 3: 'produtos' };
/** unit word by code family: IT1.x → projetos · IT2.x → profissionais · IT3.x → produtos */
export const unidade = (i) => UNID[Number(String(i?.code ?? '').match(/^[A-Z]+(\d)/i)?.[1]) || i?.obj] ?? 'itens';
/** "R$ 1.234.567" · compact: "R$ 1,2 mi" */
export const fmtBRL = (n, compact) => (n == null || isNaN(n) ? '—'
  : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: compact ? 1 : 0, ...(compact ? { notation: 'compact' } : {}) }));
/** count fraction "10/34" (Atingido / Total Período) — null for saldo (R$) indicators and "sem casos" */
export const fracOf = (r) => (!r || r.saldo || noCase(r) ? null : `${fmtNum(r.n ?? 0)}/${fmtNum(r.d)}`);
/** saldo indicators: "Saldo R$ X de R$ Y orçado" */
export const saldoText = (r, compact) => (r?.saldo && r.d > 0 ? `Saldo ${fmtBRL(r.n ?? 0, compact)} de ${fmtBRL(r.d, compact)} orçado` : null);
/** YYYY-MM-DD of a board date (stored as UTC midnight) */
export const ymd = (d) => (d ? d.toISOString().slice(0, 10) : null);
/** today's local date as YYYY-MM-DD */
export const todayYmd = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

const OBJ_COR = { 1: 'bg-[hsl(var(--obj1))]', 2: 'bg-[hsl(var(--obj2))]', 3: 'bg-[hsl(var(--obj3))]' };
export const objCor = (n) => OBJ_COR[n] ?? 'bg-[hsl(var(--obj-x))]';
/** "Objetivo 2 - Promover…" → "OBJ.2 – Promover…" */
export const objNome = (label, n) => (label ? label.replace(/^Objetivo\s*(\d+)\s*[-–]\s*/i, 'OBJ.$1 – ') : n ? `OBJ.${n}` : 'Sem objetivo');
/** natural sort: IT1.2 < IT1.10; IO2.1.1 < IO2.1.2 */
export const natCmp = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
/** indicators grouped by objective, preserving order */
export function objGroups(ind) {
  const out = [];
  ind.forEach((i) => { let g = out.find((x) => x.id === i.objInfo.id); if (!g) out.push(g = { ...i.objInfo, inds: [] }); g.inds.push(i); });
  return out;
}
export const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, k) => arr.slice(k * n, k * n + n));
export const NIVEL_TITULO = { tat: 'Táticos', op: 'Operacionais', all: 'Táticos e Operacionais' };
