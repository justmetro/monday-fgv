/**
 * Global period filter (header), kept in the URL as `per`:
 *  - missing                    → CURRENT YEAR (default; moves to the new year by itself on 1 January)
 *  - "todos"                    → all years (no filter; projects without date included)
 *  - "a:2025"                   year
 *  - "m:2026-01,2026-03"        one or more months
 *  - "t:2026-1"                 quarter (T1–T4) + year
 *  - "i:2026-01-15..2026-06-30" interval (either end may be empty)
 */
export type PeriodoGlobal =
  | { tipo: 'ano'; ano: number }
  | { tipo: 'meses'; meses: string[] }
  | { tipo: 'trimestre'; ano: number; t: 1 | 2 | 3 | 4 }
  | { tipo: 'intervalo'; de: string; ate: string };

export const PER_TODOS = 'todos';
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const anoCorrente = (hoje = new Date()): PeriodoGlobal => ({ tipo: 'ano', ano: hoje.getFullYear() });

export function lerPeriodo(v: unknown): PeriodoGlobal | null {
  if (typeof v !== 'string' || v.length < 3) return null;
  const [tipo, resto = ''] = [v.slice(0, 1), v.slice(2)];
  if (tipo === 'a') return /^\d{4}$/.test(resto) ? { tipo: 'ano', ano: Number(resto) } : null;
  if (tipo === 'm') {
    const meses = [...new Set(resto.split(',').filter((m) => MES_RE.test(m)))].sort();
    return meses.length ? { tipo: 'meses', meses } : null;
  }
  if (tipo === 't') {
    const m = resto.match(/^(\d{4})-([1-4])$/);
    return m ? { tipo: 'trimestre', ano: Number(m[1]), t: Number(m[2]) as 1 | 2 | 3 | 4 } : null;
  }
  if (tipo === 'i') {
    const [de = '', ate = ''] = resto.split('..');
    const ok = (s: string) => s === '' || DIA_RE.test(s);
    return ok(de) && ok(ate) && (de || ate) ? { tipo: 'intervalo', de, ate } : null;
  }
  return null;
}

/** URL value. The current year is stored as "missing" so the default keeps following the calendar. */
export function gravarPeriodo(p: PeriodoGlobal | null): string | undefined {
  if (!p) return PER_TODOS;
  if (p.tipo === 'ano') return p.ano === new Date().getFullYear() ? undefined : `a:${p.ano}`;
  if (p.tipo === 'meses') return p.meses.length ? `m:${p.meses.join(',')}` : PER_TODOS;
  if (p.tipo === 'trimestre') return `t:${p.ano}-${p.t}`;
  return p.de || p.ate ? `i:${p.de}..${p.ate}` : PER_TODOS;
}

/** URL value → effective period (missing / invalid = current year; "todos" = no filter). */
export function periodoDaUrl(v: unknown, hoje = new Date()): PeriodoGlobal | null {
  if (v === PER_TODOS) return null;
  return lerPeriodo(v) ?? anoCorrente(hoje);
}
/** Sanitized URL value for validateSearch. */
export const normalizarPer = (v: unknown): string | undefined => (v === PER_TODOS ? PER_TODOS : gravarPeriodo(lerPeriodo(v) ?? anoCorrente()));

export const mesKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const dia = (s: string, fim: boolean) => (s ? new Date(`${s}T${fim ? '23:59:59' : '00:00:00'}`) : null);

/** True when the date is inside the period; `null` period = everything passes. A missing date never passes a set period. */
export function noPeriodo(d: Date | null, p: PeriodoGlobal | null): boolean {
  if (!p) return true;
  if (!d) return false;
  if (p.tipo === 'ano') return d.getFullYear() === p.ano;
  if (p.tipo === 'meses') return p.meses.includes(mesKey(d));
  if (p.tipo === 'trimestre') return d.getFullYear() === p.ano && Math.floor(d.getMonth() / 3) + 1 === p.t;
  const de = dia(p.de, false);
  const ate = dia(p.ate, true);
  return (!de || d >= de) && (!ate || d <= ate);
}

/**
 * Same as `noPeriodo`, but a MISSING date (e.g. project not yet signed) also passes while the period's
 * year is the current year — so unsigned projects stay visible in the default (current year) view and
 * disappear again once the year rolls over or a past year is chosen explicitly.
 */
export function noPeriodoOuNaoAssinado(d: Date | null, p: PeriodoGlobal | null): boolean {
  if (!p) return true;
  if (d) return noPeriodo(d, p);
  return anoDoPeriodo(p) === new Date().getFullYear();
}

/** Inclusive start/end Date of a period; open interval ends become far sentinel dates ("sem fim"). */
export function limitesDoPeriodo(p: PeriodoGlobal): { inicio: Date; fim: Date } {
  if (p.tipo === 'ano') return { inicio: new Date(p.ano, 0, 1), fim: new Date(p.ano, 11, 31, 23, 59, 59, 999) };
  if (p.tipo === 'trimestre') {
    const m0 = (p.t - 1) * 3;
    return { inicio: new Date(p.ano, m0, 1), fim: new Date(p.ano, m0 + 3, 0, 23, 59, 59, 999) };
  }
  if (p.tipo === 'meses') {
    const ord = [...p.meses].sort();
    const ini = ord[0] ?? mesKey(new Date());
    const fimM = ord[ord.length - 1] ?? ini;
    const [ay, am] = ini.split('-').map(Number) as [number, number];
    const [by, bm] = fimM.split('-').map(Number) as [number, number];
    return { inicio: new Date(ay, am - 1, 1), fim: new Date(by, bm, 0, 23, 59, 59, 999) };
  }
  const inicio = p.de ? new Date(`${p.de}T00:00:00`) : new Date(-8_640_000_000_000_000);
  const fim = p.ate ? new Date(`${p.ate}T23:59:59`) : new Date(8_640_000_000_000_000);
  return { inicio, fim };
}

