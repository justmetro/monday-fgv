// Estado compartilhado do hub: projeto escolhido, execução (run) no servidor e helpers de etapa.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { estadoEtapas, gerarEtapa, salvarEdicao, atualizarExecucao } from '@generated/server/hub';
import { gravarNoQuadro } from '@generated/server/gravacao';
import type { Execucao, Etapa, EstadoEtapa } from '@generated/server/hub';
import type { Projeto } from '@generated/lib/quadros';
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
  /** Grava a prévia no quadro em segundo plano (servidor, no nome de quem clicou). */
  gravarQuadro: (e: AcaoGravar) => Promise<void>;
}

export type AcaoGravar = 'produtos' | 'eap' | 'riscos' | 'partes' | 'indicadores' | 'complemento' | 'calculadora';

const C = createContext<Ctx | null>(null);
export const useHub = () => {
  const c = useContext(C);
  if (!c) throw new Error('useHub fora do provedor');
  return c;
};

export function HubProvider({ projeto, run, setRun, userId, children }: { projeto: Projeto | null; run: Execucao | null; setRun: (r: Execucao | null) => void; userId: string; children: ReactNode }) {
  const runRef = useRef(run);
  runRef.current = run;
  const timers = useRef<Record<string, number>>({});

  const recarregar = useCallback(async () => {
    if (!runRef.current) return;
    setRun((await estadoEtapas({ data: { runId: runRef.current._id } })) as Execucao);
  }, [setRun]);

  // Enquanto alguma etapa estiver gerando ou gravando, consulta o servidor a cada 4 s.
  const gerando = !!run && Object.values(run.etapas ?? {}).some((x) => x?.status === 'gerando' || x?.gravando);
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

  const gravarQuadro: Ctx['gravarQuadro'] = async (e) => {
    const r = runRef.current;
    if (!r) return;
    // Salva a edição pendente antes: o servidor grava o que está no banco.
    window.clearTimeout(timers.current[e]);
    if (r.etapas[e]?.resultado !== undefined) await salvarEdicao({ data: { runId: r._id, etapa: e, resultado: r.etapas[e]!.resultado } });
    setRun({ ...r, etapas: { ...r.etapas, [e]: { ...(r.etapas[e] ?? { status: 'nao_iniciada' }), gravando: true, erroGravacao: '', progressoGravacao: 'Começando a gravação…' } } });
    try {
      await gravarNoQuadro({ data: { runId: r._id, acao: e } });
      await recarregar();
    } catch (err) {
      const atual = runRef.current ?? r;
      setRun({ ...atual, etapas: { ...atual.etapas, [e]: { ...(atual.etapas[e] ?? { status: 'nao_iniciada' }), gravando: false, progressoGravacao: '', erroGravacao: errorMessage(err) } } });
    }
  };

  return <C.Provider value={{ projeto, run, userId, setRun, recarregar, atualizar, etapa, gerar, editar, gravarQuadro }}>{children}</C.Provider>;
}
