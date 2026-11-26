import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useHub } from '@generated/lib/estado';
import { gravarIndicadores, type Objetivo, type Indicador } from '@generated/lib/gravar';
import { errorMessage } from '@generated/lib/monday';
import { ROTULOS } from '@generated/lib/rotulos';
import { resumoProdutos, type ResultadoProdutos } from '@generated/components/EtapaProdutos';
import { Moldura, BarraGravar } from '@generated/components/Moldura';
import { Campo, Texto, Escolha, Aviso, Selo } from '@generated/components/ui';

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
      <div className="text-[12px] text-muted-foreground">Medições nos dias {(x.medicoes ?? []).join(', ') || '—'} · Produtos: {(x.produtos ?? []).join(', ') || '—'}</div>
    </div>
  );
}

export function EtapaIndicadores() {
  const { run, etapa, gerar, editar, concluir } = useHub();
  const st = etapa('indicadores');
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState('');
  const [erro, setErro] = useState('');
  if (!run) return null;
  const produtos = resumoProdutos(run.etapas.produtos?.resultado as ResultadoProdutos | undefined);
  const r = st.resultado as { objetivos: Objetivo[] } | undefined;
  const inicio = run.contexto.inicioExecucao ?? null;

  const set = (fn: (x: Objetivo[]) => void) => {
    if (!r) return;
    const c: Objetivo[] = JSON.parse(JSON.stringify(r.objetivos));
    fn(c);
    editar('indicadores', { objetivos: c });
  };

  const gravar = async () => {
    if (!r || !run.boardId) return;
    setBusy(true); setErro('');
    try {
      const out = await gravarIndicadores(run.boardId, r.objetivos, inicio, setProg);
      await concluir('indicadores', `${out.indicadores} indicadores (KRs e KPIs) e ${out.medicoes} medições criados`);
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); setProg(''); }
  };

  const nKr = r?.objetivos.reduce((s, o) => s + o.krs.length, 0) ?? 0;
  const nKpi = r?.objetivos.reduce((s, o) => s + o.krs.reduce((s2, k) => s2 + (k.kpis?.length ?? 0), 0), 0) ?? 0;

  return (
    <Moldura titulo="7. Painel de Indicadores (OKRs)" st={st} onGerar={() => gerar('indicadores', { produtos })} podeGerar={!!produtos.length} motivo="Gere os produtos antes."
      descricao="Objetivos qualitativos (até 3), Resultados-Chave mensuráveis (até 5 por objetivo) e KPIs de processo (até 3 por KR), pelo Guia. Grava nos grupos Indicador e Medição do indicador, com KPIs ligados ao KR e medições ligadas ao indicador.">
      {r && (
        <div className="space-y-3">
          <div className="text-[12.5px] text-muted-foreground">{r.objetivos.length} objetivos, {nKr} KRs, {nKpi} KPIs.</div>
          {r.objetivos.map((o, io) => (
            <div key={io} className="rounded-xl border border-border/60 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Selo tom="ok">Objetivo {io + 1}</Selo>
                <Texto rows={2} value={o.objetivo} onChange={(e) => set((x) => { x[io].objetivo = e.target.value; })} />
                <button onClick={() => set((x) => { x.splice(io, 1); })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              {o.krs.map((kr, ik) => (
                <div key={ik} className="space-y-1.5">
                  <LinhaInd x={kr} tipo="KR" onMudar={(k, v) => set((x) => { (x[io].krs[ik] as any)[k] = v; })} onRemover={() => set((x) => { x[io].krs.splice(ik, 1); })} />
                  {kr.kpis?.map((kpi, ip) => (
                    <LinhaInd key={ip} x={kpi} tipo="KPI" onMudar={(k, v) => set((x) => { (x[io].krs[ik].kpis[ip] as any)[k] = v; })} onRemover={() => set((x) => { x[io].krs[ik].kpis.splice(ip, 1); })} />
                  ))}
                </div>
              ))}
            </div>
          ))}
          <BarraGravar onGravar={gravar} gravando={busy} progresso={prog} erro={erro} rotulo="Gravar indicadores no quadro" desabilitado={!run.boardId}
            aviso={!inicio ? <Aviso>Sem data de início, as medições ficam sem prazo. Defina na aba Quadro.</Aviso> : undefined} />
        </div>
      )}
    </Moldura>
  );
}
