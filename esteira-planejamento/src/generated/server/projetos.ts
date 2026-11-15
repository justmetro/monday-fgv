import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { Board0201ProjetosEmPlanejamentoBoard } from '@api/BoardSDK';
import { gerentesValidos } from '@generated/server/gerentes-cadastro';
import getServerApiClient from '@api/api-client.server';
import { BOARD_ID } from '@generated/lib/links';

import { obterBase, relerItem, invalidarBase } from '@generated/server/base-dados';
import { invalidarMapa } from '@generated/server/mapa-dados';

export const getBase = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    // Esteira + Histórico, server cache 60 s (stale-while-revalidate); force skips the cache.
    return obterBase(!!data.force);
  });

/** Current monday user — called once when the app opens. */
export const getMe = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    try {
      const me = await new Board0201ProjetosEmPlanejamentoBoard().users.me().execute();
      return { id: me?.id ? String(me.id) : null };
    } catch (e) {
      console.error('Não foi possível identificar o usuário atual', e);
      return { id: null };
    }
  });

const statusField = z.string().min(1).nullable().optional();
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const numField = z.number().finite().nullable().optional();
const ddField = z.array(z.string().min(1)).optional();

export const changesSchema = z
  .object({
    statusPlanejamento: statusField,
    statusSgi: statusField,
    prioridade: statusField,
    radarMonitoramento: statusField,
    alocaoDeEquipe: statusField,
    dimensionamentoConcludo: statusField,
    incioPlanejamento: dateField,
    conclusoDoPlanejamento: dateField,
    conclusoRegistroSgi: dateField,
    conclusoDoDimensionamento: dateField,
    dataValidaoSgi: dateField,
    /** Alocação Gerente — written by the Validação step of "Alocação de Gerentes". */
    alocaoGerente: dateField,
    valorDoContrato: numField,
    equipeOr: numField,
    equipePlan: numField,
    oradoInsumos: numField,
    planejadoInsumos: numField,
    oradoTotal: numField,
    planejadoTotal: numField,
    eixo: ddField,
    uf: ddField,
    tipoPlanejamento: ddField,
    gerente1: ddField,
    /** "Gerente" relation → items of the Mapa de Gerentes (written on 02.01 only). */
    gerente: z.object({ linkedItems: z.array(z.object({ id: z.string().regex(/^\d+$/) })).max(5) }).nullable().optional(),
  })
  .strict();

export type Changes = z.infer<typeof changesSchema>;

/** Fresh read of ONE item from the board (also refreshes it in the server cache). */
export const relerProjeto = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string().regex(/^\d+$/) }).parse(d))
  .handler(async ({ data }) => ({ item: await relerItem(data.id) }));

/** Writes only the changed, non-calculated columns, then re-reads the item so formulas are fresh. */
export const updateProjeto = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string().min(1), changes: changesSchema }).parse(d))
  .handler(async ({ data }) => {
    const board = new Board0201ProjetosEmPlanejamentoBoard();
    const { gerente, ...outros } = data.changes;
    let resto = Object.fromEntries(Object.entries(outros).filter(([, v]) => v !== undefined)) as Omit<Changes, 'gerente'>;
    if (!Object.keys(resto).length && gerente === undefined) throw new Error('Nenhuma alteração para salvar.');

    // The relation is written first and on its own, so its failure can be reported precisely.
    let erroRelacao: string | null = null;
    let ddMantido = false;
    if (gerente !== undefined) {
      try {
        const ids = gerente?.linkedItems.map((i) => i.id) ?? [];
        if (ids.length) {
          const validos = await gerentesValidos(ids);
          if (ids.some((id) => !validos.has(id))) {
            erroRelacao = 'O gerente escolhido não está no grupo “Gerentes” do Mapa com Atividade Atual = GERENTE.';
          }
        }
        if (!erroRelacao) {
          await board.item(data.id).update({ gerente }).execute();
          invalidarBase();
          invalidarMapa();
        }
      } catch (e) {
        console.error('Falha ao gravar a relação Gerente', e);
        erroRelacao = 'O monday recusou a gravação do vínculo com o Mapa de Gerentes. Verifique sua permissão no quadro 02.01 e se o item do gerente ainda existe.';
      }
      if (erroRelacao && resto.gerente1 !== undefined) {
        // Keep dropdown and relation consistent: don't change the dropdown alone.
        const { gerente1: _ignorado, ...semDd } = resto;
        void _ignorado;
        resto = semDd;
        ddMantido = true;
      }
    }

    if (Object.keys(resto).length) {
      try {
        await board.item(data.id).update(resto).execute();
      } finally {
        // Even on error the write may have partly landed: never serve the old cache again.
        invalidarBase();
      }
    }
    // Re-read only this item (fresh formulas); it also replaces the item in the server cache.
    const fresh = await relerItem(data.id);
    if (!fresh) throw new Error('Item salvo, mas não foi possível recarregá-lo do quadro.');
    return { item: fresh, erroRelacao, ddMantido, outrosGravados: Object.keys(resto).length };
  });

