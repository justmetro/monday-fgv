import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  HistoricoDeProjetosBoard,
  LevantamentoDeProdutosBoard,
  DecisoesDoVibeBoard,
} from '@api/BoardSDK';
import { mapProjeto, mapProduto, mapDecisao, isoToUtcDate, timelineWrite, DECISAO_COLS } from '@generated/server/mappers.server';
import { garantirItemDecisao } from '@generated/server/log.server';
import { OPCOES_SIM, serializarBase, serializarSim, type Simulacao } from '@generated/lib/extras';

/** Quadro A — todos os projetos com "Equipe alocada" (cursor completo; universo pequeno). */
export const getProjetos = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new HistoricoDeProjetosBoard();
    const out: ReturnType<typeof mapProjeto>[] = [];
    let cursor: string | null = null;
    let guard = 0;
    do {
      const q = board
        .items()
        .withColumns([
          'siglaDoProjeto', 'cdigoDoProjeto', 'statusDoProjeto', 'alocaoDeEquipe', 'gerenteAtual',
          'cliente', 'eixoDeProjeto', 'reaQueAcompanha', 'centroDeCusto', 'valorContrato',
          'inciofimContratual', 'inciofimExecuoPrevisto', 'dataDeInciofimExecuo', 'incioRealDaOperao',
          'fimRealDaOperao', 'ltimaEntregaPrevista', 'ltimoFaturamentoPrevisto', 'alertaDesalocao',
          'quadroDoProjeto', 'faixaDeComplexidadeEspelho',
        ])
        .where({ alocaoDeEquipe: 'Equipe alocada' })
        .orderBy({ column: 'name', direction: 'asc' });
      const res = await (cursor ? q.withPagination({ limit: 100, cursor }) : q.withPagination({ limit: 100 })).execute();
      for (const it of res.items) out.push(mapProjeto(it));
      cursor = res.cursor ?? null;
      guard++;
    } while (cursor && guard < 30);
    return { items: out };
  });

/** Quadro C — todas as decisões (1 item por projeto). */
export const getDecisoes = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new DecisoesDoVibeBoard();
    const out: ReturnType<typeof mapDecisao>[] = [];
    let cursor: string | null = null;
    let guard = 0;
    do {
      const q = board.items().withColumns([...DECISAO_COLS]);
      const res = await (cursor ? q.withPagination({ limit: 100, cursor }) : q.withPagination({ limit: 100 })).execute();
      for (const it of res.items) out.push(mapDecisao(it));
      cursor = res.cursor ?? null;
      guard++;
    } while (cursor && guard < 30);
    return { items: out };
  });

/** Quadro B — produtos NÃO concluídos dos projetos informados (consultas paralelas por projeto). */
export const getProdutos = createServerFn({ method: 'POST' })
  .validator(z.object({ projectIds: z.array(z.string()).max(20) }))
  .handler(async ({ data }) => {
    const board = new LevantamentoDeProdutosBoard();
    const entries = await Promise.all(
      data.projectIds.map(async (pid) => {
        const list: ReturnType<typeof mapProduto>[] = [];
        let cursor: string | null = null;
        let guard = 0;
        do {
          const q = board
            .items()
            .withColumns([
              'projeto', 'nomeDoProduto', 'statusDoProduto', 'prazoDeEntrega', 'dataPrevistaDeEntrega',
              'statusAtrasoEntregaAgregado', 'valorDoProduto', 'tipo', 'dataDeEntregaRealCorporativo', 'statusAtrasoEntrega',
            ])
            .where({ projeto: { itemId: pid } });
          const res = await (cursor ? q.withPagination({ limit: 100, cursor }) : q.withPagination({ limit: 100 })).execute();
          for (const it of res.items) {
            // Todos os produtos do projeto; o app separa ativos x entregues (produtoAtivo).
            list.push(mapProduto(it));
          }
          cursor = res.cursor ?? null;
          guard++;
        } while (cursor && guard < 20);
        return [pid, list] as const;
      }),
    );
    const byProject: Record<string, ReturnType<typeof mapProduto>[]> = {};
    for (const [pid, list] of entries) byProject[pid] = list;
    return { byProject };
  });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const timeline = z.object({ from: z.string().regex(ISO), to: z.string().regex(ISO) }).nullable().optional();
