import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { EquipesRevisadasBoard } from '@api/BoardSDK';

/** SOMENTE LEITURA: única fonte da equipe é o quadro "Equipes Revisadas" (nunca gravamos nele). */

const BOARD_ID = '18437180615';
const COL_PROJETO = 'board_relation_mm8gr0ea';
const COL_NOME = 'text_mm8g100a';
const COL_VALOR = 'numeric_mm8g1jwk';
const COL_CARGO = 'dropdown_mm8gffp8';
const COL_MODALIDADE = 'dropdown_mm8gbphv';
const COLS = [COL_PROJETO, COL_NOME, COL_VALOR, COL_CARGO, COL_MODALIDADE];

const ESTAGIO = '01. estagiário(a)';
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Folha fixa: CLT ("RPA + CLT" conta como CLT), Bolsa, Estágio e RPA fixo. */
export type Modalidade = 'CLT' | 'Bolsa' | 'Estágio' | 'RPA fixo';
/** Retorna a modalidade; null = não informada; 'fora' = outra modalidade (não é folha fixa). */
function modalidadeDe(mods: string[], estagiario: boolean): Modalidade | null | 'fora' {
  if (estagiario) return 'Estágio';
  if (!mods.length) return null;
  const m = mods.map(semAcento);
  if (m.some((x) => x === 'clt' || x === 'rpa + clt')) return 'CLT';
  if (m.includes('bolsa')) return 'Bolsa';
  if (m.includes('estagio')) return 'Estágio';
  if (m.includes('rpa fixo')) return 'RPA fixo';
  return 'fora';
}
const codigoDe = (txt: string | null | undefined) => /^\s*(\d{4}\/\d{2,4})/.exec(txt ?? '')?.[1] ?? null;
const limpo = (s: string | null | undefined) => {
  const t = (s ?? '').trim();
  return t && norm(t) !== '(sem nome)' ? t : null;
};

/** `mensal` = Valor Base Plan. (sem fator de encargos; o fator é aplicado no app). */
export type PessoaAloc = { id: string; nome: string | null; papel: string | null; cargo: string | null; mensal: number | null; modalidade: Modalidade | null };
export type AlocProjeto = { temAlocacao: boolean; pessoas: PessoaAloc[] };

type ColVal = { id: string; text?: string | null; linked_item_ids?: string[] | null; linked_items?: { id: string; name: string }[] | null };
type RawItem = { id: string; name: string; column_values: ColVal[] };
type Page = { cursor: string | null; items: RawItem[] };

const CAMPOS = `cursor items { id name column_values(ids: ${JSON.stringify(COLS)}) { id text ... on BoardRelationValue { linked_item_ids linked_items { id name } } } }`;
const Q_PAGE = `query ($c: String) { boards(ids: [${BOARD_ID}]) { items_page(limit: 100, cursor: $c) { ${CAMPOS} } } }`;
const Q_NOMES = `query ($ids: [ID!]) { items(ids: $ids) { id name } }`;

/**
 * Lê todo o quadro via GraphQL (paginado) e agrupa por código "AAAA/NNN" do item ligado na coluna Projeto.
 * Conta só CLT ("CLT" ou "RPA + CLT"); estagiários nunca contam. Custo = Valor Base Plan.
 */
export const getAlocacao = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new EquipesRevisadasBoard();
    const raw: RawItem[] = [];
    let cursor: string | null = null;
    let guard = 0;
    do {
      const res = (await board.executeGraphQL(Q_PAGE, { c: cursor })) as { boards?: { items_page?: Page }[] };
      const page: Page | undefined = res.boards?.[0]?.items_page;
      raw.push(...(page?.items ?? []));
      cursor = page?.cursor ?? null;
      guard++;
    } while (cursor && guard < 50);

    // Itens ligados sem nome: busca o nome pelos ids (quadro 02.01 Projetos em Planejamento).
    const nomes = new Map<string, string>();
    const semNome = new Set<string>();
    for (const it of raw) {
      const rel = it.column_values.find((c) => c.id === COL_PROJETO);
      for (const l of rel?.linked_items ?? []) nomes.set(String(l.id), l.name);
      for (const id of rel?.linked_item_ids ?? []) if (!nomes.has(String(id))) semNome.add(String(id));
    }
    const faltam = [...semNome].filter((id) => !nomes.has(id));
    for (let i = 0; i < faltam.length; i += 100) {
      try {
        const r = (await board.executeGraphQL(Q_NOMES, { ids: faltam.slice(i, i + 100) })) as { items?: { id: string; name: string }[] };
        for (const x of r.items ?? []) nomes.set(String(x.id), x.name);
      } catch (e) {
        console.error('Falha ao buscar nomes dos projetos ligados', e);
      }
    }

    const by: Record<string, AlocProjeto> = {};
    let semProjeto = 0;
    for (const it of raw) {
      const col = (id: string) => it.column_values.find((c) => c.id === id);
      const rel = col(COL_PROJETO);
      const ids = [...new Set([...(rel?.linked_item_ids ?? []), ...(rel?.linked_items ?? []).map((l) => l.id)].map(String))];
      const codigos = [...new Set(ids.map((id) => codigoDe(nomes.get(id))).filter((c): c is string => !!c))];
      if (!codigos.length) { semProjeto++; continue; }
      const mods = (col(COL_MODALIDADE)?.text ?? '').split(',').map(norm).filter(Boolean);
      const cargos = (col(COL_CARGO)?.text ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const modalidade = modalidadeDe(mods, cargos.some((c) => norm(c) === ESTAGIO));
      const valorTxt = col(COL_VALOR)?.text;
      const valor = valorTxt ? Number(valorTxt) : null;
      for (const codigo of codigos) {
        const p = (by[codigo] ??= { temAlocacao: false, pessoas: [] });
        p.temAlocacao = true;
        if (modalidade === 'fora') continue;
        // Pessoa ligada a vários projetos entra inteira (com custo integral) em cada um.
        p.pessoas.push({
          id: String(it.id), nome: limpo(col(COL_NOME)?.text), papel: limpo(it.name), cargo: cargos[0] ?? null,
          mensal: valor !== null && Number.isFinite(valor) ? valor : null, modalidade,
        });
      }
    }
    return { byCodigo: by, semProjeto };
  });
