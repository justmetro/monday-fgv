import { DECISOES, type Row } from '@generated/lib/painel';
import { NIVEIS_PERSPECTIVA, TEMPERATURAS } from '@generated/lib/negocio';

export const VAZIO = '__vazio';
/** Último produto previsto entre hoje e 60 dias. */
export const ATE_60 = '__ate60';
/** Último produto previsto já vencido. */
export const VENCIDOS = '__vencidos';

export type Filtros = {
  q: string;
  status: string[];
  termino: string[]; // 'AAAA-MM', ATE_60 ou VAZIO
  decisao: string[];
  perspectiva: string[];
  soSemDecisao: boolean;
  soPendentes: boolean;
  soProximos90: boolean;
  soVencidos: boolean;
};

export const FILTROS_INICIAIS: Filtros = {
  q: '', status: [], termino: [], decisao: [], perspectiva: [],
  soSemDecisao: false, soPendentes: false, soProximos90: false, soVencidos: false,
};

export function filtrosAtivos(f: Filtros): boolean {
  return JSON.stringify(f) !== JSON.stringify(FILTROS_INICIAIS);
}

export const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** OR dentro do mesmo filtro; valores nulos casam com VAZIO. */
function casa(sel: string[], v: string | null, vazioSeNada = false): boolean {
  if (sel.length === 0) return !vazioSeNada;
  return v === null || v === '' ? sel.includes(VAZIO) : sel.includes(v);
}

/** AND entre filtros. */
export function aplicarFiltros(rows: Row[], f: Filtros): Row[] {
  const q = norm(f.q.trim());
  return rows.filter((r) => {
    const p = r.projeto;
    if (q) {
      const hay = norm([p.name, p.sigla ?? '', p.codigo ?? ''].join(' '));
      if (!hay.includes(q)) return false;
    }
    if (!casa(f.status, p.status)) return false;
    if (f.termino.length) {
      const ate60 = f.termino.includes(ATE_60) && r.dias !== null && r.dias >= 0 && r.dias <= 60;
      const venc = f.termino.includes(VENCIDOS) && r.tom === 'vencido';
      if (!ate60 && !venc && !casa(f.termino.filter((x) => x !== ATE_60 && x !== VENCIDOS), r.termino.date?.slice(0, 7) ?? null, true)) return false;
    }
    if (!casa(f.decisao, r.decisaoLabel)) return false;
    if (!casa(f.perspectiva, r.perspectiva)) return false;
    if (f.soSemDecisao && !r.semDecisao) return false;
    if (f.soPendentes && !(r.pendentes && r.pendentes > 0)) return false;
    if (f.soProximos90 && r.tom !== 'proximo') return false;
    if (f.soVencidos && r.tom !== 'vencido') return false;
    return true;
  });
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function labelMes(ym: string) {
  const [y, m] = ym.split('-');
  return `${MESES[Number(m) - 1] ?? m}/${y}`;
}

export type Opcao = { value: string; label: string; count: number };

/** Opções dos filtros com contagem de projetos do universo em cada uma. */
export function opcoes(rows: Row[]) {
  const contar = (vals: (string | null)[][]) => {
    const m = new Map<string, number>();
    for (const vs of vals) for (const v of new Set(vs.map((x) => (x === null || x === '' ? VAZIO : x)))) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const lista = (m: Map<string, number>, ordem?: string[], vazioLabel?: string, fmt?: (v: string) => string): Opcao[] => {
    const keys = ordem ?? Array.from(m.keys()).filter((k) => k !== VAZIO).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const out = keys.map((k) => ({ value: k, label: fmt ? fmt(k) : k, count: m.get(k) ?? 0 }));
    if (vazioLabel) out.push({ value: VAZIO, label: vazioLabel, count: m.get(VAZIO) ?? 0 });
    return out;
  };
  const status = contar(rows.map((r) => [r.projeto.status]));
  const meses = contar(rows.map((r) => [r.termino.date?.slice(0, 7) ?? null]));
  return {
    status: lista(status).filter((o) => o.value !== VAZIO),
    meses: [
      { value: VENCIDOS, label: 'Vencidos', count: rows.filter((r) => r.tom === 'vencido').length },
      { value: ATE_60, label: '≤ 60 dias', count: rows.filter((r) => r.dias !== null && r.dias >= 0 && r.dias <= 60).length },
      ...lista(meses, Array.from(meses.keys()).filter((k) => k !== VAZIO).sort(), 'Sem data', labelMes),
    ],
    decisoes: lista(contar(rows.map((r) => [r.decisaoLabel])), DECISOES, 'Não preenchida'),
    perspectivas: lista(contar(rows.map((r) => [r.perspectiva])), [...NIVEIS_PERSPECTIVA], 'Não preenchida'),
  };
}
export type Opcoes = ReturnType<typeof opcoes>;

// ── Ordenação ───────────────────────────────────────────────────────────
export type SortKey = 'projeto' | 'status' | 'gerente' | 'termino' | 'pessoas' | 'custo' | 'produtos' | 'perspectiva' | 'temperatura' | 'decisao';
export type Sort = { key: SortKey; dir: 'asc' | 'desc' };

function valor(r: Row, k: SortKey): string | number | null {
  switch (k) {
    case 'projeto': return r.projeto.name;
    case 'status': return r.projeto.status;
    case 'gerente': return r.projeto.gerentes[0] ?? null;
    case 'termino': return r.termino.date;
    case 'pessoas': return r.naoInformada ? null : r.pessoas; // "Não informada" sempre por último
    case 'custo': return r.custoMensal;
    case 'produtos': return r.pendentes;
    case 'perspectiva': return r.perspectiva;
    case 'temperatura': { const i = TEMPERATURAS.findIndex((t) => t === r.temperatura); return i < 0 ? null : i; } // 15 a 30 dias primeiro
    case 'decisao': return r.decisaoLabel;
  }
}

export function ordenar(rows: Row[], s: Sort): Row[] {
  const m = s.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = valor(a, s.key);
    const vb = valor(b, s.key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m;
    return String(va).localeCompare(String(vb), 'pt-BR') * m;
  });
}