const isoDate = z.string().regex(ISO).nullable().optional();

/** Grava prazos e alerta de desalocação no quadro A (Status do Projeto e Alocação são somente leitura). */
export const updateProjeto = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string(),
      alertaDesalocao: z.string().nullable().optional(),
      inciofimContratual: timeline,
      dataDeInciofimExecuo: timeline,
      incioRealDaOperao: isoDate,
      fimRealDaOperao: isoDate,
      ltimaEntregaPrevista: isoDate,
      ltimoFaturamentoPrevisto: isoDate,
    }),
  )
  .handler(async ({ data }) => {
    const payload = {
      alertaDesalocao: data.alertaDesalocao,
      inciofimContratual: timelineWrite(data.inciofimContratual),
      dataDeInciofimExecuo: timelineWrite(data.dataDeInciofimExecuo),
      incioRealDaOperao: isoToUtcDate(data.incioRealDaOperao),
      fimRealDaOperao: isoToUtcDate(data.fimRealDaOperao),
      ltimaEntregaPrevista: isoToUtcDate(data.ltimaEntregaPrevista),
      ltimoFaturamentoPrevisto: isoToUtcDate(data.ltimoFaturamentoPrevisto),
    };
    const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)) as typeof payload;
    if (Object.keys(clean).length === 0) return { ok: true };
    await new HistoricoDeProjetosBoard().item(data.id).update(clean).execute();
    return { ok: true };
  });

export type ParteSalva = { parte: 'decisao' | 'equipe' | 'responsaveis'; ok: boolean; erro?: string };
const msgErro = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/**
 * Cria (1º salvamento) ou atualiza o item de decisão do projeto no quadro C.
 * Cada parte (decisão, equipe, responsáveis) é gravada separadamente: uma falha não derruba as outras.
 * Perspectiva é gravada à parte por salvarPerspectivaQuadro.
 */
export const saveContinuidade = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      decisionId: z.string().nullable().optional(),
      projectId: z.string(),
      projectName: z.string().min(1),
      fields: z.object({
        nClt: z.number().nullable().optional(),
        nEstgio: z.number().nullable().optional(),
        custoMensalEquipeR: z.number().nullable().optional(),
        atualizaoDaEquipe: isoDate,
        deciso: z.string().nullable().optional(),
        mesesDeManuteno: z.number().nullable().optional(),
        detalheDaDeciso: z.string().nullable().optional(),
        responsvelPelaDeciso: z.array(z.string()).nullable().optional(),
        dataDaDeciso: isoDate,
      }),
    }),
  )
  .handler(async ({ data }) => {
    const board = new DecisoesDoVibeBoard();
    const f = data.fields;
    const semUndef = <T extends Record<string, unknown>>(o: T) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

    // 1) Garante o item (somente nome + ligação ao projeto). Falha aqui interrompe: não há onde gravar.
    let id = data.decisionId ?? null;
    let created = false;
    if (!id) {
      const found = await board.items().withColumns(['projeto']).where({ projeto: { itemId: data.projectId } }).withPagination({ limit: 1 }).execute();
      const existing = found?.items?.[0];
      if (existing) {
        id = String(existing.id);
      } else {
        const novo = await board.item().create({ name: data.projectName, projeto: { linkedItems: [{ id: data.projectId }] } }).execute();
        id = String(novo.id);
        created = true;
      }
    }
    const itemId = id;

    // 2) Cada parte em sua própria atualização.
    const partes: ParteSalva[] = [];
    const rodar = async (parte: ParteSalva['parte'], payload: Record<string, unknown>, fn: () => Promise<unknown>) => {
      if (Object.keys(payload).length === 0) return;
      try {
        await fn();
        partes.push({ parte, ok: true });
      } catch (e) {
        console.error('saveContinuidade', parte, e);
        partes.push({ parte, ok: false, erro: msgErro(e) });
      }
    };
    const decisao = semUndef({
      deciso: f.deciso, mesesDeManuteno: f.mesesDeManuteno, detalheDaDeciso: f.detalheDaDeciso, dataDaDeciso: f.dataDaDeciso === undefined ? undefined : isoToUtcDate(f.dataDaDeciso),
    });
    const equipe = semUndef({
      nClt: f.nClt, nEstgio: f.nEstgio, custoMensalEquipeR: f.custoMensalEquipeR,
      atualizaoDaEquipe: f.atualizaoDaEquipe === undefined ? undefined : isoToUtcDate(f.atualizaoDaEquipe),
    });
    const resp = f.responsvelPelaDeciso;
    const responsaveis = resp === undefined ? {} : {
      responsvelPelaDeciso: resp && resp.length ? resp.map((pid) => ({ id: pid, kind: 'person' as const })) : null,
    };
    await rodar('decisao', decisao, () => board.item(itemId).update(decisao).execute());
    await rodar('equipe', equipe, () => board.item(itemId).update(equipe).execute());
    await rodar('responsaveis', responsaveis, () => board.item(itemId).update(responsaveis).execute());
    return { id: itemId, created, partes };
  });