/** Year the period belongs to (year selector of the header); null = all years / multi-year interval. */
export function anoDoPeriodo(p: PeriodoGlobal | null): number | null {
  if (!p) return null;
  if (p.tipo === 'ano' || p.tipo === 'trimestre') return p.ano;
  if (p.tipo === 'meses') {
    const anos = new Set(p.meses.map((m) => Number(m.slice(0, 4))));
    return anos.size === 1 ? [...anos][0] ?? null : null;
  }
  const a = p.de.slice(0, 4);
  return a && a === p.ate.slice(0, 4) ? Number(a) : null;
}

export function rotuloPeriodoGlobal(p: PeriodoGlobal | null): string {
  if (!p) return 'Todos os anos';
  if (p.tipo === 'ano') return `Ano ${p.ano}`;
  if (p.tipo === 'meses') {
    const r = p.meses.map((m) => `${MESES_CURTOS[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`);
    return r.length > 3 ? `${r.slice(0, 3).join(', ')} +${r.length - 3}` : r.join(', ');
  }
  if (p.tipo === 'trimestre') return `T${p.t} ${p.ano}`;
  const f = (s: string) => (s ? s.split('-').reverse().join('/') : '…');
  return `${f(p.de)} a ${f(p.ate)}`;
}

/** Shortcuts: current month, last 3 / 6 months (including the current one), current year. */
export function atalho(k: 'mes' | '3m' | '6m' | 'ano', hoje = new Date()): PeriodoGlobal {
  if (k === 'ano') return anoCorrente(hoje);
  const n = k === 'mes' ? 1 : k === '3m' ? 3 : 6;
  const meses = Array.from({ length: n }, (_, i) => mesKey(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1))).sort();
  return { tipo: 'meses', meses };
}

/** The 12 months of a year as "YYYY-MM". */
export const mesesDoAno = (ano: number) => Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
export const rotuloMes = (m: string) => `${MESES_CURTOS[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}`;
export const rotuloMesLongo = (m: string) => `${MESES_LONGOS[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}`;

const somaMes = (m: string, n: number) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1); return mesKey(d); };

/**
 * Months covered by a period (charts by month). Year / quarter / months: their months; interval: from start to end
 * (open ends use the data dates); no period: the months present in the data (last 24).
 */
export function mesesDoPeriodo(p: PeriodoGlobal | null, datas: Date[]): string[] {
  if (p?.tipo === 'ano') return mesesDoAno(p.ano);
  if (p?.tipo === 'trimestre') return Array.from({ length: 3 }, (_, i) => `${p.ano}-${String((p.t - 1) * 3 + i + 1).padStart(2, '0')}`);
  if (p?.tipo === 'meses') return p.meses;
  const ks = datas.map(mesKey).sort();
  const ini = p?.tipo === 'intervalo' && p.de ? p.de.slice(0, 7) : ks[0];
  const fim = p?.tipo === 'intervalo' && p.ate ? p.ate.slice(0, 7) : ks[ks.length - 1];
  if (!ini || !fim || ini > fim) return [];
  const out: string[] = [];
  for (let m = ini; m <= fim && out.length < 120; m = somaMes(m, 1)) out.push(m);
  return p ? out : out.slice(-24);
}

/** Previous CLOSED period of the same size (year → previous year, quarter → previous quarter, N months → the N before). */
export function periodoAnterior(p: PeriodoGlobal | null): PeriodoGlobal | null {
  if (!p) return null;
  if (p.tipo === 'ano') return { tipo: 'ano', ano: p.ano - 1 };
  if (p.tipo === 'trimestre') return p.t === 1 ? { tipo: 'trimestre', ano: p.ano - 1, t: 4 } : { tipo: 'trimestre', ano: p.ano, t: (p.t - 1) as 1 | 2 | 3 };
  if (p.tipo === 'meses') {
    const ini = p.meses[0];
    const fim = p.meses[p.meses.length - 1];
    if (!ini || !fim) return null;
    const span = (Number(fim.slice(0, 4)) - Number(ini.slice(0, 4))) * 12 + Number(fim.slice(5)) - Number(ini.slice(5)) + 1;
    return { tipo: 'meses', meses: p.meses.map((m) => somaMes(m, -span)) };
  }
  if (!p.de || !p.ate) return null;
  const de = new Date(`${p.de}T00:00:00`);
  const ate = new Date(`${p.ate}T00:00:00`);
  const dias = Math.round((ate.getTime() - de.getTime()) / 86_400_000) + 1;
  const f = (d: Date) => `${mesKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
  return { tipo: 'intervalo', de: f(new Date(de.getTime() - dias * 86_400_000)), ate: f(new Date(de.getTime() - 86_400_000)) };
}
