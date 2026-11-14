import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { gql } from '@generated/lib/monday';
import { B_RISCOS } from '@generated/lib/engineData';
import { readByIds, RISK_FIELDS } from '@generated/lib/fields';
import { loadProjectRisks, parseGrau, toWriteError } from '@generated/data/risks.server';
import { APLICABILIDADE_OPCOES, ESCALA, ESTRATEGIAS, STATUS_TRATAMENTO } from '@generated/lib/config';

const reviewInput = z.object({
  projectId: z.string().min(1),
  aplicabilidade: z.string().optional(),
  categoria: z.string().optional(),
  grupo: z.string().optional(),
  nivel: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['desc', 'asc']).optional(),
});

/** Riscos do projeto para a Revisão. Filtro por nível e ordenação por grau feitos aqui (colunas de fórmula). */
export const getReviewRisks = createServerFn({ method: 'GET' })
  .validator(reviewInput)
  .handler(async ({ data }) => {
    const { items, truncated } = await loadProjectRisks(data.projectId, {
      aplicabilidade: data.aplicabilidade,
      categoria: data.categoria,
      grupo: data.grupo,
      search: data.search?.trim() || undefined,
    });
    const filtered = data.nivel ? items.filter((i) => (i.nvelDeRisco ?? '').trim() === data.nivel) : items;
    const dir = data.sort === 'asc' ? 1 : -1;
    const ordered = [...filtered].sort((a, b) => {
      const ga = parseGrau(a.grauDeRisco);
      const gb = parseGrau(b.grauDeRisco);
      if (ga === null && gb === null) return 0;
      if (ga === null) return 1;
      if (gb === null) return -1;
      return (ga - gb) * dir;
    });
    return { items: ordered, truncated };
  });

/** Riscos aplicáveis do projeto (Tratamento), do maior para o menor grau. */
export const getTreatmentRisks = createServerFn({ method: 'GET' })
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { items, truncated } = await loadProjectRisks(data.projectId, { aplicabilidade: 'Aplicável' });
    const ordered = [...items].sort((a, b) => (parseGrau(b.grauDeRisco) ?? -1) - (parseGrau(a.grauDeRisco) ?? -1));
    return { items: ordered, truncated };
  });

/** Opções de filtro vindas do conjunto completo do projeto (agregação no servidor). */
export const getRiskFilterOptions = createServerFn({ method: 'GET' })
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { items } = await loadProjectRisks(data.projectId);
    const uniq = (v: (string | null | undefined)[]) => [...new Set(v.filter(Boolean) as string[])].sort((x, y) => x.localeCompare(y, 'pt-BR', { numeric: true }));
    return {
      categorias: uniq(items.flatMap((i: any) => i.categoria ?? [])),
      grupos: uniq(items.flatMap((i: any) => i.gruposDeOrigem ?? [])),
      aplicabilidades: uniq(items.map((i: any) => i.aplicabilidade)),
    };
  });

/** Contagem por aplicabilidade (para o contador de aplicáveis e as abas). */
export const getAplicCounts = createServerFn({ method: 'GET' })
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { items } = await loadProjectRisks(data.projectId);
    const counts: Record<string, number> = {};
    for (const i of items as any[]) {
      const key = i.aplicabilidade || 'Identificado';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return { counts, total: items.length };
  });

const nullableEnum = <T extends readonly [string, ...string[]]>(v: T) => z.enum(v).nullable().optional();

const patchSchema = z.object({
  // 'Identificado' só é aceito para desfazer uma marcação e devolver o valor original do motor.
  aplicabilidade: z.enum([...APLICABILIDADE_OPCOES, 'Identificado']).optional(),
  justificativa: z.string().max(10000).nullable().optional(),
  probabilidade: nullableEnum(ESCALA),
  impacto: nullableEnum(ESCALA),
  estrategia: nullableEnum(ESTRATEGIAS),
  resposta: z.string().max(20000).nullable().optional(),
  responsaveis: z.array(z.union([z.string(), z.number()])).nullable().optional(),
  prazo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  periodicidade: z.string().max(500).nullable().optional(),
  statusTratamento: nullableEnum(STATUS_TRATAMENTO),
});

