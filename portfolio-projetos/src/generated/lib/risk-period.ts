/** Lê o Período do Risco (timeline "início|fim", ou datas no texto) → [início, fim] em AAAA-MM-DD. */
export function periodOf(v: string | null): [string, string] | null {
  if (!v) return null;
  const iso = (x: string) => {
    const a = x.match(/(\d{4})-(\d{2})-(\d{2})/); if (a) return `${a[1]}-${a[2]}-${a[3]}`;
    const b = x.match(/(\d{2})\/(\d{2})\/(\d{4})/); return b ? `${b[3]}-${b[2]}-${b[1]}` : null;
  };
  const parts = v.includes('|') ? v.split('|') : (v.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/g) ?? []);
  const ds = parts.map(iso).filter((x): x is string => !!x);
  if (!ds.length) return null;
  return [ds[0]!, ds[ds.length - 1]!];
}
/** Risco ativo: a data de hoje está dentro do Período do Risco. */
export const isActive = (v: string | null, today: string) => { const p = periodOf(v); return !!p && p[0] <= today && today <= p[1]; };
