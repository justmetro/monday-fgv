import { useEffect, useRef, useState } from 'react';
import { useHub } from '@generated/lib/estado';
import { gravarRiscosIA, limparModelo, type Risco } from '@generated/lib/gravar';
import { CP } from '@generated/lib/quadros';
import { prepararProjetoCalc, rodarCalculadora, enviarAoPlanejamento, riscosDoQuadro, aplicarComplemento, type Complemento, type RiscoNoQuadro } from '@generated/lib/calc';
import { errorMessage } from '@generated/lib/monday';
import { ROTULOS } from '@generated/lib/rotulos';
import { resumoProdutos, type ResultadoProdutos } from '@generated/components/EtapaProdutos';
import type { Analise } from '@generated/components/EtapaAnalise';
import { Moldura, BarraGravar } from '@generated/components/Moldura';
import { Cartao, Campo, Texto, Escolha, Aviso, Botao, Progresso, Selo } from '@generated/components/ui';

export function EtapaRiscos() {
  const { run, etapa, gerar, editar, concluir, userId } = useHub();
  const st = etapa('riscos');
  const stC = etapa('complemento');
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState('');
  const [erro, setErro] = useState('');
  const [calcMsg, setCalcMsg] = useState('');
  const [calcErro, setCalcErro] = useState('');
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcProg, setCalcProg] = useState('');
  const [doQuadro, setDoQuadro] = useState<RiscoNoQuadro[] | null>(null);
  const autoFeito = useRef(false);
  const stCalc = etapa('calculadora');
  const produtos = resumoProdutos(run?.etapas.produtos?.resultado as ResultadoProdutos | undefined);
  const analise = run?.etapas.analise?.resultado as Analise | undefined;
  const r = st.resultado as { riscos: Risco[] } | undefined;
  const comp = stC.resultado as { riscos: Complemento[] } | undefined;
  const inicio = run?.contexto.inicioExecucao ?? null;

  const mudar = (i: number, k: keyof Risco, v: unknown) => r && editar('riscos', { riscos: r.riscos.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  const gravar = async () => {
    if (!r || !run?.boardId) return;
    setBusy(true); setErro('');
    try {
      const n = await gravarRiscosIA(run.boardId, r.riscos, inicio, setProg);
      await concluir('riscos', `${n} riscos específicos criados no grupo Riscos`);
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); setProg(''); }
  };

  /** Calculadora automática: cadastra no 09.1, roda o motor, envia ao [PLAN] e pede à IA o complemento dos riscos. */
  const rodarCalc = async () => {
    if (!run?.boardId || !run.boardUrl || !analise?.calculadora) return;
    const c = { ...analise.calculadora, c8_equipe: analise.calculadora.c8_equipe || 'Até 10 membros na equipe' };
    setCalcBusy(true); setCalcErro(''); setCalcMsg('');
    try {
      setCalcProg('Arquivando os riscos de exemplo do modelo…');
      await limparModelo(run.boardId, CP.grupos.riscos);
      setCalcProg('Cadastrando o projeto no 09.1 com as 8 características…');
      const id = await prepararProjetoCalc(run.nomeItem, run.boardUrl, run.boardId, c, userId);
      const res: any = await rodarCalculadora(id, setCalcProg);
      setCalcProg('Enviando os riscos ao quadro [PLAN]…');
      const env: any = await enviarAoPlanejamento(id, run.nomeItem, run.boardUrl, run.boardId, setCalcProg);
      const resumo = `Calculadora: ${res.nTot} riscos (${res.nEsp} dos grupos de risco e ${res.nTr} transversais); ${env.copied} enviados ao grupo Riscos, ${env.skipped} já estavam lá${env.warnings?.length ? `. Avisos: ${env.warnings.slice(0, 3).join('; ')}` : ''}`;
      setCalcMsg(resumo);
      await concluir('calculadora', resumo);
      const lidos = await riscosDoQuadro(run.boardId);
      setDoQuadro(lidos);
      const alvo = lidos.filter((x) => !x.daIA);
      if (alvo.length) {
        const resumoProj = `${analise.tap.justificativa}\n${analise.tap.resultado_principal}\n${analise.tap.como_chega}`;
        await gerar('complemento', { produtos, resumo: resumoProj, riscosQuadro: alvo.map((x) => ({ id: x.id, nome: x.nome, causa: x.causa, efeito: x.efeito, categoria: x.categoria, estrategia: x.estrategia, resposta: x.resposta })) });
      }
    } catch (e) { setCalcErro(errorMessage(e)); } finally { setCalcBusy(false); setCalcProg(''); }
  };

  // Ao abrir a aba: gera os riscos específicos e roda a calculadora sozinhos, se ainda não rodaram.
  useEffect(() => {
    if (!run || autoFeito.current) return;
    if (!run.boardId || !analise?.calculadora || !produtos.length) return;
    autoFeito.current = true;
    if (st.status === 'nao_iniciada' && run.docs.length) gerar('riscos', { produtos }).catch(() => null);
    if (stCalc.status !== 'gravada') rodarCalc();
    else riscosDoQuadro(run.boardId).then(setDoQuadro).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?._id, run?.boardId, !!analise, produtos.length]);

  if (!run) return null;

  const lerQuadro = async () => {
    if (!run.boardId) return;
    setCalcBusy(true); setCalcErro('');
    try { setDoQuadro(await riscosDoQuadro(run.boardId)); } catch (e) { setCalcErro(errorMessage(e)); } finally { setCalcBusy(false); }
  };

  const alvos = (doQuadro ?? []).filter((x) => !x.daIA);
  const gerarComplemento = () => {
    const resumo = analise ? `${analise.tap.justificativa}\n${analise.tap.resultado_principal}\n${analise.tap.como_chega}` : run.nomeItem;
    return gerar('complemento', { produtos, resumo, riscosQuadro: alvos.map((x) => ({ id: x.id, nome: x.nome, causa: x.causa, efeito: x.efeito, categoria: x.categoria, estrategia: x.estrategia, resposta: x.resposta })) });
  };

  const aplicar = async () => {
    if (!comp || !run.boardId) return;
    setBusy(true); setErro('');
    try {
      const n = await aplicarComplemento(run.boardId, comp.riscos, inicio, setProg);
      await concluir('complemento', `${n} riscos da calculadora completados (período, frente, estratégia e resposta)`);
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); setProg(''); }
  };
  const nomeDe = (id: string) => (doQuadro ?? []).find((x) => x.id === id)?.nome ?? id;

  return (
    <div className="space-y-4">
      <Moldura titulo="6a. Riscos específicos do projeto" st={st} onGerar={() => gerar('riscos', { produtos })} podeGerar={!!run.docs.length && !!produtos.length} motivo="Gere os produtos antes."
        descricao='De 10 a 20 riscos que só existem neste projeto, no formato "Se [causa], então [risco], gerando [efeito]", com período, frente e resposta. Os genéricos vêm da Calculadora (abaixo).'>
        {r && (
          <div className="space-y-2">
            {r.riscos.map((x, i) => (
              <div key={i} className={`rounded-xl border border-border/60 p-3 space-y-2 ${x.incluir === false ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={x.incluir !== false} onChange={(e) => mudar(i, 'incluir', e.target.checked)} />
                  <span className="text-[12px] font-semibold w-16 shrink-0">{x.id}</span>
                  <Campo value={x.titulo} onChange={(e) => mudar(i, 'titulo', e.target.value)} />
                </div>
                <div className="grid grid-cols-6 gap-2">
                  <Escolha className="col-span-2" opcoes={ROTULOS.categoria} valor={x.categoria} onMudar={(v) => mudar(i, 'categoria', v)} />
                  <Escolha opcoes={ROTULOS.probabilidade} valor={x.probabilidade} onMudar={(v) => mudar(i, 'probabilidade', v)} />
                  <Escolha opcoes={ROTULOS.impacto} valor={x.impacto} onMudar={(v) => mudar(i, 'impacto', v)} />
                  <Escolha opcoes={ROTULOS.estrategia} valor={x.estrategia} onMudar={(v) => mudar(i, 'estrategia', v)} />
                  <Escolha opcoes={ROTULOS.frentes} valor={x.frente} onMudar={(v) => mudar(i, 'frente', v)} />
                  <Texto className="col-span-3" rows={3} value={x.causa} onChange={(e) => mudar(i, 'causa', e.target.value)} placeholder="Causa" />
                  <Texto className="col-span-3" rows={3} value={x.efeito} onChange={(e) => mudar(i, 'efeito', e.target.value)} placeholder="Efeito" />
                  <Texto className="col-span-6" rows={3} value={x.resposta} onChange={(e) => mudar(i, 'resposta', e.target.value)} placeholder="Descrição da resposta ao risco" />
                </div>
                <div className="text-[12px] text-muted-foreground flex flex-wrap gap-3">
                  <span>Tema: {x.tema}</span><span>Impactado: {x.impactado.join(', ')}</span><span>Período: dia {x.dia_inicio} a {x.dia_fim}</span><span>Responsável: {x.cargo_responsavel}</span><span>Produtos: {x.produtos.join(', ')}</span>
                </div>
              </div>
            ))}
            <BarraGravar onGravar={gravar} gravando={busy && !comp} progresso={prog} erro={erro} rotulo="Gravar riscos específicos" desabilitado={!run.boardId} />
          </div>
        )}
      </Moldura>

      <Cartao className="p-4 space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">6b. Calculadora de Riscos (automática)</h2>{stCalc.status === 'gravada' && <Selo tom="ok">Rodada</Selo>}</div>
        <p className="text-[13px] text-muted-foreground">Roda sozinha ao abrir esta aba, depois da análise e dos produtos: cadastra o projeto no 09.1 com as 8 características, roda o motor da metodologia (09.2 Base e 09.3 Metodologia), envia os riscos do 09.4 ao grupo Riscos do [PLAN] e pede à IA o complemento (período, frente, estratégia e resposta).</p>
        {stCalc.status === 'gravada' && stCalc.resumoGravacao && !calcMsg && <Aviso tom="ok">{stCalc.resumoGravacao}</Aviso>}
        {(!run.boardId || !analise || !produtos.length) && <Aviso tom="info">A calculadora roda quando houver quadro vinculado, análise gerada e produtos gerados.</Aviso>}
        {analise?.calculadora && (
          <div className="flex flex-wrap gap-1.5">
            {(['c1_fat', 'c2_tipofat', 'c3_vig', 'c4_cli', 'c5_mod', 'c6_prod', 'c8_equipe'] as const).map((k) => <Selo key={k}>{analise.calculadora[k] || `${k}: não definido`}</Selo>)}
            {analise.calculadora.c7_tipo?.map((t) => <Selo key={t} tom="azul">{t}</Selo>)}
          </div>
        )}
        {!analise && <Aviso tom="info">Gere a análise primeiro.</Aviso>}
        {calcErro && <Aviso tom="erro">{calcErro}</Aviso>}
        {calcMsg && <Aviso tom="ok">{calcMsg}</Aviso>}
        <div className="flex items-center gap-2">
          {calcBusy && <Progresso texto={calcProg || 'Lendo…'} />}
          <div className="flex-1" />
          <Botao onClick={lerQuadro} disabled={!run.boardId || calcBusy}>Ler riscos do quadro</Botao>
          <Botao variante={stCalc.status === 'gravada' ? 'secundario' : 'primario'} onClick={rodarCalc} carregando={calcBusy} disabled={!analise || !run.boardId}>{stCalc.status === 'gravada' ? 'Rodar de novo' : 'Rodar agora'}</Botao>
        </div>
      </Cartao>

      <Moldura titulo="6c. Completar os riscos da calculadora" st={stC} onGerar={gerarComplemento} podeGerar={alvos.length > 0} motivo='Rode a calculadora ou clique em "Ler riscos do quadro" para listar os riscos que vieram do Cardápio.'
        descricao={`A IA preenche Período do Risco, Frentes, Estratégia e Descrição da Resposta dos riscos que vieram do Cardápio, para este projeto. ${doQuadro ? `${alvos.length} riscos da calculadora no quadro.` : ''}`}>
        {comp && (
          <div className="space-y-2">
            {comp.riscos.map((x, i) => (
              <div key={x.id} className={`rounded-xl border border-border/60 p-3 space-y-2 ${x.aplicar === false ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={x.aplicar !== false} onChange={(e) => editar('complemento', { riscos: comp.riscos.map((y, j) => (j === i ? { ...y, aplicar: e.target.checked } : y)) })} />
                  <span className="font-medium flex-1">{nomeDe(x.id)}</span>
                  <Escolha opcoes={ROTULOS.estrategia} valor={x.estrategia} onMudar={(v) => editar('complemento', { riscos: comp.riscos.map((y, j) => (j === i ? { ...y, estrategia: v } : y)) })} />
                  <Escolha opcoes={ROTULOS.frentes} valor={x.frente} onMudar={(v) => editar('complemento', { riscos: comp.riscos.map((y, j) => (j === i ? { ...y, frente: v } : y)) })} />
                  <span className="text-[12px] text-muted-foreground">dia {x.dia_inicio} a {x.dia_fim}</span>
                </div>
                <Texto rows={2} value={x.resposta} onChange={(e) => editar('complemento', { riscos: comp.riscos.map((y, j) => (j === i ? { ...y, resposta: e.target.value } : y)) })} />
              </div>
            ))}
            <BarraGravar onGravar={aplicar} gravando={busy && !!comp} progresso={prog} erro={erro} rotulo="Aplicar nos riscos do quadro" desabilitado={!run.boardId} />
          </div>
        )}
      </Moldura>
    </div>
  );
}
