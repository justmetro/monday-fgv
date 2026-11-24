import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Send, CheckCircle2, PencilLine, X, Upload, ExternalLink } from 'lucide-react';
import { carregar, responder, solicitar, aplicarNo0201, carregarLog } from '@generated/server/conferencia';
import { STATUS, type Item, type Eu, type Registro } from '@generated/tipos';

const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const br = (d: string) => (d ? d.split('-').reverse().join('/') : '');
const faixa = (de: string, ate: string) => (de || ate ? `${br(de)} a ${br(ate)}` : '');

const COR: Record<string, string> = {
  'Não iniciado': 'bg-muted text-muted-foreground',
  'Revisar datas': 'bg-bad/10 text-bad',
  'Datas conferidas': 'bg-ok/10 text-ok',
  'Datas corrigidas': 'bg-warn/15 text-warn',
  'Atualizado no 02.01': 'bg-primary/10 text-primary',
};

const respondido = (s: string) => s === 'Datas conferidas' || s === 'Datas corrigidas' || s === 'Atualizado no 02.01';
const vencido = (i: Item) => i.status === 'Revisar datas' && !!i.prazo && i.prazo < hojeISO();

function Badge({ s }: { s: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${COR[s] ?? 'bg-muted'}`}>{s}</span>;
}

function Kpi({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string | number; detalhe?: string; tom?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold ${tom ?? ''}`}>{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

function Conferir({ item, onFechar, onSalvo }: { item: Item; onFechar: () => void; onSalvo: () => void }) {
  const [modo, setModo] = useState<'escolha' | 'corrigir'>('escolha');
  const [vigDe, setVigDe] = useState(item.vigDe);
  const [vigAte, setVigAte] = useState(item.vigAte);
  const [ultimo, setUltimo] = useState(item.ultimo);
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(conferida: boolean) {
    setSalvando(true); setErro('');
    try {
      await responder({ data: conferida ? { itemId: item.id, conferida, obs } : {
        itemId: item.id, conferida, obs,
        vigDe: vigDe !== item.vigDe || vigAte !== item.vigAte ? vigDe : '',
        vigAte: vigDe !== item.vigDe || vigAte !== item.vigAte ? vigAte : '',
        ultimo: ultimo !== item.ultimo ? ultimo : '',
      } });
      onSalvo();
    } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  }

  const input = 'mt-1 w-full rounded-md border bg-card px-2 py-1.5 text-sm';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onFechar}>
      <div className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Conferência de datas</div>
            <div className="font-semibold">{item.nome}</div>
          </div>
          <button onClick={onFechar} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-muted p-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Vigência contratual</div>{faixa(item.vigDe, item.vigAte) || 'Sem data'}</div>
          <div><div className="text-xs text-muted-foreground">Último produto previsto</div>{br(item.ultimo) || 'Sem data'}</div>
        </div>
        {modo === 'corrigir' && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <label>Início da vigência<input type="date" className={input} value={vigDe} onChange={(e) => setVigDe(e.target.value)} /></label>
            <label>Fim da vigência<input type="date" className={input} value={vigAte} onChange={(e) => setVigAte(e.target.value)} /></label>
            <label className="col-span-2">Último produto previsto<input type="date" className={input} value={ultimo} onChange={(e) => setUltimo(e.target.value)} /></label>
          </div>
        )}
        <label className="mt-4 block text-sm">Observação (opcional)
          <textarea className={`${input} h-20`} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: aditivo em assinatura, nova data prevista..." />
        </label>
        {erro && <div className="mt-3 rounded-md bg-bad/10 p-2 text-sm text-bad">{erro}</div>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {modo === 'escolha' ? (
            <>
              <button disabled={salvando} onClick={() => setModo('corrigir')} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted"><PencilLine className="h-4 w-4" />Corrigir datas</button>
              <button disabled={salvando} onClick={() => salvar(true)} className="inline-flex items-center gap-1.5 rounded-md bg-ok px-3 py-2 text-sm text-white hover:opacity-90"><CheckCircle2 className="h-4 w-4" />{salvando ? 'Salvando...' : 'As datas estão certas'}</button>
            </>
          ) : (
            <>
              <button disabled={salvando} onClick={() => setModo('escolha')} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">Voltar</button>
              <button disabled={salvando} onClick={() => salvar(false)} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90">{salvando ? 'Salvando...' : 'Enviar correção'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const URL_0201 = (id: string) => `https://fgvdgpe-projetos.monday.com/boards/18412010674/pulses/${id}`;

function Lateral({ item, coplan, onFechar, onConferir }: { item: Item; coplan: boolean; onFechar: () => void; onConferir: () => void }) {
  const link = (href: string, rotulo: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted">
      {rotulo}<ExternalLink className="h-4 w-4 text-muted-foreground" />
    </a>
  );
  const corr = item.status === 'Datas corrigidas' || item.status === 'Atualizado no 02.01';
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onFechar}>
      <aside className="h-full w-full max-w-md overflow-y-auto border-l bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="font-semibold leading-snug">{item.nome}</div>
          <button onClick={onFechar} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><Badge s={item.status} />{vencido(item) && <span className="text-xs font-medium text-bad">Prazo vencido</span>}</div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="col-span-2"><dt className="text-xs text-muted-foreground">Gerente</dt><dd>{item.gerentes.map((g) => g.nome).join(', ') || 'Sem gerente'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Vigência contratual</dt><dd>{faixa(item.vigDe, item.vigAte) || 'Sem data'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Último produto previsto</dt><dd>{br(item.ultimo) || 'Sem data'}</dd></div>
          {corr && (item.vigOkDe || item.ultimoOk) && (
            <>
              <div><dt className="text-xs text-warn">Vigência correta</dt><dd>{faixa(item.vigOkDe, item.vigOkAte) || 'Sem alteração'}</dd></div>
              <div><dt className="text-xs text-warn">Último produto correto</dt><dd>{br(item.ultimoOk) || 'Sem alteração'}</dd></div>
            </>
          )}
          <div><dt className="text-xs text-muted-foreground">Prazo de resposta</dt><dd className={vencido(item) ? 'text-bad' : ''}>{br(item.prazo) || 'Sem prazo'}</dd></div>
        </dl>

        {(item.status === 'Revisar datas' || (!coplan && item.status !== 'Atualizado no 02.01') || (coplan && respondido(item.status) && item.status !== 'Atualizado no 02.01')) && (
          <button onClick={onConferir} className="mt-5 w-full rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90">{item.status === 'Revisar datas' ? 'Conferir as datas' : 'Rever resposta'}</button>
        )}

        <div className="mt-6 text-xs font-medium text-muted-foreground">Links</div>
        <div className="mt-2 space-y-2">
          {item.linkQuadro && link(item.linkQuadro, 'Quadro do projeto')}
          {coplan && item.id02 && link(URL_0201(item.id02), 'Item no 02.01')}
          {item.linkSGI && link(item.linkSGI, 'Painel SGI')}
          {!item.linkQuadro && !(coplan && item.id02) && !item.linkSGI && <div className="text-muted-foreground">Sem links cadastrados.</div>}
        </div>

        <div className="mt-6 text-xs font-medium text-muted-foreground">Observações</div>
        <div className="mt-2 whitespace-pre-line rounded-md bg-muted p-3">{item.obs || 'Nenhuma observação.'}</div>
      </aside>
    </div>
  );
}

export default function App() {
  const [eu, setEu] = useState<Eu | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aba, setAba] = useState<'projetos' | 'gerentes' | 'historico'>('projetos');
  const [log, setLog] = useState<Registro[] | null>(null);
  const [buscaLog, setBuscaLog] = useState('');
  useEffect(() => { if (aba === 'historico') carregarLog().then((r) => setLog(r as Registro[])).catch((e) => setErro((e as Error).message)); }, [aba]);
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fGerente, setFGerente] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [prazo, setPrazo] = useState('');
  const [aberto, setAberto] = useState<Item | null>(null);
  const [lateral, setLateral] = useState<Item | null>(null);
  const [buscaGer, setBuscaGer] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function recarregar() {
    setCarregando(true); setErro('');
    try {
      const r = (await carregar()) as { eu: Eu; itens: Item[] };
      setEu(r.eu); setItens(r.itens);
    } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  }
  useEffect(() => { void recarregar(); }, []);

  const gerentes = useMemo(() => [...new Set(itens.flatMap((i) => i.gerentes.map((g) => g.nome)).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [itens]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ordem = (i: Item) => (vencido(i) ? 0 : i.status === 'Revisar datas' ? 1 : i.status === 'Datas corrigidas' ? 2 : 3);
    return itens
      .filter((i) => (!q || i.nome.toLowerCase().includes(q)) && (!fStatus || i.status === fStatus) && (!fGerente || (fGerente === '-' ? !i.gerentes.length : i.gerentes.some((g) => g.nome === fGerente))))
      .sort((a, b) => ordem(a) - ordem(b) || a.nome.localeCompare(b.nome));
  }, [itens, busca, fStatus, fGerente]);

  const k = useMemo(() => {
    const pedidos = itens.filter((i) => i.status !== 'Não iniciado').length;
    const resp = itens.filter((i) => respondido(i.status)).length;
    return {
      total: itens.length,
      aguardando: itens.filter((i) => i.status === 'Revisar datas').length,
      vencidos: itens.filter(vencido).length,
      resp,
      corrigidas: itens.filter((i) => i.status === 'Datas corrigidas').length,
      atualizados: itens.filter((i) => i.status === 'Atualizado no 02.01').length,
      pct: pedidos ? Math.round((resp / pedidos) * 100) : 0,
      pedidos,
    };
  }, [itens]);

  const porGerente = useMemo(() => {
    const m = new Map<string, Item[]>();
    itens.forEach((i) => (i.gerentes.length ? i.gerentes.map((g) => g.nome || 'Sem nome') : ['Sem gerente']).forEach((n) => m.set(n, [...(m.get(n) ?? []), i])));
    return [...m.entries()].map(([nome, l]) => {
      const ped = l.filter((i) => i.status !== 'Não iniciado').length;
      const r = l.filter((i) => respondido(i.status)).length;
      return { nome, total: l.length, aguardando: l.filter((i) => i.status === 'Revisar datas').length, vencidos: l.filter(vencido).length, r, pct: ped ? Math.round((r / ped) * 100) : null };
    }).sort((a, b) => b.vencidos - a.vencidos || b.aguardando - a.aguardando || a.nome.localeCompare(b.nome));
  }, [itens]);

  function alternar(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function acao(fn: () => Promise<string>) {
    setOcupado(true); setErro(''); setAviso('');
    try { setAviso(await fn()); setSel(new Set()); await recarregar(); } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }

  const coplan = !!eu?.coplan;
  const selecionados = itens.filter((i) => sel.has(i.id));
  const corrigidosSel = selecionados.filter((i) => i.status === 'Datas corrigidas').length;

  return (
    <div className="min-h-screen p-5 text-sm">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Conferência de Datas de Fim</h1>
            <p className="text-muted-foreground">
              {eu ? (coplan ? 'Visão da CoPlan: todos os projetos.' : `Projetos sob gerência de ${eu.nome}.`) : 'Carregando...'}
            </p>
          </div>
          <button onClick={() => recarregar()} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 hover:bg-muted">
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />Atualizar
          </button>
        </div>

        {erro && <div className="mt-4 rounded-md bg-bad/10 p-3 text-bad">{erro}</div>}
        {aviso && <div className="mt-4 rounded-md bg-ok/10 p-3 text-ok">{aviso}</div>}

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi rotulo="Projetos" valor={k.total} />
          <Kpi rotulo="Aguardando conferência" valor={k.aguardando} tom={k.aguardando ? 'text-bad' : ''} />
          <Kpi rotulo="Com prazo vencido" valor={k.vencidos} tom={k.vencidos ? 'text-bad' : ''} />
          <Kpi rotulo="Respondidos" valor={`${k.pct}%`} detalhe={`${k.resp} de ${k.pedidos} pedidos`} tom="text-ok" />
          <Kpi rotulo="Correções" valor={k.corrigidas + k.atualizados} detalhe={`${k.atualizados} já no 02.01`} />
        </div>

        {coplan && (
          <div className="mt-5 flex gap-1 border-b">
            {(['projetos', 'gerentes', 'historico'] as const).map((a) => (
              <button key={a} onClick={() => setAba(a)} className={`-mb-px border-b-2 px-3 py-2 ${aba === a ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}>
                {a === 'projetos' ? 'Projetos' : a === 'gerentes' ? 'Por gerente' : 'Histórico'}
              </button>
            ))}
          </div>
        )}

        {aba === 'historico' && coplan ? (
          <div className="mt-4">
            <div className="relative mb-3 w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={buscaLog} onChange={(e) => setBuscaLog(e.target.value)} placeholder="Buscar projeto, pessoa ou ação" className="w-full rounded-md border bg-card py-2 pl-8 pr-2" />
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr><th className="p-2.5">Quando</th><th className="p-2.5">Quem</th><th className="p-2.5">Ação</th><th className="p-2.5">Projeto</th><th className="p-2.5">Detalhe</th></tr>
                </thead>
                <tbody>
                  {(log ?? []).filter((r) => { const q = buscaLog.trim().toLowerCase(); return !q || `${r.usuario} ${r.acao} ${r.projeto} ${r.detalhe}`.toLowerCase().includes(q); }).map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="whitespace-nowrap p-2.5">{new Date(r.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="p-2.5">{r.usuario}<div className="text-xs text-muted-foreground">{r.perfil}</div></td>
                      <td className="whitespace-nowrap p-2.5">{r.acao}</td>
                      <td className="max-w-xs p-2.5">{r.projeto}</td>
                      <td className="p-2.5 text-muted-foreground">{r.detalhe}</td>
                    </tr>
                  ))}
                  {log && !log.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma ação registrada ainda.</td></tr>}
                  {!log && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ) : aba === 'gerentes' && coplan ? (
          <div className="mt-4">
          <div className="relative mb-3 w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={buscaGer} onChange={(e) => setBuscaGer(e.target.value)} placeholder="Buscar gerente" className="w-full rounded-md border bg-card py-2 pl-8 pr-2" />
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr><th className="p-2.5">Gerente</th><th className="p-2.5 text-right">Projetos</th><th className="p-2.5 text-right">Aguardando</th><th className="p-2.5 text-right">Prazo vencido</th><th className="p-2.5 text-right">Respondidos</th><th className="p-2.5">% respondido</th></tr>
              </thead>
              <tbody>
                {porGerente.filter((g) => { const q = buscaGer.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return !q || g.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q); }).map((g) => (
                  <tr key={g.nome} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => { setFGerente(g.nome === 'Sem gerente' ? '-' : g.nome); setAba('projetos'); }}>
                    <td className="p-2.5">{g.nome}</td>
                    <td className="p-2.5 text-right">{g.total}</td>
                    <td className={`p-2.5 text-right ${g.aguardando ? 'text-bad' : ''}`}>{g.aguardando}</td>
                    <td className={`p-2.5 text-right ${g.vencidos ? 'font-semibold text-bad' : ''}`}>{g.vencidos}</td>
                    <td className="p-2.5 text-right">{g.r}</td>
                    <td className="p-2.5">
                      {g.pct === null ? <span className="text-muted-foreground">Sem pedido</span> : (
                        <div className="flex items-center gap-2"><div className="h-1.5 w-24 rounded bg-muted"><div className="h-1.5 rounded bg-ok" style={{ width: `${g.pct}%` }} /></div>{g.pct}%</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto" className="w-64 rounded-md border bg-card py-2 pl-8 pr-2" />
              </div>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-md border bg-card px-2 py-2">
                <option value="">Todos os status</option>
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
              {coplan && (
                <select value={fGerente} onChange={(e) => setFGerente(e.target.value)} className="rounded-md border bg-card px-2 py-2">
                  <option value="">Todos os gerentes</option>
                  <option value="-">Sem gerente</option>
                  {gerentes.map((g) => <option key={g}>{g}</option>)}
                </select>
              )}
              <span className="text-muted-foreground">{visiveis.length} projetos</span>
            </div>

            {coplan && sel.size > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <span className="font-medium">{sel.size} selecionados</span>
                <label className="ml-2 flex items-center gap-1.5">Prazo de resposta
                  <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded-md border bg-card px-2 py-1" />
                </label>
                <button disabled={ocupado} onClick={() => acao(async () => {
                  const r = (await solicitar({ data: { itemIds: [...sel], prazo } })) as { atualizados: number; notificados: number; semGerente: number };
                  return `${r.atualizados} projetos marcados como Revisar datas. ${r.notificados} gerentes notificados.${r.semGerente ? ` ${r.semGerente} sem gerente cadastrado.` : ''}`;
                })} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"><Send className="h-4 w-4" />Pedir conferência</button>
                <button disabled={ocupado || !corrigidosSel} onClick={() => acao(async () => {
                  const r = (await aplicarNo0201({ data: { itemIds: [...sel] } })) as { atualizados: number };
                  return `${r.atualizados} correções aplicadas no 02.01.`;
                })} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 hover:bg-muted disabled:opacity-50"><Upload className="h-4 w-4" />Aplicar {corrigidosSel || ''} correções no 02.01</button>
                <button onClick={() => setSel(new Set())} className="ml-auto text-muted-foreground hover:underline">Limpar seleção</button>
              </div>
            )}

            <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
              <table className="w-full">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    {coplan && <th className="w-8 p-2.5"><input type="checkbox" checked={visiveis.length > 0 && visiveis.every((i) => sel.has(i.id))} onChange={(e) => setSel(e.target.checked ? new Set(visiveis.map((i) => i.id)) : new Set())} /></th>}
                    <th className="p-2.5">Projeto</th>
                    {coplan && <th className="p-2.5">Gerente</th>}
                    <th className="p-2.5">Vigência contratual</th>
                    <th className="p-2.5">Último produto</th>
                    <th className="p-2.5">Prazo</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((i) => {
                    const corr = i.status === 'Datas corrigidas';
                    return (
                      <tr key={i.id} className="cursor-pointer border-t align-top hover:bg-muted/40" onClick={() => setLateral(i)}>
                        {coplan && <td className="p-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(i.id)} onChange={() => alternar(i.id)} /></td>}
                        <td className="max-w-xs p-2.5">{i.nome}{i.obs && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={i.obs}>{i.obs.split('\n').pop()}</div>}</td>
                        {coplan && <td className="p-2.5">{i.gerentes.map((g) => g.nome).join(', ') || <span className="text-muted-foreground">Sem gerente</span>}</td>}
                        <td className="whitespace-nowrap p-2.5">{faixa(i.vigDe, i.vigAte) || <span className="text-muted-foreground">Sem data</span>}{corr && i.vigOkDe && <div className="text-xs text-warn">Correta: {faixa(i.vigOkDe, i.vigOkAte)}</div>}</td>
                        <td className="whitespace-nowrap p-2.5">{br(i.ultimo) || <span className="text-muted-foreground">Sem data</span>}{corr && i.ultimoOk && <div className="text-xs text-warn">Correta: {br(i.ultimoOk)}</div>}</td>
                        <td className={`whitespace-nowrap p-2.5 ${vencido(i) ? 'font-semibold text-bad' : ''}`}>{br(i.prazo)}</td>
                        <td className="p-2.5"><Badge s={i.status} /></td>
                        <td className="p-2.5 text-right">
                          {(i.status === 'Revisar datas' || !coplan || respondido(i.status)) && i.status !== 'Atualizado no 02.01' && (
                            <button onClick={(e) => { e.stopPropagation(); setAberto(i); }} className={`whitespace-nowrap rounded-md px-2.5 py-1 ${i.status === 'Revisar datas' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>
                              {i.status === 'Revisar datas' ? 'Conferir' : 'Rever'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!visiveis.length && !carregando && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{coplan ? 'Nenhum projeto com esses filtros.' : 'Nenhum projeto sob sua gerência neste painel.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {lateral && <Lateral item={lateral} coplan={coplan} onFechar={() => setLateral(null)} onConferir={() => { setAberto(lateral); setLateral(null); }} />}
      {aberto && <Conferir item={aberto} onFechar={() => setAberto(null)} onSalvo={() => { setAberto(null); setAviso('Resposta registrada. Obrigado!'); void recarregar(); }} />}
    </div>
  );
}
