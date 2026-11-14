/** Converte texto monetário/numérico em número, tratando vírgula e ponto (pt-BR e en). Null se não houver número. */
export function parseMoney(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).replace(/[^\d,.-]/g, '');
  if (!/\d/.test(s)) return null;
  const lastC = s.lastIndexOf(',');
  const lastD = s.lastIndexOf('.');
  if (lastC >= 0 && lastD >= 0) {
    const dec = lastC > lastD ? ',' : '.';
    const th = dec === ',' ? '.' : ',';
    s = s.split(th).join('').replace(dec, '.');
  } else if (lastC >= 0) {
    const parts = s.split(',');
    // "1,234,567" (milhar) × "1234,5" (decimal pt-BR)
    s = parts.length > 2 ? parts.join('') : s.replace(',', '.');
  } else if (lastD >= 0) {
    const parts = s.split('.');
    // "1.500" ou "1.234.567" em pt-BR = milhar; "1500.5" = decimal
    if (parts.length > 2 || (parts.length === 2 && parts[1]?.length === 3)) s = parts.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function fmtBRL(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Normaliza datas (ISO, dd/mm/aaaa) para AAAA-MM-DD. Mantém null para vazio ou não reconhecido. */
export function toIsoDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1] ?? null;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) return `${br[3]}-${br[2]!.padStart(2, '0')}-${br[1]!.padStart(2, '0')}`;
  return null;
}
