// Utilitários de dias da semana (segunda a domingo) e chaves de identificação única de pessoas
export type WeekdayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

// Semana de domingo a sábado. As sete colunas de check são obrigatórias no quadro:
// se faltar alguma, o envio avisa e não grava nada.
export const WEEKDAYS: { key: WeekdayKey; title: string; short: string; dow: number; required: boolean }[] = [
  { key: 'dom', title: 'Domingo', short: 'Dom', dow: 0, required: true },
  { key: 'seg', title: 'Segunda', short: 'Seg', dow: 1, required: true },
  { key: 'ter', title: 'Terça', short: 'Ter', dow: 2, required: true },
  { key: 'qua', title: 'Quarta', short: 'Qua', dow: 3, required: true },
  { key: 'qui', title: 'Quinta', short: 'Qui', dow: 4, required: true },
  { key: 'sex', title: 'Sexta', short: 'Sex', dow: 5, required: true },
  { key: 'sab', title: 'Sábado', short: 'Sáb', dow: 6, required: true },
];

export const WEEKDAY_KEYS: WeekdayKey[] = WEEKDAYS.map((w) => w.key);
const KEY_SET = new Set<string>(WEEKDAY_KEYS);

export function isWeekdayKey(v: string): v is WeekdayKey {
  return KEY_SET.has(v);
}

export function emptyDayCounts(): Record<WeekdayKey, number> {
  return { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 };
}

export function normText(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Extrai e normaliza e-mail */
export function extractEmail(raw: string | null | undefined): string {
  if (!raw) return '';
  const match = String(raw).match(/[^\s<>"',;]+@[^\s<>"',;]+/);
  return match ? match[0].toLowerCase().trim() : '';
}

/** Dia da semana de uma data AAAA-MM-DD (null só para data inválida). */
export function weekdayOfIso(iso: string): WeekdayKey | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  if (isNaN(d.getTime())) return null;
  return WEEKDAYS.find((w) => w.dow === d.getDay())?.key ?? null;
}

export function weekdayTitle(key: WeekdayKey | string | null | undefined): string {
  return WEEKDAYS.find((w) => w.key === key)?.title ?? '—';
}

/** Ordena dias na ordem da semana (domingo → sábado). */
export function sortDays(days: string[]): WeekdayKey[] {
  return WEEKDAY_KEYS.filter((k) => days.includes(k));
}

/**
 * Coluna de check do quadro para cada dia, casada pelo título e pelo tipo checkbox.
 * As sete (domingo a sábado) são obrigatórias.
 */
export function findWeekdayColumns<C extends { id: string; title: string; type: string }>(
  columns: C[]
): { found: Partial<Record<WeekdayKey, C>>; missing: string[] } | { found: null; missing: string[] } {
  const found: Partial<Record<WeekdayKey, C>> = {};
  const missing: string[] = [];
  WEEKDAYS.forEach((w) => {
    const col = columns.find((c) => normText(c.title) === normText(w.title) && c.type === 'checkbox');
    if (col) found[w.key] = col;
    else if (w.required) missing.push(w.title);
  });
  return missing.length > 0 ? { found: null, missing } : { found, missing };
}

/**
 * Identifica a pessoa:
 * - Se houver e-mail válido, usa o e-mail em minúsculas (identificador primário absoluto).
 * - Sem e-mail, usa o nome normalizado (minúsculas, sem acentos, espaços colapsados).
 */
export function personMatchKey(name: string, email: string): string {
  const e = extractEmail(email);
  if (e) return `e:${e}`;
  return `n:${normText(name)}`;
}

/** Checkbox do monday marcado (pelo valor JSON ou pelo texto "v"). */
export function isCheckedValue(value: string | null | undefined, text: string | null | undefined): boolean {
  if (value) {
    try {
      const parsed = JSON.parse(value) as { checked?: string | boolean } | null;
      if (parsed && (parsed.checked === true || parsed.checked === 'true')) return true;
    } catch {
      /* ignora valor malformado */
    }
  }
  return normText(text) === 'v';
}
