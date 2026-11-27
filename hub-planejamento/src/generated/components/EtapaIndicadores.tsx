import { Trash2 } from 'lucide-react';
import { useHub } from '@generated/lib/estado';
import type { Objetivo, Indicador } from '@generated/lib/gravar';
import { ROTULOS } from '@generated/lib/rotulos';
import { resumoProdutos, type ResultadoProdutos } from '@generated/components/EtapaProdutos';
import { PainelQuadro } from '@generated/components/PainelQuadro';
import { Moldura, BarraGravar } from '@generated/components/Moldura';
import { Campo, Texto, Escolha, Aviso, Selo, Numero, BarraLista, ItemRecolhivel, useRecolher } from '@generated/components/ui';

function LinhaInd({ x, tipo, onMudar, onRemover }: { x: Indicador; tipo: 'KR' | 'KPI'; onMudar: (k: keyof Indicador, v: unknown) => void; onRemover: () => void }) {
  return (
    <div className={`rounded-lg p-2 space-y-1.5 ${tipo === 'KR' ? 'bg-muted/50' : 'ml-6 border border-border/60'}`}>
      <div className="flex items-center gap-2">
        <Selo tom={tipo === 'KR' ? 'azul' : 'neutro'}>{tipo}</Selo>
        <Campo value={x.nome} onChange={(e) => onMudar('nome', e.target.value)} />
        <button onClick={onRemover} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <Texto rows={2} value={x.descricao} onChange={(e) => onMudar('descricao', e.target.value)} />
      <div className="grid grid-cols-6 gap-2">
        <Campo className="col-span-6" value={x.formula} onChange={(e) => onMudar('formula', e.target.value)} placeholder="Forma de cálculo" />
        <Campo type="number" value={x.meta} onChange={(e) => onMudar('meta', Number(e.target.value))} />
        <Escolha opcoes={ROTULOS.unidade} valor={x.unidade} onMudar={(v) => onMudar('unidade', v)} />
        <Escolha opcoes={ROTULOS.polaridade} valor={x.polaridade} onMudar={(v) => onMudar('polaridade', v)} />
        <Escolha opcoes={ROTULOS.temporalidade} valor={x.temporalidade} onMudar={(v) => onMudar('temporalidade', v)} />
        <Escolha opcoes={ROTULOS.coleta} valor={x.coleta} onMudar={(v) => onMudar('coleta', v)} />
        <Campo value={(x.medicoes ?? []).join(', ')} onChange={(e) => onMudar('medicoes', e.target.value.split(/[,; ]+/).map(Number).filter((n) => n > 0))} title="Dias das medições" />
      </div>
      <div className="text-[12px] text-muted-foreground">Medições nos dias {(x.medicoes ?? []).join(', ') || '—'} · Produtos: {(x.produtos ?? []).join(', ') || '—'}{x.referencia ? ` · Referência: ${x.referencia}` : ''}</div>
    </div>
  );
}

