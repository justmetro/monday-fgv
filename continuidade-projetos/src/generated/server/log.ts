import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DecisoesDoVibeBoard, HistoricoDeProjetosBoard, LevantamentoDeProdutosBoard } from '@api/BoardSDK';
import { decodificar, garantirItemDecisao, publicarLog, usuarioAtual } from '@generated/server/log.server';
import { isoToUtcDate, mapDecisao, timelineWrite, toIsoDate, txt, DECISAO_COLS } from '@generated/server/mappers.server';
import { CAMPOS, mudancaSchema, valorIgual, type LogEntry, type LogValor, type Mudanca } from '@generated/lib/logCampos';

const UPD_PAGE = 100;

/** Todos os registros de histórico (updates marcados nos itens do quadro C), do mais recente ao mais antigo. */
export const getLogs = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new DecisoesDoVibeBoard();
    const out: LogEntry[] = [];
    const add = (updates: unknown[] | undefined, itemId: string) => {
      for (const u of updates ?? []) {
        const e = decodificar(u, itemId);
        if (e) out.push(e);
      }
    };
    const cheios: string[] = [];
    let cursor: string | undefined;
    let guard = 0;
    do {
      const res = await board.items().withColumns(['projeto']).withUpdates({ limit: UPD_PAGE }).withPagination({ limit: 100, cursor }).execute();
      for (const it of res.items) {
        add(it.updates, String(it.id));
        if ((it.updates?.length ?? 0) >= UPD_PAGE) cheios.push(String(it.id));
      }
      cursor = res.cursor ?? undefined;
      guard++;
    } while (cursor && guard < 20);
    // Itens com mais updates que uma página: busca as páginas seguintes até acabar.
    await Promise.all(cheios.map(async (itemId) => {
      for (let page = 2; page <= 50; page++) {
        try {
          const it = await board.item(itemId).withColumns(['projeto']).withUpdates({ limit: UPD_PAGE, page }).execute();
          const ups = it?.updates ?? [];
          add(ups, itemId);
          if (ups.length < UPD_PAGE) break;
        } catch (e) {
          console.error('getLogs: falha ao paginar updates', itemId, page, e);
          break;
        }
      }
    }));
    // Sem duplicados (caso a mesma update venha em duas páginas).
    const vistos = new Set<string>();
    const unicos = out.filter((e) => (vistos.has(e.id) ? false : (vistos.add(e.id), true)));
    out.length = 0;
    out.push(...unicos);
    out.sort((a, b) => b.at.localeCompare(a.at));
    return { items: out };
  });

/** Registra um salvamento no histórico. O usuário é identificado no servidor. */
export const registrarLog = createServerFn({ method: 'POST' })
  .validator(z.object({
    projectId: z.string(),
    projectName: z.string().min(1),
    decisionId: z.string().nullable().optional(),
    changes: z.array(mudancaSchema).min(1).max(30),
  }))
  .handler(async ({ data }) => {
    const itemId = await garantirItemDecisao(data.projectId, data.projectName, data.decisionId);
    const user = await usuarioAtual();
    return publicarLog(itemId, {
      projectId: data.projectId, projectName: data.projectName, user, at: new Date().toISOString(),
      acao: 'alteracao', ref: null, changes: data.changes,
    });
  });

type DateLike = Date | null;
const asStr = (v: LogValor) => (typeof v === 'string' ? v : null);
const asNum = (v: LogValor) => (typeof v === 'number' ? v : null);
const asDate = (v: LogValor): DateLike => isoToUtcDate(typeof v === 'string' ? v : null) ?? null;

