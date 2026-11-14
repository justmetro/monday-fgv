/** Status de categorização, equipe base e simulação por pessoa (gravados no quadro Decisões do Vibe). */

export const STATUS_CAT_PADRAO = ['Demanda decisão', 'Descontinuidade', 'Em renovação', 'Outros'];
export const SEM_STATUS_CAT = 'Sem status';

export const OPCOES_SIM = ['Realocar', 'Desligar', 'Manter'] as const;
export type OpcaoSim = (typeof OPCOES_SIM)[number];
export const SEM_DEFINICAO = 'Sem definição';
export type OpcaoOuSem = OpcaoSim | typeof SEM_DEFINICAO;
export const OPCOES_COM_SEM: OpcaoOuSem[] = [...OPCOES_SIM, SEM_DEFINICAO];
export const ehOpcaoSim = (v: unknown): v is OpcaoSim => typeof v === 'string' && (OPCOES_SIM as readonly string[]).includes(v);

export type Simulacao = Record<string, OpcaoSim>;

const limpa = (s: string | null | undefined) => (s ?? '').replace(/[|\r\n]+/g, ' ').trim();

/** Uma linha por pessoa: "id | Nome" (legível no quadro e lida de volta pelo id). */
export function serializarBase(pessoas: { id: string; nome: string | null }[]): string {
  return pessoas.map((x) => `${x.id} | ${limpa(x.nome) || 'A identificar'}`).join('\n');
}
export function lerBase(texto: string | null | undefined): string[] {
  const out: string[] = [];
  for (const l of (texto ?? '').split(/\r?\n/)) {
    const id = l.split('|')[0]?.trim();
    if (id && /^\d+$/.test(id)) out.push(id);
  }
  return [...new Set(out)];
}

/** Uma linha por pessoa: "id | Nome | Opção". */
export function serializarSim(sim: Simulacao, nomes: Map<string, string | null>): string {
  return Object.entries(sim).map(([id, op]) => `${id} | ${limpa(nomes.get(id)) || 'A identificar'} | ${op}`).join('\n');
}
export function lerSim(texto: string | null | undefined): Simulacao {
  const out: Simulacao = {};
  for (const l of (texto ?? '').split(/\r?\n/)) {
    const partes = l.split('|').map((x) => x.trim());
    const id = partes[0];
    const op = partes[partes.length - 1];
    if (id && /^\d+$/.test(id) && ehOpcaoSim(op)) out[id] = op;
  }
  return out;
}

export const opcaoDe = (sim: Simulacao, id: string): OpcaoOuSem => sim[id] ?? SEM_DEFINICAO;

/** Tons por opção da simulação. */
export const TOM_SIM: Record<OpcaoOuSem, string> = {
  Realocar: 'bg-[hsl(var(--info-soft))] text-[hsl(var(--info-ink))]',
  Desligar: 'bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger-ink))]',
  Manter: 'bg-[hsl(var(--success-soft))] text-[hsl(var(--success-ink))]',
  [SEM_DEFINICAO]: 'bg-[hsl(var(--neutral-soft))] text-[hsl(var(--neutral-ink))]',
};

type RowGrupo = { statusCat: string | null; equipe: { porModalidade: Record<'CLT' | 'Bolsa' | 'RPA fixo' | 'Estágio', number> } | null; custoMensal: number | null; base: { custoMensal: number | null } };

/** Agrupa por Status (ordem das opções; valores fora da lista depois; "Sem status" por último) com totais por modalidade e custo. */
export function agruparPorStatus<R extends RowGrupo>(rows: R[], opcoes: string[]) {
  const map = new Map<string, R[]>();
  for (const r of rows) {
    const k = r.statusCat?.trim() || SEM_STATUS_CAT;
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  const extras = [...map.keys()].filter((k) => k !== SEM_STATUS_CAT && !opcoes.includes(k)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const ordem = [...opcoes, ...extras, SEM_STATUS_CAT].filter((k) => map.has(k));
  return ordem.map((nome) => {
    const lista = map.get(nome) ?? [];
    const porModalidade = { CLT: 0, Bolsa: 0, 'RPA fixo': 0, 'Estágio': 0 };
    let custo = 0; let custoBase = 0;
    for (const r of lista) {
      for (const m of Object.keys(porModalidade) as (keyof typeof porModalidade)[]) porModalidade[m] += r.equipe?.porModalidade[m] ?? 0;
      custo += r.custoMensal ?? 0; custoBase += r.base.custoMensal ?? 0;
    }
    return { nome, rows: lista, porModalidade, custo, custoBase };
  });
}