/** Busca de usuários para "Responsável pela decisão". */
export const searchUsers = createServerFn({ method: 'GET' })
  .validator(z.object({ term: z.string().max(80) }))
  .handler(async ({ data }) => {
    const board = new DecisoesDoVibeBoard();
    const term = data.term.trim();
    try {
      const list = term.length >= 2
        ? await board.users.where({ name: term }).withPagination({ limit: 20, page: 0 }).execute()
        : await board.users.boardSubscribers().execute();
      return { users: (list ?? []).slice(0, 20).map((u) => ({ id: String(u.id), name: u.name ?? '' })) };
    } catch (e) {
      console.error('searchUsers', e);
      return { users: [] as { id: string; name: string }[] };
    }
  });

/** Rótulos existentes no quadro Decisões do Vibe (nunca criamos rótulos novos). */
const ROTULOS_PERSP = {
  tipo: ['Contrato Novo', 'Aditivo', 'Sem informação'],
  nivel: ['Alta', 'Média', 'Baixa', 'Sem informação'],
  temperatura: ['15 a 30 dias', '30 a 45 dias', '45 a 60 dias', 'Mais de 60 dias', 'Sem informação'],
} as const;
const NOME_CAMPO = { tipo: 'Tipo', nivel: 'Perspectiva', temperatura: 'Temperatura da perspectiva' } as const;

