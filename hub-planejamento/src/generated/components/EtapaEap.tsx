import { Trash2, ChevronRight } from 'lucide-react';
import { useHub } from '@generated/lib/estado';
import type { EapProduto } from '@generated/lib/gravar';
import { ROTULOS } from '@generated/lib/rotulos';
import { diaParaData } from '@generated/lib/quadros';
import { resumoProdutos, type ResultadoProdutos } from '@generated/components/EtapaProdutos';
import { Moldura, BarraGravar } from '@generated/components/Moldura';
import { Campo, Escolha, Aviso, dataBR } from '@generated/components/ui';

const VERBO = /^(a|o|os|as|um|uma)\s/i;

function Dias({ a, b, onA, onB, inicio }: { a: number; b: number; onA: (n: number) => void; onB: (n: number) => void; inicio: string | null }) {
  return (
    <div className="flex items-center gap-1 text-[12px] text-muted-foreground shrink-0" title={inicio ? `${dataBR(diaParaData(inicio, a))} a ${dataBR(diaParaData(inicio, b))}` : ''}>
      dia <input className="w-12 rounded border border-input bg-background/60 px-1 h-6" type="number" value={a} onChange={(e) => onA(Number(e.target.value))} />
      a <input className="w-12 rounded border border-input bg-background/60 px-1 h-6" type="number" value={b} onChange={(e) => onB(Number(e.target.value))} />
    </div>
  );
}

export function EtapaEap() {
  const { run, etapa, gerar, editar, gravarQuadro } = useHub();
  const st = etapa('eap');
  if (!run) return null;
  const prod = run.etapas.produtos?.resultado as ResultadoProdutos | undefined;
  const produtos = resumoProdutos(prod);
  const r = st.resultado as { produtos: EapProduto[] } | undefined;
  const inicio = run.contexto.inicioExecucao ?? null;
  const prodGravados = run.etapas.produtos?.status === 'gravada';

  const set = (fn: (x: EapProduto[]) => void) => {
    if (!r) return;
    const c: EapProduto[] = JSON.parse(JSON.stringify(r.produtos));
    fn(c);
    editar('eap', { produtos: c });
  };

  const gravar = () => { if (r && run.boardId && inicio) gravarQuadro('eap'); };

  const total = r?.produtos.reduce((s, p) => s + p.entregaveis.reduce((s2, e) => s2 + 1 + e.marcos.reduce((s3, m) => s3 + 1 + m.atividades.length, 0), 0), 0) ?? 0;
  const semVerbo = r?.produtos.flatMap((p) => p.entregaveis.flatMap((e) => e.marcos.flatMap((m) => m.atividades.filter((a) => VERBO.test(a.nome) || !/^[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõç]+(r|r-se)\b/.test(a.nome))))) ?? [];

  return (
    <Moldura titulo="5. EAP e Cronograma" st={st} onGerar={() => gerar('eap', { produtos })} podeGerar={!!produtos.length} motivo="Gere e revise os produtos antes."
      descricao={<>Nível 1 é o produto (grupo Produtos). Nível 2 Entregável, Nível 3 Marco e Nível 4 atividade iniciando com verbo, ligados ao produto pela coluna Produto - Cronograma, com datas a partir do início da execução. A IA gera em lotes de 3 produtos.</>}>
      {r && (
        <div className="space-y-3">
          <div className="text-[12.5px] text-muted-foreground">{total} itens no total.</div>
          {semVerbo.length > 0 && <Aviso>Atividades que talvez não comecem com verbo no infinitivo: {semVerbo.slice(0, 6).map((a) => `"${a.nome}"`).join(', ')}{semVerbo.length > 6 ? '…' : ''}</Aviso>}
          {r.produtos.map((p, ip) => {
            const k = produtos.findIndex((x) => x.codigo === p.codigo) + 1;
            const nomeP = produtos.find((x) => x.codigo === p.codigo)?.nome ?? '';
            return (
              <details key={ip} className="rounded-xl border border-border/60" open={ip === 0}>
                <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium flex items-center gap-2"><ChevronRight className="h-3.5 w-3.5" /> {p.codigo} - {nomeP}</summary>
                <div className="px-3 pb-3 space-y-2">
                  {p.entregaveis.map((e, ie) => (
                    <div key={ie} className="rounded-lg bg-muted/40 p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold w-24 shrink-0">{k}.{ie + 1}. ENTREGÁVEL</span>
                        <Campo value={e.nome} onChange={(ev) => set((x) => { x[ip].entregaveis[ie].nome = ev.target.value; })} />
                        <Dias inicio={inicio} a={e.dia_inicio} b={e.dia_fim} onA={(n) => set((x) => { x[ip].entregaveis[ie].dia_inicio = n; })} onB={(n) => set((x) => { x[ip].entregaveis[ie].dia_fim = n; })} />
                        <button onClick={() => set((x) => { x[ip].entregaveis.splice(ie, 1); })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      {e.marcos.map((m, im) => (
                        <div key={im} className="ml-6 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold w-24 shrink-0">{k}.{ie + 1}.{im + 1}. MARCO</span>
                            <Campo value={m.nome} onChange={(ev) => set((x) => { x[ip].entregaveis[ie].marcos[im].nome = ev.target.value; })} />
                            <Dias inicio={inicio} a={m.dia_inicio} b={m.dia_fim} onA={(n) => set((x) => { x[ip].entregaveis[ie].marcos[im].dia_inicio = n; })} onB={(n) => set((x) => { x[ip].entregaveis[ie].marcos[im].dia_fim = n; })} />
                            <button onClick={() => set((x) => { x[ip].entregaveis[ie].marcos.splice(im, 1); })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          {m.atividades.map((a, ia) => (
                            <div key={ia} className="ml-6 flex items-center gap-2">
                              <span className="text-[12px] text-muted-foreground w-24 shrink-0">{k}.{ie + 1}.{im + 1}.{ia + 1}.</span>
                              <Campo value={a.nome} onChange={(ev) => set((x) => { x[ip].entregaveis[ie].marcos[im].atividades[ia].nome = ev.target.value; })} />
                              <Escolha className="w-36" opcoes={ROTULOS.frentes} valor={a.frente} onMudar={(v) => set((x) => { x[ip].entregaveis[ie].marcos[im].atividades[ia].frente = v; })} />
                              <Dias inicio={inicio} a={a.dia_inicio} b={a.dia_fim} onA={(n) => set((x) => { x[ip].entregaveis[ie].marcos[im].atividades[ia].dia_inicio = n; })} onB={(n) => set((x) => { x[ip].entregaveis[ie].marcos[im].atividades[ia].dia_fim = n; })} />
                              <button onClick={() => set((x) => { x[ip].entregaveis[ie].marcos[im].atividades.splice(ia, 1); })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
          <BarraGravar onGravar={gravar} gravando={!!st.gravando} progresso={st.progressoGravacao ?? ''} erro={st.erroGravacao ?? ''} rotulo="Gravar EAP e cronograma no quadro" desabilitado={!run.boardId || !inicio || !prodGravados}
            aviso={<>
              {!prodGravados && <Aviso>Grave os produtos primeiro: cada item do cronograma é ligado ao seu produto.</Aviso>}
              {!inicio && <Aviso>Defina a data de início da execução na aba Quadro para calcular as datas.</Aviso>}
              {st.status === 'gravada' && <Aviso tom="info">Já gravada. Gravar de novo cria os itens outra vez (não substitui).</Aviso>}
            </>} />
        </div>
      )}
    </Moldura>
  );
}
