import { toDate } from '@generated/lib/data';

const DAY = 86400000;
// Board dates are calendar days stored at UTC midnight — compare against today's calendar day.
export const todayUTC = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
export const daysSince = (d) => { const dt = toDate(d); return dt ? Math.floor((todayUTC() - dt.getTime()) / DAY) : null; };
export const daysUntil = (d) => { const s = daysSince(d); return s == null ? null : -s; };
export const agoLabel = (d) => {
  const n = daysSince(d);
  if (n == null) return null;
  if (n === 0) return 'hoje';
  if (n === 1) return 'há 1 dia';
  if (n < 0) return n === -1 ? 'amanhã' : `em ${-n} dias`;
  return `há ${n} dias`;
};
export const isOne = (v) => String(v ?? '').trim() === '1';
export const diasDesalocado = (p) => { const n = parseFloat(String(p?.diasDesalocado1 ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
