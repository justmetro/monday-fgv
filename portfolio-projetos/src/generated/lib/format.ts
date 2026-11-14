export const UNAVAILABLE = 'Indisponível na importação';
export const UNMAPPED = 'Campo não mapeado';
export const EMPTY = '—';

const NUM = /^-?\d+(?:[.,]\d+)?\s*%?$/;

/** Formata número em pt-BR preservando a precisão de origem. 184.5 → "184,5"; "200%" → "200%". */
export function fmtNumberish(raw: string): string {
  const s = raw.trim();
  if (!NUM.test(s)) return s;
  const pct = s.endsWith('%');
  const core = s.replace('%', '').trim();
  if (core.includes(',') && !core.includes('.')) return s; // já em pt-BR
  const decimals = core.split('.')[1]?.length ?? 0;
  const n = Number(core);
  if (!Number.isFinite(n)) return s;
  const out = n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return pct ? `${out}%` : out;
}

export type ValState = 'ok' | 'empty' | 'unavailable' | 'unmapped' | 'na';

export function valState(rec: { unavailable: string[]; unmapped: string[] }, key: string, v: string | null): ValState {
  if (rec.unmapped.includes(key)) return 'unmapped';
  if (rec.unavailable.includes(key)) return 'unavailable';
  if (v == null) return 'empty';
  if (/^(n\/?a|não aplicável|nao aplicavel)$/i.test(v.trim())) return 'na';
  return 'ok';
}

export function fmtField(rec: { unavailable: string[]; unmapped: string[] }, key: string, v: string | null): string {
  const st = valState(rec, key, v);
  if (st === 'unmapped') return UNMAPPED;
  if (st === 'unavailable') return UNAVAILABLE;
  if (st === 'empty') return EMPTY;
  if (st === 'na') return 'Não aplicável';
  return fmtNumberish(v as string);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtPeriodo(v: string | null): string {
  if (!v) return EMPTY;
  const [a, b] = v.split('|');
  return `${fmtDate(a || null)} – ${fmtDate(b || null)}`;
}

export function fmtPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function typeKind(tipo: string | null): 'KR' | 'KPI' | 'OUTRO' {
  const t = (tipo ?? '').toUpperCase();
  if (t.startsWith('KR')) return 'KR';
  if (t.startsWith('KPI')) return 'KPI';
  return 'OUTRO';
}