/**
 * Validação of "Alocação de Gerentes": relation "Gerente" + dropdown "Gerente" (max. 3 labels) + "Alocação Gerente"
 * in ONE monday update, so a failure writes nothing (no partial state) and the caller keeps the projection Pendente.
 */
export const gravarAlocacao = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({
    id: z.string().min(1),
    gerenteIds: z.array(z.string().regex(/^\d+$/)).min(1).max(3),
    labels: z.array(z.string().trim().min(1)).min(1).max(3),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** substituir = novo/troca (relation becomes the projected managers); adicionar = reforço (added to the current ones). */
    modo: z.enum(['substituir', 'adicionar']),
  }).parse(d))
  .handler(async ({ data }) => {
    const validos = await gerentesValidos(data.gerenteIds);
    if (data.gerenteIds.some((id) => !validos.has(id))) {
      throw new Error('Um dos gerentes não está no grupo “Gerentes” do Mapa com Atividade Atual = GERENTE. Nada foi gravado.');
    }
    const board = new Board0201ProjetosEmPlanejamentoBoard();
    let ids = [...new Set(data.gerenteIds)];
    let labels = [...new Set(data.labels)];
    if (data.modo === 'adicionar') {
      // Reforço: merge with what is on the board right now (not the client copy).
      const atual = await board.item(data.id).withColumns(['gerente', 'gerente1']).execute();
      const idsAtuais = (atual?.gerente?.linkedItems ?? []).map((li) => String(li.id));
      ids = [...new Set([...idsAtuais, ...ids])];
      const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      const porNorm = new Map<string, string>();
      for (const l of [...(atual?.gerente1 ?? []), ...labels]) if (l.trim() && !porNorm.has(norm(l))) porNorm.set(norm(l), l.trim());
      labels = [...porNorm.values()];
    }
    if (ids.length > 3 || labels.length > 3) {
      throw new Error(`O projeto ficaria com ${Math.max(ids.length, labels.length)} gerentes — o máximo é 3. Nada foi gravado.`);
    }
    let avisoDropdown: string | null = null;
    try {
      try {
        // 1) Single write with create_labels_if_missing, so a manager name not yet among the dropdown labels doesn't fail it.
        await escreverComNovosRotulos(data.id, ids, labels, data.data);
      } catch (e1) {
        console.error('Escrita com criação de rótulos falhou; tentando a escrita padrão', data.id, e1);
        try {
          // 2) Standard single write (labels already existing).
          await board.item(data.id).update({ gerente: { linkedItems: ids.map((id) => ({ id })) }, gerente1: labels, alocaoGerente: data.data }).execute();
        } catch (e2) {
          console.error('Escrita padrão falhou; gravando só relação + Alocação Gerente', data.id, e2);
          // 3) Relation + Alocação Gerente only; the dropdown is reported as not updated.
          await board.item(data.id).update({ gerente: { linkedItems: ids.map((id) => ({ id })) }, alocaoGerente: data.data }).execute();
          avisoDropdown = 'O dropdown “Gerente” não foi atualizado (rótulo inexistente ou sem permissão para criar). Relação e Alocação Gerente foram gravadas.';
        }
      }
    } catch (e) {
      console.error('Falha ao gravar a validação no 02.01', data.id, e);
      throw new Error('O monday recusou a gravação (Gerente, dropdown e Alocação Gerente). Nada foi gravado neste projeto.');
    } finally {
      invalidarBase();
      invalidarMapa();
    }
    let item: Awaited<ReturnType<typeof relerItem>> | null = null;
    try {
      item = await relerItem(data.id);
    } catch (e) {
      console.error('Validação gravada, mas o item não foi relido', e);
    }
    return { item, avisoDropdown };
  });

// Column ids of the 02.01 board (relation "Gerente", dropdown "Gerente", date "Alocação Gerente").
const COL_REL_GERENTE = 'board_relation_mm5egrbf';
const COL_DD_GERENTE = 'dropdown_mm6v1tw6';
const COL_ALOC_GERENTE = 'date_mm33vrwt';

/** One change_multiple_column_values with create_labels_if_missing (the typed SDK has no such option). */
async function escreverComNovosRotulos(itemId: string, gerenteIds: string[], labels: string[], dataIso: string) {
  const api = await getServerApiClient();
  const valores = {
    [COL_REL_GERENTE]: { item_ids: gerenteIds.map(Number) },
    [COL_DD_GERENTE]: { labels },
    [COL_ALOC_GERENTE]: { date: dataIso },
  };
  await api.client.request(
    `mutation ($board: ID!, $item: ID!, $values: JSON!) {
      change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values, create_labels_if_missing: true) { id }
    }`,
    { board: BOARD_ID, item: itemId, values: JSON.stringify(valores) },
  );
}
