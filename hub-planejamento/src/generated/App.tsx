import { useEffect, useMemo, useState } from 'react';
import { Moon, Sun, Search, RefreshCw, Plus, ExternalLink, Check, CircleDashed, Loader2, AlertTriangle } from 'lucide-react';
import { mondayClient } from '@/context/MondayContextProvider';
import { listarProjetos, ehAtivo, type Projeto } from '@generated/lib/quadros';
import { errorMessage } from '@generated/lib/monday';
import { criarExecucao, listarExecucoes, estadoEtapas, statusIA, atualizarExecucao, type Execucao, type Etapa } from '@generated/server/hub';
import { HubProvider, ROTULO_ETAPA } from '@generated/lib/estado';
import { Botao, Cartao, Selo, Campo, Aviso, cx, dataBR } from '@generated/components/ui';
import { EtapaQuadro } from '@generated/components/EtapaQuadro';
import { EtapaDocumentos } from '@generated/components/EtapaDocumentos';
import { EtapaAnalise } from '@generated/components/EtapaAnalise';
import { EtapaProdutos } from '@generated/components/EtapaProdutos';
import { EtapaEap } from '@generated/components/EtapaEap';
import { EtapaRiscos } from '@generated/components/EtapaRiscos';
import { EtapaIndicadores } from '@generated/components/EtapaIndicadores';
import { EtapaPartes } from '@generated/components/EtapaPartes';

type Aba = 'quadro' | 'documentos' | 'analise' | 'produtos' | 'eap' | 'riscos' | 'indicadores' | 'partes';
const ABAS: { id: Aba; nome: string; etapas: Etapa[] }[] = [
  { id: 'quadro', nome: 'Quadro', etapas: [] },
  { id: 'documentos', nome: 'Documentos', etapas: [] },
  { id: 'analise', nome: 'Análise e TAP', etapas: ['analise', 'tap'] },
  { id: 'produtos', nome: 'Produtos', etapas: ['produtos'] },
  { id: 'eap', nome: 'EAP e Cronograma', etapas: ['eap'] },
  { id: 'riscos', nome: 'Riscos', etapas: ['riscos', 'complemento'] },
  { id: 'indicadores', nome: 'Indicadores', etapas: ['indicadores'] },
  { id: 'partes', nome: 'Partes Interessadas', etapas: ['partes'] },
];

