import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { LevantamentoDeProdutosBoard } from '@api/BoardSDK';
import { garantirItemDecisao, publicarLog, usuarioAtual } from '@generated/server/log.server';
import { isoToUtcDate, mapProduto, toIsoDate, txt } from '@generated/server/mappers.server';
import { CAMPO_PRODUTO, valorIgual, type LogEntry, type LogValor, type Mudanca } from '@generated/lib/logCampos';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Rótulos existentes na coluna Status do Produto (o app nunca cria rótulos).
const STATUS_VALIDOS = ['Concluído', 'Entrega Final', 'Não Há', 'Não Iniciado'];
const CAMPOS_EDITAVEIS = ['status', 'prazo', 'valor', 'entregaReal'] as const;
type CampoEd = (typeof CAMPOS_EDITAVEIS)[number];

const valor = z.union([z.string(), z.number(), z.null()]);
const itemSchema = z.object({
  produtoId: z.string().min(1),
  produtoNome: z.string().max(300),
  campos: z.array(z.object({ campo: z.enum(CAMPOS_EDITAVEIS), esperado: valor, novo: valor })).min(1).max(4),
});

type Atuais = Record<CampoEd, LogValor>;
async function lerAtuais(board: LevantamentoDeProdutosBoard, id: string): Promise<Atuais | null> {
  const it = await board.item(id).withColumns(['statusDoProduto', 'prazoDeEntrega', 'valorDoProduto', 'dataDeEntregaRealCorporativo']).execute();
  if (!it) return null;
  return {
    status: txt(it.statusDoProduto),
    prazo: toIsoDate(it.prazoDeEntrega),
    valor: typeof it.valorDoProduto === 'number' ? it.valorDoProduto : null,
    entregaReal: toIsoDate(it.dataDeEntregaRealCorporativo),
  };
}

export type Conflito = { produtoId: string; produtoNome: string; campo: CampoEd; esperado: LogValor; atual: LogValor; novo: LogValor };
export type ResultadoItem = { produtoId: string; produtoNome: string; campos: CampoEd[]; erro?: string };

/**
 * Grava no quadro Levantamento de Produtos SOMENTE após a confirmação do usuário.
 * 1) Relê os valores atuais; campos alterados por fora (≠ esperado) voltam como conflito, sem gravar nada,
 *    a menos que estejam em `forcar` ("produtoId:campo").
 * 2) Grava produto a produto; reporta o que foi e o que não foi gravado (sem desfazer às cegas).
 * 3) Registra no histórico do projeto e relê os itens gravados.
 */
export const gravarProdutos = createServerFn({ method: 'POST' })
  .validator(z.object({
    projectId: z.string().min(1),
    projectName: z.string().min(1).max(500),
    decisionId: z.string().nullable().optional(),
    itens: z.array(itemSchema).min(1).max(100),
    forcar: z.array(z.string()).max(300).default([]),
  }))
  .handler(async ({ data }) => {
    const board = new LevantamentoDeProdutosBoard();
    const forcar = new Set(data.forcar);
    for (const it of data.itens) {
      for (const c of it.campos) {
        if ((c.campo === 'prazo' || c.campo === 'entregaReal') && c.novo !== null && !(typeof c.novo === 'string' && ISO.test(c.novo))) throw new Error('Data inválida');
        if (c.campo === 'valor' && c.novo !== null && !(typeof c.novo === 'number' && Number.isFinite(c.novo) && c.novo >= 0)) throw new Error('Valor inválido');
        if (c.campo === 'status' && c.novo !== null && !(typeof c.novo === 'string' && STATUS_VALIDOS.includes(c.novo))) throw new Error('Status inválido');
      }
    }

    // 1) Releitura e conflitos
    const atuais = new Map<string, Atuais>();
    const conflitos: Conflito[] = [];
    for (const it of data.itens) {
      const a = await lerAtuais(board, it.produtoId);
      if (!a) throw new Error(`Produto não encontrado: ${it.produtoNome}`);
      atuais.set(it.produtoId, a);
      for (const c of it.campos) {
        if (!valorIgual(a[c.campo], c.esperado) && !forcar.has(`${it.produtoId}:${c.campo}`)) {
          conflitos.push({ produtoId: it.produtoId, produtoNome: it.produtoNome, campo: c.campo, esperado: c.esperado, atual: a[c.campo], novo: c.novo });
        }
      }
    }
    if (conflitos.length) return { status: 'conflito' as const, conflitos };

    // 2) Gravação
    const gravados: ResultadoItem[] = [];
    const falhas: ResultadoItem[] = [];
    const changes: Mudanca[] = [];
    for (const it of data.itens) {
      const a = atuais.get(it.produtoId);
      const patch: { statusDoProduto?: string | null; prazoDeEntrega?: Date | null; valorDoProduto?: number | null; dataDeEntregaRealCorporativo?: Date | null } = {};
      for (const c of it.campos) {
        if (c.campo === 'status') patch.statusDoProduto = typeof c.novo === 'string' ? c.novo : null;
        if (c.campo === 'prazo') patch.prazoDeEntrega = isoToUtcDate(typeof c.novo === 'string' ? c.novo : null) ?? null;
        if (c.campo === 'entregaReal') patch.dataDeEntregaRealCorporativo = isoToUtcDate(typeof c.novo === 'string' ? c.novo : null) ?? null;
        if (c.campo === 'valor') patch.valorDoProduto = typeof c.novo === 'number' ? c.novo : null;
      }
      const campos = it.campos.map((c) => c.campo);
      try {
        // Todos os campos do produto vão numa única atualização (status + data de entrega real juntos).
        await board.item(it.produtoId).update(patch).execute();
        gravados.push({ produtoId: it.produtoId, produtoNome: it.produtoNome, campos });
        for (const c of it.campos) {
          changes.push({ campo: CAMPO_PRODUTO[c.campo], de: a?.[c.campo] ?? null, para: c.novo, produtoId: it.produtoId, produtoNome: it.produtoNome });
        }
      } catch (e) {
        console.error('gravarProdutos', it.produtoId, e);
        falhas.push({ produtoId: it.produtoId, produtoNome: it.produtoNome, campos, erro: e instanceof Error ? e.message.slice(0, 200) : 'Erro ao gravar' });
      }
    }

    // 3) Histórico + releitura
    let log: LogEntry | null = null;
    let logErro = false;
    if (changes.length) {
      try {
        const itemId = await garantirItemDecisao(data.projectId, data.projectName, data.decisionId);
        const user = await usuarioAtual();
        log = await publicarLog(itemId, {
          projectId: data.projectId, projectName: data.projectName, user, at: new Date().toISOString(),
          acao: 'alteracao', ref: null, changes,
        });
      } catch (e) {
        console.error('gravarProdutos: histórico', e);
        logErro = true;
      }
    }
    const atualizados: ReturnType<typeof mapProduto>[] = [];
    for (const g of gravados) {
      try {
        const it = await board.item(g.produtoId).withColumns([
          'projeto', 'nomeDoProduto', 'statusDoProduto', 'prazoDeEntrega', 'dataPrevistaDeEntrega',
          'statusAtrasoEntregaAgregado', 'valorDoProduto', 'tipo', 'dataDeEntregaRealCorporativo', 'statusAtrasoEntrega',
        ]).execute();
        if (it) atualizados.push(mapProduto(it));
      } catch (e) {
        console.error('gravarProdutos: releitura', g.produtoId, e);
      }
    }
    return { status: 'ok' as const, gravados, falhas, atualizados, log, logErro };
  });