/** Regrava os valores anteriores de um registro e gera um novo registro de reversão. */
export const reverterLog = createServerFn({ method: 'POST' })
  .validator(z.object({
    logId: z.string(),
    itemId: z.string(),
    projectId: z.string(),
    projectName: z.string().min(1),
    changes: z.array(mudancaSchema).min(1).max(30),
    forcar: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    // Conflito: algum campo mudou depois do registro (valor atual ≠ "para")? Sem forcar, não grava.
    if (!data.forcar) {
      const conflitos = await camposAlteradosDepois(data.projectId, data.itemId, data.changes);
      if (conflitos.length) return { status: 'conflito' as const, campos: conflitos };
    }
    const patchA: { alertaDesalocao?: string | null; inciofimContratual?: { from: string; to: string } | null; ltimaEntregaPrevista?: DateLike } = {};
    const patchC: {
      nClt?: number | null; custoMensalEquipeR?: number | null; mesesDeManuteno?: number | null;
      atualizaoDaEquipe?: DateLike; dataPrevistaDeEntradarenovao?: DateLike; dataDaDeciso?: DateLike;
      perspectivaDeFinalizao?: string | null; deciso?: string | null; detalheDaDeciso?: string | null; statusDeCategorizao?: string | null;
      responsvelPelaDeciso?: { id: string; kind: 'person' }[] | null;
    } = {};
    for (const c of data.changes) {
      const v = c.de;
      switch (c.campo) {
        case 'alertaDesalocao': patchA.alertaDesalocao = asStr(v); break;
        case 'inciofimContratual': {
          const r = v && typeof v === 'object' && !Array.isArray(v) && v.from && v.to ? { from: v.from, to: v.to } : null;
          patchA.inciofimContratual = timelineWrite(r) ?? null;
          break;
        }
        case 'ltimaEntregaPrevista': patchA.ltimaEntregaPrevista = asDate(v); break;
        case 'nClt': patchC.nClt = asNum(v); break;
        case 'custoMensalEquipeR': patchC.custoMensalEquipeR = asNum(v); break;
        case 'mesesDeManuteno': patchC.mesesDeManuteno = asNum(v); break;
        case 'atualizaoDaEquipe': patchC.atualizaoDaEquipe = asDate(v); break;
        case 'dataPrevistaDeEntradarenovao': patchC.dataPrevistaDeEntradarenovao = asDate(v); break;
        case 'dataDaDeciso': patchC.dataDaDeciso = asDate(v); break;
        case 'perspectivaDeFinalizao': patchC.perspectivaDeFinalizao = asStr(v); break;
        case 'deciso': patchC.deciso = asStr(v); break;
        case 'detalheDaDeciso': patchC.detalheDaDeciso = asStr(v); break;
        case 'statusDeCategorizao': patchC.statusDeCategorizao = asStr(v); break;
        case 'responsvelPelaDeciso':
          patchC.responsvelPelaDeciso = Array.isArray(v) && v.length ? v.map((p) => ({ id: p.id, kind: 'person' as const })) : null;
          break;
      }
    }
    // Produtos (quadro Levantamento de Produtos), por item.
    const patchP = new Map<string, { statusDoProduto?: string | null; prazoDeEntrega?: DateLike; valorDoProduto?: number | null }>();
    for (const c of data.changes) {
      if (!c.produtoId || CAMPOS[c.campo].board !== 'P') continue;
      const p = patchP.get(c.produtoId) ?? {};
      if (c.campo === 'produtoStatus') p.statusDoProduto = asStr(c.de);
      else if (c.campo === 'produtoPrazo') p.prazoDeEntrega = asDate(c.de);
      else if (c.campo === 'produtoValor') p.valorDoProduto = asNum(c.de);
      else continue;
      patchP.set(c.produtoId, p);
    }
    for (const [id, p] of patchP) await new LevantamentoDeProdutosBoard().item(id).update(p).execute();
    if (Object.keys(patchA).length) await new HistoricoDeProjetosBoard().item(data.projectId).update(patchA).execute();
    if (Object.keys(patchC).length) await new DecisoesDoVibeBoard().item(data.itemId).update(patchC).execute();
    const user = await usuarioAtual();
    const log = await publicarLog(data.itemId, {
      projectId: data.projectId, projectName: data.projectName, user, at: new Date().toISOString(),
      acao: 'reversao', ref: data.logId,
      changes: data.changes.map((c) => ({ campo: c.campo, de: c.para, para: c.de })),
    });
    return { status: 'ok' as const, log };
  });

/** Lê os valores atuais nos quadros A e C e devolve os rótulos dos campos que diferem do "para" do registro. */
async function camposAlteradosDepois(projectId: string, itemId: string, changes: Mudanca[]): Promise<string[]> {
  const atuais: Record<string, unknown> = {};
  const temA = changes.some((c) => CAMPOS[c.campo].board === 'A');
  const temC = changes.some((c) => CAMPOS[c.campo].board === 'C');
  if (temA) {
    const it = await new HistoricoDeProjetosBoard().item(projectId)
      .withColumns(['alertaDesalocao', 'inciofimContratual', 'ltimaEntregaPrevista']).execute();
    const tlv = it?.inciofimContratual;
    atuais.alertaDesalocacao = txt(it?.alertaDesalocao);
    atuais.contratual = tlv && (tlv.from || tlv.to) ? { from: tlv.from || null, to: tlv.to || null } : null;
    atuais.ultimaEntrega = toIsoDate(it?.ltimaEntregaPrevista);
  }
  let dec: Record<string, unknown> | null = null;
  if (temC) {
    const it = await new DecisoesDoVibeBoard().item(itemId).withColumns([...DECISAO_COLS]).execute();
    dec = it ? (mapDecisao(it) as unknown as Record<string, unknown>) : null;
  }
  const prods = new Map<string, Record<string, unknown>>();
  for (const id of new Set(changes.filter((c) => CAMPOS[c.campo].board === 'P' && c.produtoId).map((c) => c.produtoId as string))) {
    const it = await new LevantamentoDeProdutosBoard().item(id).withColumns(['statusDoProduto', 'prazoDeEntrega', 'valorDoProduto']).execute();
    prods.set(id, { status: txt(it?.statusDoProduto), prazo: toIsoDate(it?.prazoDeEntrega), valor: typeof it?.valorDoProduto === 'number' ? it.valorDoProduto : null });
  }
  const out: string[] = [];
  for (const c of changes) {
    const def = CAMPOS[c.campo];
    if (def.board === 'P' && c.produtoId && prods.has(c.produtoId)) {
      const atualP = prods.get(c.produtoId)?.[def.local] ?? null;
      if (!valorIgual(atualP as LogValor, c.para)) out.push(`${def.label}${c.produtoNome ? ` · ${c.produtoNome}` : ''}`);
      continue;
    }
    if (def.board !== 'A' && def.board !== 'C') continue;
    const atual = (def.board === 'A' ? atuais[def.local] : dec?.[def.local]) ?? null;
    if (!valorIgual(atual as LogValor, c.para)) out.push(def.label);
  }
  return [...new Set(out)];
}
