// Gravação das prévias no quadro [PLAN] em segundo plano, no servidor, com o token OAuth de quem clicou.
// A tela só dispara e acompanha: pode fechar a aba ou recarregar que a gravação continua.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { tokenAtual } from '../../../server/context';
import {
  colRuns, agora, ctxOuErro, rodando, setEtapa, tokenIA, iniciarGeracao,
  type Execucao, type Etapa,
} from './hub';
import {
  gravarProdutos, mapaProdutos, gravarEap, gravarRiscosIA, gravarPartes, gravarIndicadores, limparModelo,
  type Produto, type EapProduto, type Risco, type Parte, type Objetivo,
} from '@generated/lib/gravar';
import { prepararProjetoCalc, rodarCalculadora, enviarAoPlanejamento, riscosDoQuadro, aplicarComplemento, type Caracteristicas, type Complemento } from '@generated/lib/calc';
import { CP, registrarNoHub } from '@generated/lib/quadros';
import { ROTULO_ETAPA } from '@generated/lib/rotulos';

const ACOES = ['produtos', 'eap', 'riscos', 'partes', 'indicadores', 'complemento', 'calculadora'] as const;
type Acao = (typeof ACOES)[number];

const res = <T,>(run: Execucao, e: Etapa) => run.etapas[e]?.resultado as T | undefined;

function produtosResumo(run: Execucao) {
  return (res<{ produtos: Produto[] }>(run, 'produtos')?.produtos ?? []).map((x, i) => ({
    codigo: x.codigo, nome: x.nome, descricao: x.descricao, dia_inicio: x.dia_inicio, dia_fim: x.dia_fim,
    mes_inicio: x.mes_inicio, mes_fim: x.mes_fim, valor: x.valor, ordem: i + 1,
  }));
}

/** Executa a gravação e devolve o resumo que aparece na tela e no 09.0. */
async function executar(run: Execucao, acao: Acao, userId: string, prog: (m: string) => void): Promise<string> {
  const boardId = run.boardId;
  if (!boardId) throw new Error('Vincule o quadro [PLAN] antes de gravar.');
  const inicio = run.contexto.inicioExecucao ?? null;

  switch (acao) {
    case 'produtos': {
      const r = res<{ produtos: Produto[] }>(run, 'produtos');
      if (!r?.produtos?.length) throw new Error('Não há produtos para gravar.');
      const out = await gravarProdutos(boardId, r.produtos, inicio, prog);
      return `${out.criados} produtos criados e ${out.atualizados} atualizados no grupo Produtos`;
    }
    case 'eap': {
      const r = res<{ produtos: EapProduto[] }>(run, 'eap');
      if (!r?.produtos?.length) throw new Error('Não há EAP para gravar.');
      if (!inicio) throw new Error('Defina a data de início da execução na aba Quadro.');
      prog('Lendo os produtos do quadro…');
      const mapa = await mapaProdutos(boardId);
      const out = await gravarEap(boardId, r.produtos, produtosResumo(run).map((p) => p.codigo), mapa, inicio, prog);
      return `${out.itens} itens criados no grupo Cronograma (Níveis 2, 3 e 4)${out.semProduto.length ? `; sem produto no quadro: ${out.semProduto.join(', ')}` : ''}`;
    }
    case 'riscos': {
      const r = res<{ riscos: Risco[] }>(run, 'riscos');
      if (!r?.riscos?.length) throw new Error('Não há riscos para gravar.');
      const n = await gravarRiscosIA(boardId, r.riscos, inicio, prog);
      return `${n} riscos específicos criados no grupo Riscos`;
    }
    case 'partes': {
      const r = res<{ partes: Parte[] }>(run, 'partes');
      if (!r?.partes?.length) throw new Error('Não há partes interessadas para gravar.');
      const n = await gravarPartes(boardId, r.partes, prog);
      return `${n} partes interessadas (institucionais) criadas`;
    }
    case 'indicadores': {
      const r = res<{ objetivos: Objetivo[] }>(run, 'indicadores');
      if (!r?.objetivos?.length) throw new Error('Não há indicadores para gravar.');
      const out = await gravarIndicadores(boardId, r.objetivos, inicio, prog);
      return `${out.indicadores} indicadores (KRs e KPIs) e ${out.medicoes} medições criados`;
    }
    case 'complemento': {
      const r = res<{ riscos: Complemento[] }>(run, 'complemento');
      if (!r?.riscos?.length) throw new Error('Não há complemento para aplicar.');
      const n = await aplicarComplemento(boardId, r.riscos, inicio, prog);
      return `${n} riscos da calculadora completados (período, frente, estratégia e resposta)`;
    }
    case 'calculadora': {
      const analise = res<{ calculadora?: Caracteristicas; tap?: Record<string, string> }>(run, 'analise');
      if (!analise?.calculadora) throw new Error('Gere a análise dos documentos antes (ela define as 8 características).');
      if (!run.boardUrl) throw new Error('Vincule o quadro [PLAN] antes.');
      const c = { ...analise.calculadora, c8_equipe: analise.calculadora.c8_equipe || 'Até 10 membros na equipe' };
      prog('Arquivando os riscos de exemplo do modelo…');
      await limparModelo(boardId, CP.grupos.riscos);
      prog('Cadastrando o projeto no 09.1 com as 8 características…');
      const id = await prepararProjetoCalc(run.nomeItem, run.boardUrl, boardId, c, userId);
      const rc: any = await rodarCalculadora(id, prog);
      prog('Enviando os riscos ao quadro [PLAN]…');
      const env: any = await enviarAoPlanejamento(id, run.nomeItem, run.boardUrl, boardId, prog);
      const resumo = `Calculadora: ${rc.nTot} riscos (${rc.nEsp} dos grupos de risco e ${rc.nTr} transversais); ${env.copied} enviados ao grupo Riscos, ${env.skipped} já estavam lá${env.warnings?.length ? `. Avisos: ${env.warnings.slice(0, 3).join('; ')}` : ''}`;
      // Na sequência, a IA completa período, frente, estratégia e resposta dos riscos que vieram da calculadora.
      const alvo = (await riscosDoQuadro(boardId)).filter((x) => !x.daIA);
      if (alvo.length) {
        const t = analise.tap ?? {};
        await iniciarGeracao(run, 'complemento', {
          produtos: produtosResumo(run),
          resumo: [t.justificativa, t.resultado_principal, t.como_chega].filter(Boolean).join('\n') || run.nomeItem,
          riscosQuadro: alvo.map((x) => ({ id: x.id, nome: x.nome, causa: x.causa, efeito: x.efeito, categoria: x.categoria, estrategia: x.estrategia, resposta: x.resposta })),
        });
      }
      return resumo;
    }
  }
}