export type RiskPatch = z.infer<typeof patchSchema>;

/**
 * Grava SOMENTE nos campos de revisão/tratamento de um item existente do 09.4.
 * Nunca cria itens, nunca altera nome nem a chave única (projeto|risco).
 */
export const updateRisk = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId: z.string().min(1), patch: patchSchema }))
  .handler(async ({ data }) => {
    const p = data.patch;
    const v: Record<string, unknown> = {};
    const lbl = (x: string | null | undefined) => (x ? { label: x } : null);
    if (p.aplicabilidade !== undefined) v.aplic = { label: p.aplicabilidade };
    if (p.justificativa !== undefined) v.justif = { text: p.justificativa ?? '' };
    if (p.probabilidade !== undefined) v.prob = lbl(p.probabilidade);
    if (p.impacto !== undefined) v.imp = lbl(p.impacto);
    if (p.estrategia !== undefined) v.estrategia = lbl(p.estrategia);
    if (p.resposta !== undefined) v.resposta = { text: p.resposta ?? '' };
    if (p.responsaveis !== undefined) v.responsavel = { personsAndTeams: (p.responsaveis ?? []).map((id) => ({ id: Number(id), kind: 'person' })) };
    if (p.prazo !== undefined) v.prazo = p.prazo ? { date: p.prazo } : null;
    if (p.periodicidade !== undefined) v.periodic = p.periodicidade ?? '';
    if (p.statusTratamento !== undefined) v.status_trat = lbl(p.statusTratamento);
    try {
      await gql('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', {
        b: String(B_RISCOS), i: String(data.itemId), v: JSON.stringify(v),
      });
      // Não aplicáveis ficam num grupo próprio; voltam ao grupo de identificados se reavaliados.
      if (p.aplicabilidade !== undefined) await moveByAplic(data.itemId, p.aplicabilidade).catch((e) => console.error('mover grupo', e));
      const [updated] = await readByIds([data.itemId], RISK_FIELDS);
      return { id: data.itemId, grauDeRisco: updated?.grauDeRisco ?? null, nvelDeRisco: updated?.nvelDeRisco ?? null };
    } catch (e) {
      console.error('updateRisk falhou', e);
      throw toWriteError(e);
    }
  });

let groupsCache: { id: string; title: string }[] | null = null;
async function moveByAplic(itemId: string, aplic: string) {
  if (!groupsCache) groupsCache = (await gql('query ($b: [ID!]) { boards(ids: $b) { groups { id title } } }', { b: [String(B_RISCOS)] }))?.boards?.[0]?.groups ?? [];
  const find = (s: string) => groupsCache!.find((g) => g.title.toLowerCase().startsWith(s))?.id;
  const target = aplic === 'Não aplicável' ? find('não aplicáveis') : aplic === 'Aplicável' ? find('aplicáveis') : find('identificados');
  if (target) await gql('mutation ($i: ID!, $g: String!) { move_item_to_group(item_id: $i, group_id: $g) { id } }', { i: String(itemId), g: target });
}

/** Pessoas para o campo "Responsável pelo monitoramento". */
export const searchUsers = createServerFn({ method: 'GET' })
  .validator(z.object({ term: z.string().optional() }))
  .handler(async ({ data }) => {
    const term = data.term?.trim();
    const users = term
      ? (await gql('query ($n: String) { users(name: $n, limit: 20, kind: non_guests) { id name photo_thumb } }', { n: term }))?.users
      : (await gql('query ($b: [ID!]) { boards(ids: $b) { subscribers { id name photo_thumb } } }', { b: [String(B_RISCOS)] }))?.boards?.[0]?.subscribers;
    return (users ?? []).map((u) => ({ id: String(u.id), name: u.name ?? '', photo: u.photo_thumb ?? null }));
  });