export function EtapaIndicadores() {
  const { run, etapa, gerar, editar, gravarQuadro } = useHub();
  const st = etapa('indicadores');
  const rcO = useRecolher();
  const rcK = useRecolher();
  if (!run) return null;
  const produtos = resumoProdutos(run.etapas.produtos?.resultado as ResultadoProdutos | undefined);
  const r = st.resultado as { objetivos: Objetivo[]; base?: { indicadores: number; projetos: number; usados: number; em: string } | null } | undefined;
  const inicio = run.contexto.inicioExecucao ?? null;

  const set = (fn: (x: Objetivo[]) => void) => {
    if (!r) return;
    const c: Objetivo[] = JSON.parse(JSON.stringify(r.objetivos));
    fn(c);
    editar('indicadores', { ...r, objetivos: c });
  };

  const gravar = () => { if (r && run.boardId) gravarQuadro('indicadores'); };

  const nKr = r?.objetivos.reduce((s, o) => s + o.krs.length, 0) ?? 0;
  const nKpi = r?.objetivos.reduce((s, o) => s + o.krs.reduce((s2, k) => s2 + (k.kpis?.length ?? 0), 0), 0) ?? 0;

  return (
    <Moldura etapa="indicadores" titulo="7. Painel de Indicadores (OKRs)" st={st} onGerar={() => gerar('indicadores', { produtos })} podeGerar={!!produtos.length} motivo="Gere os produtos antes."
      descricao="Calculadora de indicadores do hub: lê os indicadores dos planejamentos anteriores (grupo Indicador dos quadros [PLAN] ligados no 02.01), prioriza os do mesmo eixo e propõe Objetivos (até 3), Resultados-Chave (até 5 por objetivo) e KPIs de processo (até 3 por KR), pelo Guia. Grava nos grupos Indicador e Medição do indicador, com KPIs ligados ao KR e medições ligadas ao indicador.">
      {r && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Numero rotulo="Objetivos" valor={r.objetivos.length} />
            <Numero rotulo="Resultados-chave" valor={nKr} />
            <Numero rotulo="KPIs" valor={nKpi} />
            {r.base && <Numero rotulo="Base de referência" valor={r.base.indicadores} detalhe={`de ${r.base.projetos} planejamentos, ${r.base.usados} usados`} />}
          </div>
          <BarraLista total={r.objetivos.length} abertos={rcO.qtd} onAbrir={() => { rcO.abrirTodos(r.objetivos.map((_, i) => i)); rcK.abrirTodos(r.objetivos.flatMap((o, io) => o.krs.map((_, ik) => `${io}-${ik}`))); }} onRecolher={() => { rcO.recolherTodos(); rcK.recolherTodos(); }} />
          {r.objetivos.map((o, io) => (
            <ItemRecolhivel key={io} aberto={rcO.aberto(io)} onAlternar={() => rcO.alternar(io)}
              cabecalho={<><Selo tom="ok">Objetivo {io + 1}</Selo><span className="text-[13px] font-medium truncate">{o.objetivo || 'Sem texto'}</span></>}
              resumo={<span className="num text-[12px] text-muted-foreground">{o.krs.length} KR · {o.krs.reduce((s2, k) => s2 + (k.kpis?.length ?? 0), 0)} KPI</span>}>
              <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Texto rows={2} value={o.objetivo} onChange={(e) => set((x) => { x[io].objetivo = e.target.value; })} />
                <button onClick={() => set((x) => { x.splice(io, 1); })} className="text-muted-foreground hover:text-destructive" aria-label="Remover objetivo"><Trash2 className="h-4 w-4" /></button>
              </div>
              {o.krs.map((kr, ik) => (
                <ItemRecolhivel key={ik} aberto={rcK.aberto(`${io}-${ik}`)} onAlternar={() => rcK.alternar(`${io}-${ik}`)} className="bg-muted/30"
                  cabecalho={<><Selo tom="azul">KR {ik + 1}</Selo><span className="text-[13px] truncate">{kr.nome || 'Sem nome'}</span></>}
                  resumo={<><span className="num text-[12px]">{kr.meta} {kr.unidade}</span><span className="num text-[12px] text-muted-foreground">{kr.kpis?.length ?? 0} KPI</span></>}>
                  <div className="space-y-1.5">
                  <LinhaInd x={kr} tipo="KR" onMudar={(k, v) => set((x) => { (x[io].krs[ik] as any)[k] = v; })} onRemover={() => set((x) => { x[io].krs.splice(ik, 1); })} />
                  {kr.kpis?.map((kpi, ip) => (
                    <LinhaInd key={ip} x={kpi} tipo="KPI" onMudar={(k, v) => set((x) => { (x[io].krs[ik].kpis[ip] as any)[k] = v; })} onRemover={() => set((x) => { x[io].krs[ik].kpis.splice(ip, 1); })} />
                  ))}
                  </div>
                </ItemRecolhivel>
              ))}
              </div>
            </ItemRecolhivel>
          ))}
          <BarraGravar onGravar={gravar} gravando={!!st.gravando} progresso={st.progressoGravacao ?? ''} erro={st.erroGravacao ?? ''} rotulo="Gravar indicadores no quadro" desabilitado={!run.boardId}
            aviso={!inicio ? <Aviso>Sem data de início, as medições ficam sem prazo. Defina na aba Quadro.</Aviso> : undefined} />
          <PainelQuadro etapa="indicadores" />
        </div>
      )}
    </Moldura>
  );
}
