import type { getBase } from '@generated/server/projetos';

export type Projeto = Awaited<ReturnType<typeof getBase>>['items'][number];

/** Status Prospecção "Assinada" and no manager (relation and dropdown empty) → always counted as ACTIVE. */
export function assinadaSemGerente(p: Projeto): boolean {
  const assinada = (p.statusProspeco ?? []).some((s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().startsWith('assinad'));
  return assinada && !(p.gerente?.linkedItems ?? []).length && !(p.gerente1 ?? []).some((g) => g.trim());
}

export const DASH = '—';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function fmtBRL(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? DASH : brl.format(v);
}
export function fmtBRLCompact(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? DASH : brlCompact.format(v);
}
export function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? DASH : `${pct.format(v)}%`;
}
export function fmtInt(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? DASH : int.format(v);
}

/** Accepts Date, ISO strings, "dd/mm/yy", "dd/mm/yyyy" and "yyyy-mm-dd". Returns local-midnight Date. */
export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : startOfDay(utcParts(v));
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    return new Date(y, Number(br[2]) - 1, Number(br[1]));
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

function utcParts(d: Date): Date {
  // Board dates arrive as UTC midnight; keep the calendar day.
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function fmtDate(v: unknown): string {
  const d = toDate(v);
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : DASH;
}

export function today(): Date {
  return startOfDay(new Date());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Parses formula text like "-1.234,56", "R$ 1.234,56", "1234.5", "12%", "-0.15". */
export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/R\$|%|\s/g, '').replace(/\u2212/g, '-');
  if (!s || !/[0-9]/.test(s) || /[a-zA-Z]/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Percent value from a formula; "12%" → 12, "0.12" → 12. */
export function parsePct(v: unknown): number | null {
  const n = parseNum(v);
  if (n === null) return null;
  if (typeof v === 'string' && v.includes('%')) return n;
  return Math.abs(n) <= 1 ? n * 100 : n;
}

export function txt(v: string | null | undefined): string {
  return v && v.trim() ? v.trim() : DASH;
}
export function list(v: string[] | null | undefined): string {
  return v && v.length ? v.join(', ') : DASH;
}

export function gerenteDe(p: Projeto): string {
  const dd = p.gerente1?.filter(Boolean) ?? [];
  if (dd.length) return dd.join(', ');
  const rel = p.gerente?.linkedItems?.map((i) => i.name).filter(Boolean) ?? [];
  return rel.length ? rel.join(', ') : 'Sem gerente';
}

export function codigoDe(p: Projeto): string | null {
  if (p.cdigoProjeto?.trim()) return p.cdigoProjeto.trim();
  const m = p.name.match(/^(\d{4}\/\d{2,4})/);
  return m ? m[1] : null;
}

/** Name without the leading code, for compact rows. */
export function tituloDe(p: Projeto): string {
  const c = codigoDe(p);
  return c && p.name.startsWith(c) ? p.name.slice(c.length).trim() || p.name : p.name;
}
