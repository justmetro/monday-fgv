import type { Rascunho } from '@generated/components/painel/drawer/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDecisoes, getProdutos, getProjetos } from '@generated/server/projetos';
import { getLogs } from '@generated/server/log';
import { getEdicoes, getLogsApp } from '@generated/server/edicoes';
import { getAlocacao } from '@generated/server/alocacao';
import { getAjustes } from '@generated/server/ajustes';
import { getFatores, getPerspectivas, getStatusOpcoes, type PerspectivaDoc } from '@generated/server/negocio';
import { STATUS_CAT_PADRAO } from '@generated/lib/extras';
import { FATORES_PADRAO, type Fatores } from '@generated/lib/negocio';
import type { Ajuste, AlocProjeto } from '@generated/lib/equipe';
import type { Decisao, EdicaoProduto, Produto, Projeto } from '@generated/lib/painel';
import type { LogEntry } from '@generated/lib/logCampos';

const CHUNK = 6;
const PARALLEL = 4;

/** Estado em memória (sem cache persistente): dados sempre frescos ao abrir/recarregar e em "Atualizar dados". */
type Mem = { projetos: Projeto[]; decisoes: Decisao[]; produtos: Record<string, Produto[]> };

export function usePainelData() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [produtos, setProdutos] = useState<Record<string, Produto[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [produtosPendentes, setProdutosPendentes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [produtosErro, setProdutosErro] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsErro, setLogsErro] = useState(false);
  const runId = useRef(0);

  const [edicoes, setEdicoes] = useState<Record<string, EdicaoProduto>>({});

  const loadEdicoes = useCallback(async () => {
    try {
      const res = await getEdicoes({ data: {} });
      const m: Record<string, EdicaoProduto> = {};
      for (const e of res?.items ?? []) m[e.produtoId] = e;
      setEdicoes(m);
    } catch (e) {
      console.error('Falha ao carregar edições de produtos', e);
    }
  }, []);

  const setEdicao = useCallback((produtoId: string, ed: EdicaoProduto | null) => {
    setEdicoes((prev) => {
      const next = { ...prev };
      if (ed) next[produtoId] = ed;
      else delete next[produtoId];
      return next;
    });
  }, []);

  const [alocacao, setAlocacao] = useState<Record<string, AlocProjeto> | undefined>(undefined);
  const [alocErro, setAlocErro] = useState(false);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  /** Rascunhos do painel por projeto (valem na lista/cards até salvar ou descartar). */
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const setRascunho = useCallback((projectId: string, r: Rascunho | null) => {
    setRascunhos((prev) => {
      if (!r && !(projectId in prev)) return prev;
      const n = { ...prev };
      if (r) n[projectId] = r; else delete n[projectId];
      return n;
    });
  }, []);

  const alocRun = useRef(0);
  /** Só a leitura mais recente aplica o resultado; em falha, mantém o último mapa carregado com sucesso. */
  const loadAlocacao = useCallback(async () => {
    const run = ++alocRun.current;
    try {
      const [ra, rj] = await Promise.all([
        getAlocacao({ data: {} }),
        getAjustes({ data: {} }).catch((e: unknown) => { console.error('Falha ao carregar ajustes de equipe', e); return null; }),
      ]);
      if (run !== alocRun.current) return;
      if (ra?.byCodigo) setAlocacao(ra.byCodigo);
      setAlocErro(!ra?.byCodigo);
      if (rj) {
        const m: Record<string, Ajuste> = {};
        for (const a of rj.items ?? []) m[a.projectId] = a;
        setAjustes(m);
      }
    } catch (e) {
      console.error('Falha ao carregar Equipes Revisadas', e);
      if (run !== alocRun.current) return;
      setAlocErro(true); // mantém o último mapa carregado (não zera)
    }
  }, []);

  // ── Fatores de custo e perspectiva de renovação (só no app) ──
  const [fatores, setFatores] = useState<Fatores>(FATORES_PADRAO);
  const [perspectivas, setPerspectivas] = useState<Record<string, PerspectivaDoc[]>>({});
  const [statusOpcoes, setStatusOpcoes] = useState<string[]>(STATUS_CAT_PADRAO);
  const loadNegocio = useCallback(async () => {
    const [rf, rp, ro] = await Promise.all([
      getFatores({ data: {} }).catch((e: unknown) => { console.error('Falha ao carregar fatores de custo', e); return null; }),
      getPerspectivas({ data: {} }).catch((e: unknown) => { console.error('Falha ao carregar perspectivas', e); return null; }),
      getStatusOpcoes({ data: {} }).catch((e: unknown) => { console.error('Falha ao carregar opções de status', e); return null; }),
    ]);
    if (ro?.opcoes?.length) setStatusOpcoes(ro.opcoes);
    const f = rf?.fatores;
    if (f) setFatores({ clt: f.clt, bolsa: f.bolsa, estagio: f.estagio, rpaFixo: f.rpaFixo });
    if (rp) {
      const m: Record<string, PerspectivaDoc[]> = {};
      for (const x of rp.items) (m[x.projectId] ??= []).push(x);
      setPerspectivas(m);
    }
  }, []);
  const addPerspectiva = useCallback((x: PerspectivaDoc) => {
    setPerspectivas((prev) => ({ ...prev, [x.projectId]: [x, ...(prev[x.projectId] ?? [])] }));
  }, []);

  const setAjuste = useCallback((projectId: string, a: Ajuste | null) => {
    setAjustes((prev) => {
      const next = { ...prev };
      if (a) next[projectId] = a;
      else delete next[projectId];
      return next;
    });
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsErro(false);
    try {
      const [res, resApp] = await Promise.all([
        getLogs({ data: {} }),
        getLogsApp({ data: {} }).catch((e: unknown) => { console.error('Falha ao carregar histórico do app', e); return null; }),
      ]);
      const all = [...(res?.items ?? []), ...(resApp?.items ?? [])];
      all.sort((a, b) => b.at.localeCompare(a.at));
      setLogs(all);
    } catch (e) {
      console.error('Falha ao carregar histórico', e);
      setLogsErro(true);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const addLog = useCallback((e: LogEntry) => {
    setLogs((prev) => [e, ...prev.filter((x) => x.id !== e.id)]);
  }, []);
  const state = useRef<Mem>({ projetos: [], decisoes: [], produtos: {} });

  const loadProdutos = useCallback(async (ids: string[], run: number) => {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
    setProdutosPendentes(ids.length);
    setProdutosErro(false);
    let failed = false;
    let next = 0;
    const worker = async () => {
      while (next < chunks.length) {
        const chunk = chunks[next++];
        if (!chunk) break;
        try {
          const res = await getProdutos({ data: { projectIds: chunk } });
          if (run !== runId.current) return;
          const by = res?.byProject ?? {};
          state.current.produtos = { ...state.current.produtos, ...by };
          setProdutos((prev) => ({ ...prev, ...by }));
        } catch (e) {
          console.error('Falha ao carregar produtos', e);
          failed = true;
        } finally {
          if (run === runId.current) setProdutosPendentes((n) => Math.max(0, n - chunk.length));
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    if (run !== runId.current) return;
    if (failed) setProdutosErro(true);
  }, []);

  const fetchAll = useCallback(async (mode: 'initial' | 'refresh') => {
    const run = ++runId.current;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [rp, rd] = await Promise.all([getProjetos({ data: {} }), getDecisoes({ data: {} })]);
      if (run !== runId.current) return;
      const ps = rp?.items ?? [];
      const ds = rd?.items ?? [];
      state.current = { projetos: ps, decisoes: ds, produtos: mode === 'refresh' ? state.current.produtos : {} };
      setProjetos(ps);
      setDecisoes(ds);
      setSavedAt(Date.now());
      setLoading(false);
      setRefreshing(false);
      void loadProdutos(ps.map((p) => p.id), run);
      void loadLogs();
      void loadEdicoes();
      void loadAlocacao();
      void loadNegocio();
    } catch (e) {
      console.error('Falha ao carregar projetos', e);
      if (run !== runId.current) return;
      setError('Não foi possível carregar os projetos. Verifique a conexão e tente novamente.');
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadProdutos, loadLogs, loadEdicoes, loadAlocacao, loadNegocio]);

  useEffect(() => {
    void fetchAll('initial');
  }, [fetchAll]);

  /** Substitui produtos do projeto pelos valores relidos do monday (após gravação). */
  const patchProdutos = useCallback((projectId: string, novos: Produto[]) => {
    if (!novos.length) return;
    const by = new Map(novos.map((x) => [x.id, x]));
    const atual = state.current.produtos[projectId] ?? [];
    const next = atual.map((x) => by.get(x.id) ?? x);
    state.current.produtos = { ...state.current.produtos, [projectId]: next };
    setProdutos((prev) => ({ ...prev, [projectId]: next }));
  }, []);

  const patchProjeto = useCallback((id: string, patch: Partial<Projeto>) => {
    const next = state.current.projetos.map((p) => (p.id === id ? { ...p, ...patch } : p));
    state.current.projetos = next;
    setProjetos(next);
  }, []);

  const upsertDecisao = useCallback((d: Decisao, replaceId?: string) => {
    const prev = state.current.decisoes;
    const key = replaceId ?? d.id;
    const exists = prev.some((x) => x.id === key);
    const next = exists ? prev.map((x) => (x.id === key ? d : x)) : [...prev, d];
    state.current.decisoes = next;
    setDecisoes(next);
  }, []);

  const removeDecisao = useCallback((id: string) => {
    const next = state.current.decisoes.filter((x) => x.id !== id);
    state.current.decisoes = next;
    setDecisoes(next);
  }, []);

  /** Decisão mais recente do projeto, lida do estado interno (sempre atual, mesmo em closures antigas). */
  const getDecisao = useCallback((projectId: string): Decisao | undefined => {
    let best: Decisao | undefined;
    for (const d of state.current.decisoes) {
      if (d.projetoId !== projectId) continue;
      if (!best || (d.updatedAt ?? '') > (best.updatedAt ?? '')) best = d;
    }
    return best;
  }, []);

  return {
    projetos, decisoes, produtos, loading, refreshing, error, savedAt,
    produtosPendentes, produtosErro,
    refresh: () => fetchAll(projetos.length ? 'refresh' : 'initial'),
    retryProdutos: () => {
      const missing = projetos.map((p) => p.id).filter((id) => !produtos[id]);
      void loadProdutos(missing, runId.current);
    },
    patchProjeto, patchProdutos, upsertDecisao, removeDecisao, getDecisao,
    logs, logsLoading, logsErro, addLog, retryLogs: () => void loadLogs(),
    edicoes, setEdicao, alocacao, alocErro, ajustes, setAjuste, rascunhos, setRascunho, retryAlocacao: () => void loadAlocacao(),
    fatores, setFatores, perspectivas, addPerspectiva, statusOpcoes, setStatusOpcoes,
  };
}
export type PainelData = ReturnType<typeof usePainelData>;