function lerTema(): 'claro' | 'escuro' {
  try { return (localStorage.getItem('hub-tema') as 'claro' | 'escuro') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'); } catch { return 'claro'; }
}

export default function App() {
  const [tema, setTema] = useState(lerTema);
  const [projetos, setProjetos] = useState<Projeto[] | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [soAtivos, setSoAtivos] = useState(true);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [runs, setRuns] = useState<Execucao[]>([]);
  const [run, setRun] = useState<Execucao | null>(null);
  const [aba, setAba] = useState<Aba>('quadro');
  const [userId, setUserId] = useState('');
  const [iaOk, setIaOk] = useState<boolean | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    try { localStorage.setItem('hub-tema', tema); } catch { /* sem armazenamento */ }
  }, [tema]);

  const carregar = async () => {
    setErro('');
    try { setProjetos(await listarProjetos()); } catch (e) { setErro(errorMessage(e)); }
  };
  useEffect(() => {
    carregar();
    mondayClient.api('query { me { id } }').then((r: any) => setUserId(String(r?.data?.me?.id ?? ''))).catch(() => null);
    statusIA({}).then((r: any) => setIaOk(!!r?.autorizado)).catch(() => setIaOk(false));
  }, []);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (projetos ?? []).filter((p) => (!soAtivos || ehAtivo(p)) && (!q || p.name.toLowerCase().includes(q)));
  }, [projetos, busca, soAtivos]);

  const escolher = async (p: Projeto) => {
    setProjeto(p); setRun(null); setRuns([]); setAbrindo(true); setErro('');
    try {
      const rs = (await listarExecucoes({ data: { itemId: p.id } })) as Execucao[];
      setRuns(rs);
      if (rs[0]) setRun((await estadoEtapas({ data: { runId: rs[0]._id } })) as Execucao);
      setAba(p.quadroId ? (rs[0]?.docs?.length ? 'analise' : 'documentos') : 'quadro');
    } catch (e) { setErro(errorMessage(e)); } finally { setAbrindo(false); }
  };

  const nova = async () => {
    if (!projeto) return;
    setAbrindo(true);
    try {
      const r = (await criarExecucao({ data: {
        itemId: projeto.id, nomeItem: projeto.name, codigo: projeto.codigo, eixo02: projeto.eixo || undefined, valor02: projeto.valor,
        cliente02: projeto.cliente || undefined, boardId: projeto.quadroId ?? undefined, boardUrl: projeto.quadroUrl || undefined,
      } })) as Execucao;
      setRuns((x) => [r, ...x]); setRun(r); setAba(projeto.quadroId ? 'documentos' : 'quadro');
    } catch (e) { setErro(errorMessage(e)); } finally { setAbrindo(false); }
  };

  const abrirRun = async (id: string) => {
    setAbrindo(true);
    try { setRun((await estadoEtapas({ data: { runId: id } })) as Execucao); } catch (e) { setErro(errorMessage(e)); } finally { setAbrindo(false); }
  };

  const iconeAba = (a: (typeof ABAS)[number]) => {
    if (!run) return null;
    const sts = a.etapas.map((e) => run.etapas?.[e]?.status);
    if (a.id === 'quadro') return run.boardId ? <Check className="h-3.5 w-3.5 text-[hsl(var(--ok))]" /> : null;
    if (a.id === 'documentos') return run.docs?.length ? <Check className="h-3.5 w-3.5 text-[hsl(var(--ok))]" /> : null;
    if (sts.includes('gerando')) return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    if (sts.includes('erro')) return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    if (sts.length && sts.every((s) => s === 'gravada')) return <Check className="h-3.5 w-3.5 text-[hsl(var(--ok))]" />;
    if (sts.some((s) => s === 'pronta' || s === 'gravada')) return <CircleDashed className="h-3.5 w-3.5 text-primary" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border/60">
        <div className="mx-auto max-w-[1400px] px-5 h-14 flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-foreground text-background grid place-items-center text-[11px] font-bold">FGV</div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">Hub de Planejamento</div>
            <div className="text-[11.5px] text-muted-foreground">Pré-preenchimento do quadro [PLAN] com IA a partir dos documentos de pactuação</div>
          </div>
          <div className="flex-1" />
          {iaOk === false && <Selo tom="erro">IA sem autorização do app</Selo>}
          <Botao variante="fantasma" onClick={() => setTema(tema === 'escuro' ? 'claro' : 'escuro')} aria-label="Alternar tema">
            {tema === 'escuro' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Botao>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 py-5 grid grid-cols-[300px_1fr] gap-5">
        <aside className="space-y-3">
          <Cartao className="p-3 space-y-2.5 sticky top-[72px]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2 text-muted-foreground" />
              <Campo className="pl-8" placeholder="Buscar projeto no 02.01" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-[12.5px]">
              <div className="inline-flex rounded-full bg-muted p-0.5">
                {[['Ativos', true], ['Todos', false]].map(([n, v]) => (
                  <button key={String(n)} onClick={() => setSoAtivos(v as boolean)} className={cx('px-2.5 h-6 rounded-full', soAtivos === v ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>{n as string}</button>
                ))}
              </div>
              <div className="flex-1" />
              <button onClick={carregar} className="text-muted-foreground hover:text-foreground" aria-label="Recarregar"><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto -mx-1 px-1 space-y-1">
              {!projetos && !erro && <div className="text-[13px] text-muted-foreground p-2 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Lendo o 02.01…</div>}
              {lista.map((p) => (
                <button key={p.id} onClick={() => escolher(p)}
                  className={cx('w-full text-left rounded-xl px-2.5 py-2 transition', projeto?.id === p.id ? 'bg-accent' : 'hover:bg-muted')}>
                  <div className="text-[13px] font-medium leading-snug line-clamp-2">{p.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Selo>{p.status || 'Sem status'}</Selo>
                    {p.quadroId ? <Selo tom="ok">Quadro criado</Selo> : <Selo tom="aviso">Sem quadro</Selo>}
                  </div>
                </button>
              ))}
              {projetos && !lista.length && <div className="text-[13px] text-muted-foreground p-2">Nenhum projeto.</div>}
            </div>
          </Cartao>
        </aside>

        <main className="min-w-0 space-y-4">
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          {!projeto && (
            <Cartao className="p-8 text-center">
              <div className="text-[17px] font-semibold">Escolha um projeto do 02.01</div>
              <p className="mt-2 text-[13px] text-muted-foreground max-w-xl mx-auto">O hub cria o quadro [PLAN] pelo botão do 02.01, lê o TR, a proposta, o contrato e os anexos, e prepara TAP, Produtos, EAP e Cronograma, Riscos, Indicadores e Partes Interessadas. Cada etapa mostra uma prévia para revisar antes de gravar.</p>
            </Cartao>
          )}

          {projeto && (
            <Cartao className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold leading-snug">{projeto.name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[12px]">
                    <Selo>{projeto.status}</Selo>
                    {projeto.eixo && <Selo tom="azul">{projeto.eixo}</Selo>}
                    {projeto.focal && <Selo>Ponto focal: {projeto.focal}</Selo>}
                    {run?.boardUrl && <a href={run.boardUrl} target="_blank" rel="noreferrer"><Selo tom="ok">Quadro [PLAN] <ExternalLink className="h-3 w-3" /></Selo></a>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {runs.length > 1 && (
                    <select className="rounded-lg border border-input bg-background/60 px-2 h-8 text-[12.5px]" value={run?._id ?? ''} onChange={(e) => abrirRun(e.target.value)}>
                      {runs.map((r) => <option key={r._id} value={r._id}>Execução de {dataBR(r.criadoEm)} {r.criadoPorNome ? `(${r.criadoPorNome})` : ''}</option>)}
                    </select>
                  )}
                  {run && (
                    <select title="Modelo de IA usado nas próximas gerações" className="rounded-lg border border-input bg-background/60 px-2 h-8 text-[12.5px]" value={run.modelo}
                      onChange={async (e) => setRun((await atualizarExecucao({ data: { runId: run._id, modelo: e.target.value } })) as Execucao)}>
                      <option value="monday-standard">IA: padrão da monday</option>
                      <option value="gpt-5">IA: GPT-5</option>
                      <option value="gpt-5-mini">IA: GPT-5 mini</option>
                    </select>
                  )}
                  <Botao variante={run ? 'secundario' : 'primario'} onClick={nova} carregando={abrindo}><Plus className="h-4 w-4" /> Nova execução</Botao>
                </div>
              </div>
              {run && (
                <nav className="mt-4 flex flex-wrap gap-1">
                  {ABAS.map((a) => (
                    <button key={a.id} onClick={() => setAba(a.id)}
                      className={cx('inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[13px] transition', aba === a.id ? 'bg-foreground text-background font-medium' : 'bg-muted hover:bg-secondary')}>
                      {a.nome} {iconeAba(a)}
                    </button>
                  ))}
                </nav>
              )}
            </Cartao>
          )}

          {projeto && !run && !abrindo && (
            <Aviso tom="info">Este projeto ainda não tem execução no hub. Clique em Nova execução para começar.</Aviso>
          )}

          {projeto && run && (
            <HubProvider projeto={projeto} run={run} setRun={setRun} userId={userId}>
              {aba === 'quadro' && <EtapaQuadro onPronto={() => setAba('documentos')} onProjeto={(p) => { setProjeto(p); setProjetos((xs) => xs?.map((x) => (x.id === p.id ? p : x)) ?? xs); }} />}
              {aba === 'documentos' && <EtapaDocumentos onPronto={() => setAba('analise')} />}
              {aba === 'analise' && <EtapaAnalise />}
              {aba === 'produtos' && <EtapaProdutos />}
              {aba === 'eap' && <EtapaEap />}
              {aba === 'riscos' && <EtapaRiscos />}
              {aba === 'indicadores' && <EtapaIndicadores />}
              {aba === 'partes' && <EtapaPartes />}
            </HubProvider>
          )}
          {run && <div className="text-[11.5px] text-muted-foreground text-right">Custos de IA desta execução: {(Object.keys(ROTULO_ETAPA) as Etapa[]).reduce((s, e) => s + (run.etapas?.[e]?.custo ?? 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })} em créditos da monday</div>}
        </main>
      </div>
    </div>
  );
}
