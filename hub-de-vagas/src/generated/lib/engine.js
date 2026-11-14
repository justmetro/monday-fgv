import { COLORS, colorFor } from '@generated/lib/colors';
import { fmtDate, toDate, normText, monthLabelOf, monthKey } from '@generated/lib/data';
import { clean, canon, normKey } from '@generated/lib/normalize';

export const EMPTY = 'Sem informação';

export const rawVal = (field, item) => {
  if (!field || !item) return null;
  try { return clean(field.get ? field.get(item) : item[field.key]); } catch { return null; }
};
const canonOf = (field, v) => (['status', 'text', 'month'].includes(field.type) ? canon(v) : v);

export function textVal(field, item) {
  const v = rawVal(field, item);
  if (v == null || v === '') return '';
  switch (field.type) {
    case 'date': return fmtDate(v);
    case 'list': return Array.isArray(v) ? v.map(canon).join(', ') : String(canon(v));
    case 'link': return v?.url ?? '';
    case 'number': return typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v);
    case 'status': return String(canon(v) ?? '');
    default: return Array.isArray(v) ? v.join(', ') : String(v);
  }
}

// Values used for filtering / grouping (lists expand into several)
export function keysOf(field, item) {
  const v = rawVal(field, item);
  if (field.type === 'list') return Array.isArray(v) && v.length ? [...new Set(v.map(canon).filter(Boolean))] : [EMPTY];
  if (field.type === 'date') return [monthLabelOf(v) ?? EMPTY];
  if (v == null || v === '') return [EMPTY];
  return [String(canonOf(field, v))];
}

function compareKeys(field, a, b) {
  if (a === EMPTY) return 1;
  if (b === EMPTY) return -1;
  if (field.order) {
    const o = field.order.map(normKey);
    const ia = o.indexOf(normKey(a)), ib = o.indexOf(normKey(b));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, 'pt');
  }
  if (field.sortKey) return field.sortKey(a) - field.sortKey(b);
  const ma = monthKey(a), mb = monthKey(b);
  const isM = (x) => x !== Number.MAX_SAFE_INTEGER;
  if (field.type === 'date' || field.type === 'month' || (isM(ma) && isM(mb))) return ma - mb || a.localeCompare(b, 'pt');
  const order = COLORS[field.key] ? Object.keys(COLORS[field.key]).map(normKey) : null;
  if (order) {
    const ia = order.indexOf(normKey(a)), ib = order.indexOf(normKey(b));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, 'pt');
  }
  if (field.type === 'number') return Number(a) - Number(b);
  return a.localeCompare(b, 'pt');
}

// Accent-richer spelling wins when two labels differ only by accents/case ("Gestao" vs "Gestão").
const accents = (s) => (s.normalize('NFD').match(/[\u0300-\u036f]/g) ?? []).length;
function bucket(field, items) {
  const map = new Map();
  items.forEach((it) => keysOf(field, it).forEach((k) => {
    const nk = normKey(k);
    const cur = map.get(nk);
    if (!cur) map.set(nk, { label: k, items: [it] });
    else {
      if (accents(k) > accents(cur.label)) cur.label = k;
      if (cur.items[cur.items.length - 1] !== it) cur.items.push(it);
    }
  }));
  return [...map.values()].sort((x, y) => compareKeys(field, x.label, y.label));
}

export function distinctValues(field, items) {
  return bucket(field, items).map((g) => ({ value: g.label, count: g.items.length }));
}

export function matchesFilters(item, filters, resolve) {
  return Object.entries(filters).every(([key, vals]) => {
    if (!vals?.length) return true;
    const field = resolve(key);
    if (!field) return true;
    const want = new Set(vals.map(normKey));
    return keysOf(field, item).some((k) => want.has(normKey(k)));
  });
}

export function matchesSearch(item, term, fields) {
  if (!term) return true;
  return fields.some((field) => normText(textVal(field, item)).includes(term));
}

export function sortItems(items, sort, field) {
  if (!sort || !field) return items;
  const dir = sort.dir === 'desc' ? -1 : 1;
  const val = (it) => {
    const v = rawVal(field, it);
    if (field.type === 'date') return toDate(v)?.getTime() ?? null;
    if (field.type === 'number') return typeof v === 'number' ? v : null;
    if (field.sortKey) return v ? field.sortKey(v) : null;
    return textVal(field, it) || null;
  };
  return [...items].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt')) * dir;
  });
}

// Build nested groups: [{ id, label, color, items, children }]
export function buildTree(items, levelFields, parentId = 'root') {
  if (!levelFields.length) return null;
  const [field, ...rest] = levelFields;
  return bucket(field, items).map(({ label: k, items: list }, idx) => {
    const id = `${parentId}/${field.key}:${normKey(k)}`;
    return { id, label: k, field, empty: k === EMPTY, color: k === EMPTY ? '#c4c4c4' : colorFor(field.key, k, idx), items: list, children: buildTree(list, rest, id) };
  });
}

export function collectIds(nodes, out = []) {
  (nodes ?? []).forEach((n) => { out.push(n.id); collectIds(n.children, out); });
  return out;
}

export function downloadCSV(filename, columns, rows) {
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(';'), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(';'))];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
