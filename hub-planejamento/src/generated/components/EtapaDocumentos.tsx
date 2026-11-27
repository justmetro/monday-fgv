import { useRef, useState } from 'react';
import { Upload, FileText, X, Loader2, Trash2 } from 'lucide-react';
import { useHub } from '@generated/lib/estado';
import { lerArquivo, adivinharTipo, paraBase64, TIPOS_DOC, type DocLocal } from '@generated/lib/documentos';
import { salvarDocumentos, anexarDocumento, ajustarDocumentos } from '@generated/server/hub';
import { C0201 } from '@generated/lib/quadros';
import { errorMessage } from '@generated/lib/monday';
import { Botao, Cartao, Aviso, Escolha, Progresso } from '@generated/components/ui';

export function EtapaDocumentos({ onPronto }: { onPronto: () => void }) {
  const { projeto, run, recarregar } = useHub();
  const [docs, setDocs] = useState<DocLocal[]>([]);
  const [anexar, setAnexar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [removendo, setRemovendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!projeto || !run) return null;

  const adicionar = (files: FileList | File[]) => {
    const novos: DocLocal[] = Array.from(files).map((f) => ({ chave: `${f.name}-${f.size}-${Math.random()}`, arquivo: f, nome: f.name, tipo: adivinharTipo(f.name), estado: 'lendo', texto: '', paginas: 0 }));
    setDocs((d) => [...d, ...novos]);
    novos.forEach(async (d) => {
      try {
        const r = await lerArquivo(d.arquivo);
        const util = r.texto.replace(/\[página \d+\]/g, '').replace(/\s+/g, '');
        setDocs((xs) => xs.map((x) => (x.chave === d.chave ? { ...x, estado: 'ok', texto: r.texto, paginas: r.paginas, semTexto: util.length < 200 } : x)));
      } catch (e) {
        setDocs((xs) => xs.map((x) => (x.chave === d.chave ? { ...x, estado: 'erro', erro: errorMessage(e) } : x)));
      }
    });
  };

  const salvar = async () => {
    const prontos = docs.filter((d) => d.estado === 'ok' && !d.semTexto);
    if (!prontos.length) { setErro('Nenhum documento com texto legível.'); return; }
    setBusy(true); setErro(''); setOk('');
    try {
      setProg('Enviando o texto dos documentos para o hub…');
      const r: any = await salvarDocumentos({ data: { runId: run._id, docs: prontos.map((d) => ({ nome: d.nome, tipo: d.tipo, texto: d.texto })) } });
      if (anexar) {
        for (let i = 0; i < prontos.length; i++) {
          setProg(`Anexando no 02.01 (${i + 1}/${prontos.length}): ${prontos[i].nome}`);
          await anexarDocumento({ data: { itemId: projeto.id, columnId: C0201.docs, nome: prontos[i].nome, base64: await paraBase64(prontos[i].arquivo), mime: prontos[i].arquivo.type || undefined } });
        }
      }
      await recarregar();
      setOk(`${prontos.length} documentos adicionados (a execução tem agora ${r.docs?.length ?? prontos.length} documentos, ${Math.round(r.chars / 1000)} mil caracteres)${anexar ? ' e anexados no 02.01, coluna Documentos de Pactuação' : ''}.`);
      setDocs([]);
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); setProg(''); }
  };

  const remover = async (nomes: string[]) => {
    if (!nomes.length) return;
    setRemovendo(true); setErro(''); setOk('');
    try {
      await ajustarDocumentos({ data: { runId: run._id, remover: nomes } });
      await recarregar();
      setMarcados(new Set());
      setOk(`${nomes.length === 1 ? '1 documento removido' : `${nomes.length} documentos removidos`} da execução. Os anexos do 02.01 continuam lá.`);
    } catch (e) { setErro(errorMessage(e)); } finally { setRemovendo(false); }
  };
  const trocarTipo = async (nome: string, tipo: string) => {
    try { await ajustarDocumentos({ data: { runId: run._id, tipos: { [nome]: tipo } } }); await recarregar(); } catch (e) { setErro(errorMessage(e)); }
  };
  const alternar = (nome: string) => setMarcados((m) => { const n = new Set(m); if (n.has(nome)) n.delete(nome); else n.add(nome); return n; });
  const todos = run.docs.length > 0 && marcados.size === run.docs.length;

  const temTR = docs.some((d) => d.tipo === 'TR') || run.docs.some((d) => d.tipo === 'TR');
  const temContrato = docs.some((d) => /Contrato|Aditivo/.test(d.tipo)) || run.docs.some((d) => /Contrato|Aditivo/.test(d.tipo));

  return (
    <div className="space-y-4">
      <Cartao className="p-4 space-y-3">
        <h2 className="text-[15px] font-semibold">2. Documentos de pactuação</h2>
        <p className="text-[13px] text-muted-foreground">Envie o TR, a proposta, o contrato e os anexos (normalmente baixados do SGI). O texto é lido aqui no navegador e vai para a IA. A ordem de prioridade entre documentos é TR, contrato, proposta, minuta e demais anexos.</p>
        {run.docs.length > 0 && (
          <div className="rounded-xl bg-muted/60 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={todos} onChange={() => setMarcados(todos ? new Set() : new Set(run.docs.map((d) => d.nome)))} aria-label="Marcar todos" />
              <div className="text-[12.5px] font-medium flex-1">Documentos já salvos nesta execução ({run.docs.length})</div>
              {marcados.size > 0 && <Botao variante="fantasma" onClick={() => remover([...marcados])} carregando={removendo}><Trash2 className="h-3.5 w-3.5" /> Remover {marcados.size}</Botao>}
            </div>
            {run.docs.map((d) => (
              <div key={d.nome} className="text-[13px] flex items-center gap-2">
                <input type="checkbox" checked={marcados.has(d.nome)} onChange={() => alternar(d.nome)} aria-label={`Marcar ${d.nome}`} />
                <FileText className="h-3.5 w-3.5 text-muted-foreground" /> <span className="truncate">{d.nome}</span>
                <span className="text-muted-foreground text-[12px] shrink-0">{Math.round(d.chars / 1000)} mil caracteres</span>
                <div className="flex-1" />
                <Escolha opcoes={TIPOS_DOC} valor={d.tipo} onMudar={(v) => trocarTipo(d.nome, v)} />
                <button onClick={() => remover([d.nome])} className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${d.nome}`}><X className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="text-[12px] text-muted-foreground">Novos documentos entram somados a esta lista. Um arquivo com o mesmo nome substitui o anterior.</div>
          </div>
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionar(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${arrastando ? 'border-primary bg-accent' : 'border-border hover:bg-muted/50'}`}>
          <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
          <div className="mt-2 text-[13px]">Arraste os arquivos aqui ou clique para escolher (PDF, DOCX ou TXT)</div>
          <input ref={input} type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files && adicionar(e.target.files)} />
        </div>
        {docs.length > 0 && (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60">
            {docs.map((d) => (
              <div key={d.chave} className="flex items-center gap-3 px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate">{d.nome}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {d.estado === 'lendo' && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> lendo…</span>}
                    {d.estado === 'ok' && !d.semTexto && `${d.paginas ? `${d.paginas} páginas, ` : ''}${Math.round(d.texto.length / 1000)} mil caracteres`}
                    {d.estado === 'ok' && d.semTexto && <span className="text-destructive">Sem texto legível (PDF escaneado). Gere um PDF pesquisável ou envie o DOCX.</span>}
                    {d.estado === 'erro' && <span className="text-destructive">{d.erro}</span>}
                  </div>
                </div>
                <Escolha opcoes={TIPOS_DOC} valor={d.tipo} onMudar={(v) => setDocs((xs) => xs.map((x) => (x.chave === d.chave ? { ...x, tipo: v } : x)))} />
                <button onClick={() => setDocs((xs) => xs.filter((x) => x.chave !== d.chave))} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {docs.length > 0 && !temTR && <Aviso>Nenhum documento marcado como TR. A IA segue com o que houver e registra a falta nas pendências.</Aviso>}
        {docs.length > 0 && !temContrato && <Aviso tom="info">Sem contrato: datas e valores sairão do TR e da proposta, com as divergências registradas.</Aviso>}
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={anexar} onChange={(e) => setAnexar(e.target.checked)} /> Anexar os arquivos no item do 02.01 (coluna Documentos de Pactuação)</label>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {ok && <Aviso tom="ok">{ok}</Aviso>}
        <div className="flex items-center gap-3">
          {busy && <Progresso texto={prog} />}
          <div className="flex-1" />
          {run.docs.length > 0 && !docs.length && <Botao onClick={onPronto}>Continuar para Análise</Botao>}
          <Botao variante="primario" onClick={salvar} carregando={busy} disabled={!docs.some((d) => d.estado === 'ok' && !d.semTexto) || docs.some((d) => d.estado === 'lendo')}>Adicionar documentos</Botao>
        </div>
      </Cartao>
    </div>
  );
}
