import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun, Search, RefreshCw, Plus, ExternalLink, Check, CircleDashed, Loader2, AlertTriangle, KeyRound, Download, Upload } from 'lucide-react';
import { mondayClient } from '@/context/MondayContextProvider';
import { listarProjetos, ehAtivo, type Projeto } from '@generated/lib/quadros';
import { errorMessage } from '@generated/lib/monday';
import { criarExecucao, listarExecucoes, estadoEtapas, statusIA, pedirAutorizacao, atualizarExecucao, type Execucao, type Etapa } from '@generated/server/hub';
import { HubProvider } from '@generated/lib/estado';
import { exportarPlanilha, importarPlanilha } from '@generated/server/planilha';
import { paraBase64 } from '@generated/lib/documentos';
import { ROTULO_ETAPA } from '@generated/lib/rotulos';
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
  const [autor, setAutor] = useState('');
  const [autorizando, setAutorizando] = useState(false);
  const espera = useRef<number | undefined>(undefined);
  const [abrindo, setAbrindo] = useState(false);
  const [planilha, setPlanilha] = useState<'' | 'exportando' | 'importando'>('');
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro' | 'info'; texto: string; url?: string; blob?: string; nome?: string } | null>(null);
  const arquivoPlanilha = useRef<HTMLInputElement>(null);

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
    conferirAutorizacao();
    // Ao voltar para a aba do monday depois de autorizar, confere de novo.
    const aoFocar = () => { conferirAutorizacao(); };
    window.addEventListener('focus', aoFocar);
    return () => { window.clearInterval(espera.current); window.removeEventListener('focus', aoFocar); };
  }, []);

  const conferirAutorizacao = async () => {
    try {
      const r: any = await statusIA({});
      setIaOk(!!r?.autorizado); setAutor(r?.nome ?? '');
      return !!r?.autorizado;
    } catch { setIaOk(false); return false; }
  };

  // Cada pessoa autoriza o hub uma vez; a partir daí IA, TAP, anexos e gravações saem no nome dela.
  const autorizar = async () => {
    setAutorizando(true); setErro('');
    try {
      const { url } = (await pedirAutorizacao({})) as { url: string };
      // O SDK nem sempre responde ao abrir a aba: não espera por ele para começar a conferir.
      mondayClient.execute('openLinkInTab', { url }).catch(() => window.open(url, '_blank'));
      const ate = Date.now() + 10 * 60_000;
      window.clearInterval(espera.current);
      espera.current = window.setInterval(async () => {
        if ((await conferirAutorizacao()) || Date.now() > ate) { window.clearInterval(espera.current); setAutorizando(false); }
      }, 3000);
    } catch (e) { setErro(errorMessage(e)); setAutorizando(false); }
  };

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

  // Planilha .xlsx com tudo o que foi gerado nesta execução (uma aba por etapa).
  const exportar = async () => {
    if (!run) return;
    setPlanilha('exportando'); setAviso(null);
    try {
      const r = (await exportarPlanilha({ data: { runId: run._id } })) as { id: string; nome: string; base64: string };
      const url = new URL(`./arquivo/${r.id}`, window.location.href).href;
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const blob = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      mondayClient.execute('openLinkInTab', { url }).catch(() => window.open(url, '_blank'));
      setAviso({ tom: 'ok', texto: 'Planilha exportada. O download abre numa aba nova.', url, blob, nome: r.nome });
    } catch (e) { setAviso({ tom: 'erro', texto: errorMessage(e) }); } finally { setPlanilha(''); }
  };

  const importar = async (f: File | undefined) => {
    if (!run || !f) return;
    setPlanilha('importando'); setAviso(null);
    try {
      const r = (await importarPlanilha({ data: { runId: run._id, base64: await paraBase64(f) } })) as { etapas: Etapa[]; avisos: string[] };
      setRun((await estadoEtapas({ data: { runId: run._id } })) as Execucao);
      const nomes = r.etapas.map((e) => ROTULO_ETAPA[e as keyof typeof ROTULO_ETAPA] ?? e).join(', ');
      const gravadas = r.etapas.filter((e) => run.etapas?.[e]?.status === 'gravada');
      setAviso({ tom: 'ok', texto: `Planilha importada nas prévias: ${nomes}.${gravadas.length ? ' Nas etapas já gravadas, use Comparar com o quadro para levar as mudanças.' : ''}${r.avisos.length ? ` Avisos: ${r.avisos.slice(0, 5).join(' ')}` : ''}` });
    } catch (e) { setAviso({ tom: 'erro', texto: errorMessage(e) }); } finally { setPlanilha(''); if (arquivoPlanilha.current) arquivoPlanilha.current.value = ''; }
  };

  const iconeAba = (a: (typeof ABAS)[number]) => {
    if (!run) return null;
    const sts = a.etapas.map((e) => run.etapas?.[e]?.status);
    if (a.id === 'quadro') return run.boardId ? <Check className="h-3.5 w-3.5 text-[hsl(var(--ok))]" /> : null;
    if (a.id === 'documentos') return run.docs?.length ? <Check className="h-3.5 w-3.5 text-[hsl(var(--ok))]" /> : null;
    if (sts.includes('gerando') || a.etapas.some((e) => run.etapas?.[e]?.gravando)) return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    if (sts.includes('erro')) return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    if (sts.length && sts.every((s) => s === 'gravada')) return <Check className="h-3.5 w-3.5 text-[hsl(var(--ok))]" />;
    if (sts.some((s) => s === 'pronta' || s === 'gravada')) return <CircleDashed className="h-3.5 w-3.5 text-primary" />;
    return null;
  };

  const concluidas = run ? ABAS.filter((a) => {
    if (a.id === 'quadro') return !!run.boardId;
    if (a.id === 'documentos') return !!run.docs?.length;
    return a.etapas.length > 0 && a.etapas.every((e) => run.etapas?.[e]?.status === 'gravada');
  }).length : 0;

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
          {iaOk === false && <Selo tom="erro">Hub sem a sua autorização</Selo>}
          {iaOk && autor && <Selo tom="ok">Agindo no nome de {autor}</Selo>}
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
          {iaOk === false && (
            <Cartao className="p-5 flex items-start gap-4">
              <KeyRound className="h-5 w-5 mt-0.5 text-primary" />
              <div className="flex-1">
                <div className="text-[15px] font-semibold">Autorize o hub a agir no seu nome</div>
                <p className="mt-1 text-[13px] text-muted-foreground">É uma vez só. Depois disso a IA, o TAP, os anexos e as gravações nos quadros saem com a sua conta da monday e respeitam as suas permissões. Abre uma aba da monday: clique em Authorize e volte para cá.</p>
              </div>
              <Botao variante="primario" onClick={autorizar} carregando={autorizando}>{autorizando ? 'Aguardando…' : 'Autorizar'}</Botao>
            </Cartao>
          )}
          {!projeto && (
            <Cartao className="p-10 text-center entra">
              <div className="text-[22px] font-semibold tracking-tight">Escolha um projeto do 02.01</div>
              <p className="mt-2 text-[13px] text-muted-foreground max-w-xl mx-auto">O hub cria o quadro [PLAN] pelo botão do 02.01, lê o TR, a proposta, o contrato e os anexos, e prepara TAP, Produtos, EAP e Cronograma, Riscos, Indicadores e Partes Interessadas. Cada etapa mostra uma prévia para revisar antes de gravar.</p>
            </Cartao>
          )}

          {projeto && (
            <Cartao className="p-4 entra">
              <div className="flex items-start gap-3">
                {run && <Anel feito={concluidas} total={ABAS.length} />}
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
                      <option value="gemini-3.5-flash">IA: Gemini 3.5 Flash</option>
                      <option value="gemini-3.8-flash">IA: Gemini 3.8 Flash</option>
                      <option value="openrouter/free">IA: OpenRouter gratuito</option>
                      <option value="nvidia/nemotron-3-ultra-550b-a55b:free">IA: Nemotron 3 Ultra (OpenRouter)</option>
                      <option value="nvidia/nemotron-3.5-super-vl:free">IA: Nemotron 3.5 Super (OpenRouter)</option>
                      <option value="nvidia/nemotron-3.5-lightning:free">IA: Nemotron 3.5 Lightning (OpenRouter)</option>
                      <option value="baidu/ernie-5.5-flash-preview:free">IA: ERNIE 5.5 Flash (OpenRouter)</option>
                      <option value="particle-ai/particle-1:free">IA: Particle 1 (OpenRouter)</option>
                      <option value="google/gemma-4-31b-it:free">IA: Gemma 4 31B (OpenRouter)</option>
                    </select>
                  )}
                  {run && <Botao variante="fantasma" onClick={exportar} carregando={planilha === 'exportando'} title="Baixar tudo o que foi gerado em .xlsx"><Download className="h-4 w-4" /> Exportar</Botao>}
                  {run && <Botao variante="fantasma" onClick={() => arquivoPlanilha.current?.click()} carregando={planilha === 'importando'} title="Subir uma planilha exportada pelo hub para as prévias desta execução"><Upload className="h-4 w-4" /> Importar</Botao>}
                  <input ref={arquivoPlanilha} type="file" accept=".xlsx" className="hidden" onChange={(e) => importar(e.target.files?.[0])} />
                  <Botao variante={run ? 'secundario' : 'primario'} onClick={nova} carregando={abrindo}><Plus className="h-4 w-4" /> Nova execução</Botao>
                </div>
              </div>
              {aviso && (
                <div className="mt-3">
                  <Aviso tom={aviso.tom}>
                    {aviso.texto}
                    {aviso.blob && <> Se não baixou, <a className="underline" href={aviso.blob} download={aviso.nome}>baixe por aqui</a> ou <a className="underline" href={aviso.url} target="_blank" rel="noreferrer">abra o link</a> (vale 15 minutos).</>}
                    <button className="ml-2 underline text-[12px]" onClick={() => setAviso(null)}>fechar</button>
                  </Aviso>
                </div>
              )}
              {run && (
                <nav className="mt-4 flex flex-wrap gap-1">
                  {ABAS.map((a) => (
                    <button key={a.id} onClick={() => setAba(a.id)}
                      className={cx('inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[13px] transition', aba === a.id ? 'bg-foreground text-background font-medium shadow-sm' : 'bg-muted hover:bg-secondary text-foreground/80')}>
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

          {projeto && run && iaOk !== false && (
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
          {run && <div className="text-[11.5px] text-muted-foreground text-right">Custos de IA desta execução: <span className="num">{(Object.keys(ROTULO_ETAPA) as Etapa[]).reduce((s, e) => s + (run.etapas?.[e]?.custo ?? 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}</span></div>}
        </main>
      </div>
    </div>
  );
}

/** Anel de progresso das etapas (SVG, sem biblioteca). */
function Anel({ feito, total }: { feito: number; total: number }) {
  const r = 17, c = 2 * Math.PI * r, f = total ? feito / total : 0;
  return (
    <div className="relative h-11 w-11 shrink-0" title={`${feito} de ${total} etapas concluídas`}>
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={f >= 1 ? 'hsl(var(--ok))' : 'hsl(var(--foreground))'} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - f)} style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold num">{feito}/{total}</div>
    </div>
  );
}
