// Value cleanup + canonical labels (accent/case-insensitive) for grouping, filtering and display.
const strip = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const normKey = strip;

const BAD = new Set(['', 'null', 'undefined', '[object object]', 'nan', '-', '—']);

// Turns any raw column value into something safe to render (or null).
export function clean(v) {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) {
    const out = v.map(clean).filter((x) => x != null && typeof x !== 'object');
    return out.length ? out : null;
  }
  if (typeof v === 'object') {
    if (v.url) return v;
    if ('label' in v) return clean(v.label);
    if ('text' in v) return clean(v.text);
    return null;
  }
  const s = String(v).trim();
  return BAD.has(s.toLowerCase()) ? null : s;
}

// Preferred (accented) spellings. Any label whose normalized form matches is shown this way.
const PREFERRED = [
  'Híbrido', 'Não', 'Sim', 'Sem previsão', 'Priorizar realocação interna', 'Disponível para match', 'Aderência confirmada',
  'Aguardando mudança de residência', 'Em formalização (SupGP)', 'Não se aplica', 'Não Iniciado', 'Coordenador(a) de Área',
  'Depende de progressões e realocações', 'Depende de pactuação do projeto', 'Histórico', 'Estagiário(a)', 'Não informado',
];
const ALIASES = { hibrida: 'Híbrido', hibrido: 'Híbrido', historico: 'Histórico', estagiario: 'Estagiário(a)', 'estagiario(a)': 'Estagiário(a)' };
const MAP = new Map(PREFERRED.map((p) => [strip(p), p]));
Object.entries(ALIASES).forEach(([k, v]) => MAP.set(k, v));

export function canon(label) {
  const c = clean(label);
  if (c == null || typeof c !== 'string') return c;
  const key = strip(c);
  if (MAP.has(key)) return MAP.get(key);
  return c.replace(/\bJunior\b/gi, 'Júnior').replace(/\bSenior\b/gi, 'Sênior');
}

// ---- Pill contrast (WCAG) -------------------------------------------------------
const INK_DARK = '#1c1f1e';
const INK_LIGHT = '#ffffff';
const hexRgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (rgb) => { const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); };
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const toHex = (rgb) => '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');

// Picks whichever ink (near-black / white) has the higher contrast over the background (≥ 4.5 whenever possible).
export function inkFor(hex) {
  const rgb = hexRgb(hex);
  if (!rgb) return INK_LIGHT;
  const L = lum(rgb);
  return ratio(L, lum(hexRgb(INK_DARK))) >= ratio(L, 1) ? INK_DARK : INK_LIGHT;
}

// Dark theme: light/neon labels are toned down (same hue, mixed toward black) so they don't glare on graphite.
export function darkTone(hex) {
  const rgb = hexRgb(hex);
  if (!rgb) return hex;
  const L = lum(rgb);
  if (L < 0.3) return hex;
  const k = L > 0.55 ? 0.3 : 0.2;
  return toHex(rgb.map((c) => c * (1 - k)));
}

// CSS variables for a pill: light + dark backgrounds, each with its own contrast-checked ink.
export function pillVars(hex) {
  const d = darkTone(hex);
  return { '--pill': hex, '--pill-ink': inkFor(hex), '--pill-d': d, '--pill-ink-d': inkFor(d) };
}
export const PILL_CLS = 'bg-[var(--pill)] text-[var(--pill-ink)] ring-1 ring-inset ring-foreground/10 dark:bg-[var(--pill-d)] dark:text-[var(--pill-ink-d)] dark:ring-foreground/15';
