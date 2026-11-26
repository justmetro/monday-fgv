import { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { mondayClient } from '@/context/MondayContextProvider';
import { useHub } from '@generated/lib/estado';
import { candidatosQuadro, organizarQuadro, gravarLinkQuadro, lerQuadroBasico, idQuadro, B_0201, CP, type Projeto, type Candidato } from '@generated/lib/quadros';
import { errorMessage } from '@generated/lib/monday';
import { Botao, Cartao, Campo, Aviso, Rotulo, dataBR } from '@generated/components/ui';

export function EtapaQuadro({ onPronto, onProjeto }: { onPronto: () => void; onProjeto: (p: Projeto) => void }) {
  const { projeto, run, atualizar } = useHub();
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [clique, setClique] = useState<string | null>(null);
  const [cands, setCands] = useState<Candidato[] | null>(null);
  const [renomear, setRenomear] = useState(true);
  const [mover, setMover] = useState(true);
  const inicioPadrao = run?.contexto.inicioExecucao ?? projeto?.vigInicio ?? projeto?.assinatura ?? '';
  const [inicio, setInicio] = useState(inicioPadrao);
  const [dias, setDias] = useState(String(run?.contexto.diasVigencia ?? ''));
  if (!projeto || !run) return null;

  const abrirItem = () => {
    setClique(new Date().toISOString());
    mondayClient.execute('openItemCard', { itemId: Number(projeto.id), kind: 'columns' }).catch(() => window.open(`https://fgvdgpe-projetos.monday.com/boards/${B_0201}/pulses/${projeto.id}`, '_blank'));
  };

  const vincular = async (id: string, nome: string, url: string) => {
    const b = await lerQuadroBasico(id);
    if (!b) throw new Error('Não consegui abrir esse quadro (sem acesso ou inexistente).');
    const faltam = Object.values(CP.grupos).filter((g) => !b.groups.some((x: any) => x.id === g));
    if (faltam.length) throw new Error(`O quadro "${b.name}" não tem a estrutura do modelo v6 (faltam grupos ${faltam.join(', ')}).`);
    const feito = await organizarQuadro(id, projeto.name, projeto.codigo, renomear && !b.name.toLowerCase().includes(projeto.codigo.toLowerCase()), mover).catch((e) => [`não foi possível organizar (${errorMessage(e)})`]);
    const nomeFinal = feito.includes('quadro renomeado') ? `[PLAN] ${projeto.name}` : nome || b.name;
    await gravarLinkQuadro(projeto.id, url || b.url, nomeFinal);
    await atualizar({ boardId: id, boardUrl: url || b.url });
    onProjeto({ ...projeto, quadroId: id, quadroUrl: url || b.url });
    setCands(null);
    setMsg(`Quadro vinculado: ${nomeFinal}. O link foi gravado em "Quadro do Planejamento" no 02.01${feito.length ? `; ${feito.join(', ')}` : ''}.`);
  };

  const procurar = async () => {
    setBusy(true); setErro(''); setMsg('');
    try {
      const cs = await candidatosQuadro(projeto.codigo, clique ?? run.criadoEm);
      if (!cs.length) { setErro('Ainda não apareceu nenhum quadro novo no espaço da CoPlan. A criação pelo modelo pode levar até 1 minuto; tente de novo ou cole o link abaixo.'); return; }
      if (cs.length === 1 && cs[0].codigoBate) { await vincular(cs[0].id, cs[0].name, cs[0].url); return; }
      setCands(cs);
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); }
  };

  const colar = async () => {
    const id = idQuadro(manual);
    if (!id) { setErro('Cole o link de um quadro (…/boards/123…).'); return; }
    setBusy(true); setErro(''); setMsg('');
    try { await vincular(id, '', `https://fgvdgpe-projetos.monday.com/boards/${id}`); } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); }
  };

  const usarExistente = async () => {
    if (!projeto.quadroId) return;
    setBusy(true); setErro('');
    try { await vincular(projeto.quadroId, '', projeto.quadroUrl); } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); }
  };

  const salvarDatas = async () => {
    await atualizar({ inicioExecucao: inicio || null, diasVigencia: dias ? Number(dias) : null });
    setMsg('Datas de referência salvas.');
  };

  return (
    <div className="space-y-4">
      <Cartao className="p-4 space-y-3">
        <h2 className="text-[15px] font-semibold">1. Quadro de planejamento</h2>
        {run.boardId ? (
          <Aviso tom="ok">Quadro vinculado. <a className="underline" href={run.boardUrl} target="_blank" rel="noreferrer">Abrir o quadro [PLAN]</a></Aviso>
        ) : projeto.quadroId ? (
          <div className="space-y-2">
            <Aviso tom="info">O 02.01 já tem um quadro de planejamento para este projeto.</Aviso>
            <Botao variante="primario" onClick={usarExistente} carregando={busy}>Usar este quadro</Botao>
          </div>
        ) : (
          <ol className="space-y-3 text-[13px]">
            <li className="flex gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-muted grid place-items-center text-[12px] font-semibold">1</span>
              <div className="space-y-2">
                <div>Abra o item no 02.01 e clique em <b>Criar quadro de planejamento</b> (coluna "Criação quadro de planejamento do projeto"). A automação cria a pasta e o quadro [PLAN] pelo modelo v6.</div>
                <Botao onClick={abrirItem}><ExternalLink className="h-3.5 w-3.5" /> Abrir o item no 02.01</Botao>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-muted grid place-items-center text-[12px] font-semibold">2</span>
              <div className="space-y-2">
                <div>Depois do clique, o hub procura o quadro novo com o código {projeto.codigo} e grava o link no 02.01.</div>
                <Botao variante="primario" onClick={procurar} carregando={busy}><Search className="h-3.5 w-3.5" /> Já cliquei, procurar o quadro</Botao>
              </div>
            </li>
          </ol>
        )}
        {cands && !run.boardId && (
          <div className="rounded-xl border border-border/60 divide-y divide-border/60">
            <div className="px-3 py-2 text-[13px] font-medium">Quadros criados depois do clique. Qual é o deste projeto?</div>
            {cands.map((c) => (
              <div key={c.id} className="px-3 py-2 flex items-center gap-2 text-[13px]">
                <div className="flex-1 min-w-0 truncate">{c.name} <span className="text-muted-foreground text-[12px]">criado {new Date(c.criado).toLocaleString('pt-BR')}</span></div>
                <a href={c.url} target="_blank" rel="noreferrer" className="text-muted-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
                <Botao onClick={() => { setBusy(true); vincular(c.id, c.name, c.url).catch((e) => setErro(errorMessage(e))).finally(() => setBusy(false)); }} carregando={busy}>Vincular</Botao>
              </div>
            ))}
          </div>
        )}
        {!run.boardId && (
          <div className="space-y-1 text-[13px]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={renomear} onChange={(e) => setRenomear(e.target.checked)} /> Renomear o quadro para "[PLAN] {projeto.name}" (se ainda não tiver o código)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={mover} onChange={(e) => setMover(e.target.checked)} /> Mover a pasta do projeto para 06. Planejamentos Ativos</label>
          </div>
        )}
        {!run.boardId && (
          <div className="flex gap-2 items-end pt-1">
            <div className="flex-1"><Rotulo>Ou cole o link do quadro [PLAN]</Rotulo><Campo value={manual} onChange={(e) => setManual(e.target.value)} placeholder="https://fgvdgpe-projetos.monday.com/boards/…" /></div>
            <Botao onClick={colar} carregando={busy}>Vincular</Botao>
          </div>
        )}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {msg && <Aviso tom="ok">{msg}</Aviso>}
      </Cartao>

      <Cartao className="p-4 space-y-3">
        <h2 className="text-[15px] font-semibold">Datas de referência</h2>
        <p className="text-[13px] text-muted-foreground">As datas do cronograma, dos períodos de risco e das medições são calculadas a partir do início da execução (dia 1). Se o contrato ainda não foi assinado, use uma data prevista e ajuste depois.</p>
        <div className="grid grid-cols-[200px_160px_auto] gap-3 items-end">
          <div><Rotulo>Início da execução</Rotulo><Campo type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
          <div><Rotulo>Vigência (dias)</Rotulo><Campo type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} placeholder="ex.: 180" /></div>
          <div><Botao onClick={salvarDatas}>Salvar datas</Botao></div>
        </div>
        <div className="text-[12px] text-muted-foreground">No 02.01: vigência {dataBR(projeto.vigInicio)} a {dataBR(projeto.vigFim)}, assinatura {dataBR(projeto.assinatura)}.</div>
        {run.boardId && <div className="flex justify-end"><Botao variante="primario" onClick={onPronto}>Continuar para Documentos</Botao></div>}
      </Cartao>
    </div>
  );
}