/** Grava Tipo, Perspectiva, Temperatura e Comentário no item do projeto (cria o item se não existir). */
export const salvarPerspectivaQuadro = createServerFn({ method: 'POST' })
  .validator(z.object({
    decisionId: z.string().nullable().optional(),
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    tipo: z.string().max(60).nullable(),
    nivel: z.string().max(60).nullable(),
    temperatura: z.string().max(60).nullable(),
    report: z.string().max(5000),
  }))
  .handler(async ({ data }) => {
    const faltando = (['tipo', 'nivel', 'temperatura'] as const)
      .filter((k) => data[k] && !(ROTULOS_PERSP[k] as readonly string[]).includes(data[k] as string))
      .map((k) => `${NOME_CAMPO[k]} "${data[k]}"`);
    if (faltando.length) {
      return { ok: false as const, erro: `Rótulo inexistente no quadro Decisões do Vibe: ${faltando.join(', ')}. Escolha uma opção existente (nenhum rótulo novo foi criado).`, decisao: null };
    }
    const board = new DecisoesDoVibeBoard();
    try {
      let id = data.decisionId ?? null;
      if (!id) {
        const found = await board.items().withColumns(['projeto']).where({ projeto: { itemId: data.projectId } }).withPagination({ limit: 1 }).execute();
        const existing = found?.items?.[0];
        id = existing ? String(existing.id)
          : String((await board.item().create({ name: data.projectName, projeto: { linkedItems: [{ id: data.projectId }] } }).execute()).id);
      }
      await board.item(id).update({
        tipoContratoNovoaditivo: data.tipo as (typeof ROTULOS_PERSP.tipo)[number] | null,
        perspectiva: data.nivel as (typeof ROTULOS_PERSP.nivel)[number] | null,
        temperaturaDaPerspectiva: data.temperatura as (typeof ROTULOS_PERSP.temperatura)[number] | null, comentrioDaPerspectiva: data.report.trim() || null,
      }).execute();
      const it = await board.item(id).withColumns([...DECISAO_COLS]).execute();
      return { ok: true as const, erro: undefined, decisao: it ? mapDecisao(it) : null };
    } catch (e) {
      console.error('salvarPerspectivaQuadro', e);
      return { ok: false as const, erro: msgErro(e), decisao: null };
    }
  });

export type ParteExtra = { parte: 'status' | 'base' | 'simulacao'; ok: boolean; erro?: string };
const pessoaRef = z.object({ id: z.string().regex(/^\d+$/), nome: z.string().max(200).nullable() });

/**
 * Status de categorização, Equipe base e Simulação por pessoa, cada um gravado em uma parte separada
 * no item do projeto no quadro Decisões do Vibe (cria o item se não existir).
 */
export const salvarExtrasDecisao = createServerFn({ method: 'POST' })
  .validator(z.object({
    decisionId: z.string().nullable().optional(),
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    statusCat: z.string().trim().max(60).nullable().optional(),
    base: z.array(pessoaRef).max(500).optional(),
    sim: z.array(pessoaRef.extend({ opcao: z.enum(OPCOES_SIM) })).max(500).optional(),
  }))
  .handler(async ({ data }) => {
    const board = new DecisoesDoVibeBoard();
    let id: string;
    try {
      id = await garantirItemDecisao(data.projectId, data.projectName, data.decisionId);
    } catch (e) {
      console.error('salvarExtrasDecisao: item', e);
      return { id: null, partes: [] as ParteExtra[], erro: msgErro(e), decisao: null };
    }
    const partes: ParteExtra[] = [];
    const rodar = async (parte: ParteExtra['parte'], fn: () => Promise<unknown>) => {
      try { await fn(); partes.push({ parte, ok: true }); } catch (e) {
        console.error('salvarExtrasDecisao', parte, e);
        partes.push({ parte, ok: false, erro: msgErro(e) });
      }
    };
    if (data.statusCat !== undefined) {
      await rodar('status', () => board.item(id).update({ statusDeCategorizao: data.statusCat || null }).execute());
    }
    if (data.base !== undefined) {
      const base = data.base;
      await rodar('base', () => board.item(id).update({ equipeBase: base.length ? serializarBase(base) : null }).execute());
    }
    if (data.sim !== undefined) {
      const sim: Simulacao = {};
      const nomes = new Map<string, string | null>();
      for (const x of data.sim) { sim[x.id] = x.opcao; nomes.set(x.id, x.nome); }
      await rodar('simulacao', () => board.item(id).update({ simulaoPorPessoa: data.sim?.length ? serializarSim(sim, nomes) : null }).execute());
    }
    let decisao: ReturnType<typeof mapDecisao> | null = null;
    try {
      const it = await board.item(id).withColumns([...DECISAO_COLS]).execute();
      decisao = it ? mapDecisao(it) : null;
    } catch (e) {
      console.error('salvarExtrasDecisao: releitura', e);
    }
    return { id, partes, erro: undefined, decisao };
  });
