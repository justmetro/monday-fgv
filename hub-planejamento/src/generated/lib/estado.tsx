// Estado compartilhado do hub: projeto escolhido, execução (run) no servidor e helpers de etapa.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { obterExecucao, estadoEtapas, gerarEtapa, salvarEdicao, marcarGravada, atualizarExecucao } from '@generated/server/hub';
import type { Execucao, Etapa, EstadoEtapa } from '@generated/server/hub';
import type { Projeto } from '@generated/lib/quadros';
import { registrarNoHub } from '@generated/lib/quadros';
import { errorMessage } from '@generated/lib/monday';

interface Ctx {
  projeto: Projeto | null;
  run: Execucao | null;
  userId: string;
  setRun: (r: Execucao | null) => void;
  recarregar: () => Promise<void>;
  atualizar: (p: { boardId?: string; boardUrl?: string; hubItemId?: string; modelo?: string; inicioExecucao?: string | null; diasVigencia?: number | null }) => Promise<void>;
  etapa: (e: Etapa) => EstadoEtapa;
  gerar: (e: Exclude<Etapa, 'tap'>, entrada?: unknown) => Promise<void>;
  editar: (e: Etapa, resultado: unknown) => void;
  concluir: (e: Etapa, resumo: string) => Promise<void>;
}

const C = createContext<Ctx | null>(null);
export const useHub = () => {
  const c = useContext(C);
  if (!c) throw new Error('useHub fora do provedor');
  return c;
};

export const ROTULO_ETAPA: Record<Etapa, string> = {
  analise: 'Análise', tap: 'TAP', produtos: 'Produtos', eap: 'EAP e Cronograma', riscos: 'Riscos específicos', complemento: 'Riscos da calculadora',
  indicadores: 'Indicadores', partes: 'Partes Interessadas', calculadora: 'Calculadora de Riscos',
};

export function HubProvider({ projeto, run, setRun, userId, children }: { projeto: Projeto | null; run: Execucao | null; setRun: (r: Execucao | null) => void; userId: string; children: ReactNode }) {
  const runRef = useRef(run);
  runRef.current = run;
  const timers = useRef<Record<string, number>>({});

  const recarregar = useCallback(async () => {
    if (!runRef.current) return;
    setRun((await estadoEtapas({ data: { runId: runRef.current._id } })) as Execucao);
  }, [setRun]);

  // Enquanto alguma etapa estiver gerando, consulta o servidor a cada 4 s.
  const gerando = !!run && Object.values(run.etapas ?? {}).some((x) => x?.status === 'gerando');
  useEffect(() => {
    if (!gerando) return;
    const t = window.setInterval(() => { recarregar().catch(() => null); }, 4000);
    return () => window.clearInterval(t);
  }, [gerando, recarregar]);

  const atualizar: Ctx['atualizar'] = async (p) => {
    if (!runRef.current) return;
    setRun((await atualizarExecucao({ data: { runId: runRef.current._id, ...(p as object) } })) as Execucao);
  };

  const etapa = (e: Etapa): EstadoEtapa => run?.etapas?.[e] ?? { status: 'nao_iniciada' };

  const gerar: Ctx['gerar'] = async (e, entrada) => {
    if (!runRef.current) return;
    await gerarEtapa({ data: { runId: runRef.current._id, etapa: e, entrada: entrada as any } });
    await recarregar();
  };

  const editar: Ctx['editar'] = (e, resultado) => {
    const r = runRef.current;
    if (!r) return;
    setRun({ ...r, etapas: { ...r.etapas, [e]: { ...(r.etapas[e] ?? { status: 'pronta' }), resultado } } });
    window.clearTimeout(timers.current[e]);
    timers.current[e] = window.setTimeout(() => { salvarEdicao({ data: { runId: r._id, etapa: e, resultado } }).catch(() => null); }, 800);
  };

  const concluir: Ctx['concluir'] = async (e, resumo) => {
    const r = runRef.current;
    if (!r) return;
    window.clearTimeout(timers.current[e]);
    if (r.etapas[e]?.resultado !== undefined) await salvarEdicao({ data: { runId: r._id, etapa: e, resultado: r.etapas[e]!.resultado } }).catch(() => null);
    await marcarGravada({ data: { runId: r._id, etapa: e, resumo } });
    const atual = (await obterExecucao({ data: { runId: r._id } })) as Execucao;
    setRun(atual);
    // Registro da execução no 09.0 Hub de Planejamento (falha aqui não desfaz a gravação)
    try {
      const linhas = (Object.keys(ROTULO_ETAPA) as Etapa[])
        .filter((k) => atual.etapas[k]?.status === 'gravada')
        .map((k) => `${ROTULO_ETAPA[k]}: ${atual.etapas[k]?.resumoGravacao ?? ''} (${(atual.etapas[k]?.gravadaEm ?? '').slice(0, 10).split('-').reverse().join('/')})`);
      const id = await registrarNoHub({ hubItemId: atual.hubItemId, nome: atual.nomeItem, itemId: atual.itemId, runId: atual._id, quadroUrl: atual.boardUrl, userId, etapas: linhas.join('\n') });
      if (id !== atual.hubItemId) setRun((await atualizarExecucao({ data: { runId: atual._id, hubItemId: id } })) as Execucao);
    } catch (err) {
      console.error('registro no 09.0', errorMessage(err));
    }
  };

  return <C.Provider value={{ projeto, run, userId, setRun, recarregar, atualizar, etapa, gerar, editar, concluir }}>{children}</C.Provider>;
}
