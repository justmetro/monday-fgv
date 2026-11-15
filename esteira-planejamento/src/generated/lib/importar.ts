import { normNome } from '@generated/lib/nomes';
import { codigoDe } from '@generated/lib/format';
import type { Destino } from '@generated/lib/alocacao';

/**
 * "Importar prioridades de Negócios": the PDF reading lives in lib/importarPdf (positions + canvas colors);
 * this module links each PDF name to a 02.01 project (UF + agency in brackets + title words; Fase/Aditivo as tie-break).
 */
export { lerPdfPrioridades, type LinhaPdf, type FontePdf } from '@generated/lib/importarPdf';

const norm = (s: string) => normNome(s).replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'a', 'o', 'as', 'os', 'no', 'na', 'nos', 'nas', 'the', 'of', 'and']);
const tokens = (s: string) => new Set(norm(s).split(' ').filter((t) => t.length >= 2 && !STOP.has(t)));
const codigo = (s: string) => s.match(/\b(\d{4}\/\d{2,4})\b/)?.[1] ?? null;
const UFS = new Set('ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to br'.split(' '));
const RE_MARCADOR = /\b(fase|aditivo)(?:\s*(\d{1,3}))?\b/g;

function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** Name parts: "[UF | ÓRGÃO]" prefix (leading "AAAA/NNN" code and "CODSGI" ignored), Fase/Aditivo markers, title tokens. */
interface Partes { colchete: boolean; uf: string | null; orgao: string[]; marcadores: string; titulo: Set<string> }
const cachePartes = new Map<string, Partes>();
function partes(nome: string): Partes {
  const hit = cachePartes.get(nome);
  if (hit) return hit;
  const m = nome.match(/\[([^\]]*)\]/);
  let uf: string | null = null;
  let orgao: string[] = [];
  let titulo: string;
  if (m && m.index !== undefined) {
    const [ufTxt = '', ...resto] = (m[1] ?? '').split('|');
    uf = norm(ufTxt).split(' ')[0] || null;
    orgao = norm(resto.join(' ')).split(' ').filter((t) => t && t !== uf);
    titulo = nome.slice(m.index + m[0].length);
  } else {
    titulo = nome.replace(/^\s*\d{4}\/\d{2,4}\s*/, '').replace(/^\s*codsgi\S*\s*/i, '');
    const sigla = [...titulo.matchAll(/\b([A-Z]{2})\b/g)].map((x) => (x[1] ?? '').toLowerCase()).find((s) => UFS.has(s));
    uf = sigla ?? null;
  }
  const nt = norm(titulo);
  const marcadores = [...nt.matchAll(RE_MARCADOR)].map((x) => `${x[1]}:${x[2] ? String(Number(x[2])) : ''}`).sort().join(',');
  const p: Partes = { colchete: !!m, uf, orgao, marcadores, titulo: tokens(nt.replace(RE_MARCADOR, ' ')) };
  cachePartes.set(nome, p);
  return p;
}

/** Agency tolerance: any shared token or edit distance ≤ 2 (SEEDUC≈SEDUC, SMEC≈SEMEC, "COMO | GIZ"≈"GIZ + MEC"). */
function orgaoCompativel(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return true;
  if (a.some((t) => b.includes(t))) return true;
  return lev(a.join(''), b.join('')) <= 2;
}

/**
 * Score of a 02.01 project for a report name, or null when it can't be the same project.
 * Same "AAAA/NNN" code → direct match. Otherwise: same UF, compatible agency (only when both have brackets),
 * Fase/Aditivo markers only as tie-break (+0.15 when identical), and ≥ 60% of the PDF title's significant tokens present in the project title.
 */
export function pontuar(nome: string, d: Destino): number | null {
  const cod = codigo(nome);
  if (cod && (codigoDe(d.p) === cod || d.p.name.includes(cod))) return 100;
  const a = partes(nome);
  const b = partes(d.p.name);
  if (a.uf && b.uf && a.uf !== b.uf) return null;
  if (a.colchete && b.colchete && !orgaoCompativel(a.orgao, b.orgao)) return null;
  if (!a.titulo.size) return null;
  let comum = 0;
  for (const t of a.titulo) if (b.titulo.has(t)) comum++;
  const ratio = comum / a.titulo.size;
  if (ratio < 0.6) return null;
  const cobertura = comum / Math.max(b.titulo.size, 1);
  const orgaoIgual = a.orgao.join(' ') === b.orgao.join(' ') ? 0.05 : 0;
  const desempate = a.marcadores === b.marcadores ? 0.15 : 0;
  return ratio + 0.5 * cobertura + orgaoIgual + desempate;
}

export function melhorCorrespondencia(nome: string, destinos: Destino[]): { d: Destino; score: number } | null {
  let melhor: { d: Destino; score: number } | null = null;
  for (const d of destinos) {
    const s = pontuar(nome, d);
    if (s !== null && (!melhor || s > melhor.score)) melhor = { d, score: s };
  }
  return melhor;
}

/** Best 02.01 project for a report name, or null ("não encontrado"). */
export function corresponder(nome: string, destinos: Destino[]): Destino | null {
  return melhorCorrespondencia(nome, destinos)?.d ?? null;
}

/**
 * Links every PDF row; when two rows hit the same project, only the highest score keeps it —
 * the other becomes "não encontrado" and both carry a "possível duplicidade" warning.
 */
export function vincularLinhas(nomes: string[], destinos: Destino[]): { projetoId: string | null; aviso: string | null }[] {
  const base = nomes.map((n) => melhorCorrespondencia(n, destinos));
  const vencedor = new Map<string, number>();
  base.forEach((m, i) => {
    if (!m) return;
    const j = vencedor.get(m.d.p.id);
    if (j === undefined || m.score > (base[j]?.score ?? -1)) vencedor.set(m.d.p.id, i);
  });
  const repetidos = new Set(base.filter((m, i) => m && vencedor.get(m.d.p.id) !== i).map((m) => m?.d.p.id));
  return base.map((m, i) => {
    if (!m) return { projetoId: null, aviso: null };
    if (vencedor.get(m.d.p.id) !== i) return { projetoId: null, aviso: `Possível duplicidade: outra linha do PDF casou melhor com “${m.d.p.name}”.` };
    return { projetoId: m.d.p.id, aviso: repetidos.has(m.d.p.id) ? 'Possível duplicidade: outra linha do PDF também casou com este projeto.' : null };
  });
}