/** Atualiza o registro da execução no 09.0 (falha aqui não desfaz a gravação). */
async function registrar(runId: string, userId: string) {
  try {
    const atual = await (await colRuns()).findOne({ _id: runId });
    if (!atual) return;
    const linhas = (Object.keys(ROTULO_ETAPA) as Etapa[])
      .filter((k) => atual.etapas[k]?.status === 'gravada')
      .map((k) => `${ROTULO_ETAPA[k]}: ${atual.etapas[k]?.resumoGravacao ?? ''} (${(atual.etapas[k]?.gravadaEm ?? '').slice(0, 10).split('-').reverse().join('/')})`);
    const id = await registrarNoHub({ hubItemId: atual.hubItemId, nome: atual.nomeItem, itemId: atual.itemId, runId, quadroUrl: atual.boardUrl, userId, etapas: linhas.join('\n') });
    if (id !== atual.hubItemId) await (await colRuns()).updateOne({ _id: runId }, { $set: { hubItemId: id } });
  } catch (e) {
    console.error('[registro 09.0]', e);
  }
}

export const gravarNoQuadro = createServerFn()
  .validator(z.object({ runId: z.string(), acao: z.enum(ACOES) }))
  .handler(async ({ data }) => {
    const c = ctxOuErro();
    const token = await tokenIA();
    const run = await (await colRuns()).findOne({ _id: data.runId });
    if (!run) throw new Error('Execução não encontrada.');
    const chave = `${run._id}:grav:${data.acao}`;
    if (rodando.has(chave)) return { iniciada: false, motivo: 'Já está gravando.' };
    const e: Etapa = data.acao;
    await setEtapa(run._id, e, { gravando: true, erroGravacao: '', progressoGravacao: 'Começando a gravação…', batidaGravacao: agora() });
    // Progresso: grava no banco no máximo a cada 2 s (serve também de sinal de vida).
    let ultimo = 0;
    const prog = (m: string) => {
      if (Date.now() - ultimo < 2000) return;
      ultimo = Date.now();
      setEtapa(run._id, e, { progressoGravacao: m, batidaGravacao: agora() }).catch(() => null);
    };
    const job = tokenAtual.run(token, async () => {
      try {
        const resumo = await executar(run, data.acao, c.userId, prog);
        await setEtapa(run._id, e, {
          gravando: false, progressoGravacao: '', erroGravacao: '', status: 'gravada', gravadaEm: agora(), gravadaPor: c.userId, resumoGravacao: resumo,
        });
        await registrar(run._id, c.userId);
      } catch (err) {
        console.error(`[gravar ${data.acao}]`, err);
        await setEtapa(run._id, e, { gravando: false, progressoGravacao: '', erroGravacao: err instanceof Error ? err.message : String(err) });
      }
    }).finally(() => rodando.delete(chave));
    rodando.set(chave, job);
    return { iniciada: true };
  });
