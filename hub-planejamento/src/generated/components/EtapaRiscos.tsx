import { useEffect, useRef, useState } from 'react';
import { useHub } from '@generated/lib/estado';
import type { Risco } from '@generated/lib/gravar';
import { riscosDoQuadro, type Complemento, type RiscoNoQuadro } from '@generated/lib/calc';
import { errorMessage } from '@generated/lib/monday';
import { ROTULOS } from '@generated/lib/rotulos';
import { resumoProdutos, type ResultadoProdutos } from '@generated/components/EtapaProdutos';
import type { Analise } from '@generated/components/EtapaAnalise';
import { PainelQuadro } from '@generated/components/PainelQuadro';
import { Moldura, BarraGravar } from '@generated/components/Moldura';
import { Cartao, Campo, Texto, Escolha, Aviso, Botao, Progresso, Selo, Numero, BarraLista, ItemRecolhivel, useRecolher, naoAlterna } from '@generated/components/ui';

export function EtapaRiscos() {
  const { run, etapa, gerar, editar, gravarQuadro } = useHub();
  const st = etapa('riscos');
  const stC = etapa('complemento');
  const stCalc = etapa('calculadora');
  const [lendo, setLendo] = useState(false);
  const [lerErro, setLerErro] = useState('');
  const [doQuadro, setDoQuadro] = useState<RiscoNoQuadro[] | null>(null);
  const autoFeito = useRef(false);
  const rcR = useRecolher();
  const rcC = useRecolher();
  const produtos = resumoProdutos(run?.etapas.produtos?.resultado as ResultadoProdutos | undefined);
  const analise = run?.etapas.analise?.resultado as Analise | undefined;
  const r = st.resultado as { riscos: Risco[] } | undefined;
  const comp = stC.resultado as { riscos: Complemento[] } | undefined;

  const mudar = (i: number, k: keyof Risco, v: unknown) => r && editar('riscos', { riscos: r.riscos.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  const gravar = () => { if (r && run?.boardId) gravarQuadro('riscos'); };

  /** Calculadora automática no servidor: cadastra no 09.1, roda o motor, envia ao [PLAN] e pede à IA o complemento. */
  const rodarCalc = () => { if (run?.boardId && run.boardUrl && analise?.calculadora) gravarQuadro('calculadora'); };

  const lerQuadro = async () => {
    if (!run?.boardId) return;
    setLendo(true); setLerErro('');
    try { setDoQuadro(await riscosDoQuadro(run.boardId)); } catch (e) { setLerErro(errorMessage(e)); } finally { setLendo(false); }
  };

  // Ao abrir a aba: gera os riscos específicos e roda a calculadora sozinhos, se ainda não rodaram.
  useEffect(() => {
    if (!run || autoFeito.current) return;
    if (!run.boardId || !analise?.calculadora || !produtos.length) return;
    autoFeito.current = true;
    if (st.status === 'nao_iniciada' && run.docs.length) gerar('riscos', { produtos }).catch(() => null);
    // Depois de apagar os riscos da calculadora pelo hub (resumo preenchido), não roda sozinha de novo.
    if (stCalc.status !== 'gravada' && !stCalc.gravando && !stCalc.resumoGravacao) rodarCalc();
    else lerQuadro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?._id, run?.boardId, !!analise, produtos.length]);

  // Quando a calculadora termina, relê os riscos do quadro para a lista do complemento.
  const calcRodando = !!stCalc.gravando;
  const antes = useRef(calcRodando);
  useEffect(() => {
    if (antes.current && !calcRodando) lerQuadro();
    antes.current = calcRodando;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcRodando]);

  if (!run) return null;

  const alvos = (doQuadro ?? []).filter((x) => !x.daIA);
  const gerarComplemento = () => {
    const resumo = analise ? `${analise.tap.justificativa}\n${analise.tap.resultado_principal}\n${analise.tap.como_chega}` : run.nomeItem;
    return gerar('complemento', { produtos, resumo, riscosQuadro: alvos.map((x) => ({ id: x.id, nome: x.nome, causa: x.causa, efeito: x.efeito, categoria: x.categoria, estrategia: x.estrategia, resposta: x.resposta })) });
  };

  const aplicar = () => { if (comp && run.boardId) gravarQuadro('complemento'); };
  const nomeDe = (id: string) => (doQuadro ?? []).find((x) => x.id === id)?.nome ?? id;

  return (
    <div className="space-y-4">
      <Moldura etapa="riscos" titulo="6a. Riscos específicos do projeto" st={st} onGerar={() => gerar('riscos', { produtos })} podeGerar={!!run.docs.length && !!produtos.length} motivo="Gere os produtos antes."
        descricao='De 10 a 20 riscos que só existem neste projeto, no formato "Se [causa], então [risco], gerando [efeito]", com período, frente e resposta. Os genéricos vêm da Calculadora (abaixo).'>
        {r && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Numero rotulo="Riscos" valor={r.riscos.filter((x) => x.incluir !== false).length} detalhe={`de ${r.riscos.length} propostos`} />
              <Numero rotulo="Probabilidade alta" valor={r.riscos.filter((x) => x.incluir !== false && /alto/i.test(x.probabilidade ?? '')).length} tom="aviso" />
              <Numero rotulo="Impacto alto" valor={r.riscos.filter((x) => x.incluir !== false && /alto/i.test(x.impacto ?? '')).length} tom="aviso" />
            </div>
            <BarraLista total={r.riscos.length} abertos={rcR.qtd} onAbrir={() => rcR.abrirTodos(r.riscos.map((_, i) => i))} onRecolher={rcR.recolherTodos} />
            {r.riscos.map((x, i) => (
              <ItemRecolhivel key={i} aberto={rcR.aberto(i)} onAlternar={() => rcR.alternar(i)} inativo={x.incluir === false}
                cabecalho={<><input type="checkbox" {...naoAlterna} checked={x.incluir !== false} onChange={(e) => mudar(i, 'incluir', e.target.checked)} /><span className="num text-[12px] font-semibold text-muted-foreground w-14 shrink-0">{x.id}</span><span className="text-[13px] font-medium truncate">{x.titulo || 'Sem título'}</span></>}
                resumo={<><Selo>{x.categoria}</Selo><Selo tom={/alto/i.test(`${x.probabilidade} ${x.impacto}`) ? 'aviso' : 'neutro'}>P {x.probabilidade} · I {x.impacto}</Selo></>}>
                <div className="space-y-2">
                <Campo value={x.titulo} onChange={(e) => mudar(i, 'titulo', e.target.value)} />
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
              </ItemRecolhivel>
            ))}
            <BarraGravar onGravar={gravar} gravando={!!st.gravando} progresso={st.progressoGravacao ?? ''} erro={st.erroGravacao ?? ''} rotulo="Gravar riscos específicos" desabilitado={!run.boardId} />
          <PainelQuadro etapa="riscos" />
          </div>
        )}
      </Moldura>

      <Cartao className="p-4 space-y-3 entra">
        <div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">6b. Calculadora de Riscos (automática)</h2>{stCalc.status === 'gravada' && <Selo tom="ok">Rodada</Selo>}</div>
        <p className="text-[13px] text-muted-foreground">Roda sozinha ao abrir esta aba, depois da análise e dos produtos: cadastra o projeto no 09.1 com as 8 características, roda o motor da metodologia (09.2 Base e 09.3 Metodologia), envia os riscos do 09.4 ao grupo Riscos do [PLAN] e pede à IA o complemento (período, frente, estratégia e resposta).</p>
        {stCalc.status === 'gravada' && stCalc.resumoGravacao && !stCalc.gravando && <Aviso tom="ok">{stCalc.resumoGravacao}</Aviso>}
        {(!run.boardId || !analise || !produtos.length) && <Aviso tom="info">A calculadora roda quando houver quadro vinculado, análise gerada e produtos gerados.</Aviso>}
        {analise?.calculadora && (
          <div className="flex flex-wrap gap-1.5">
            {(['c1_fat', 'c2_tipofat', 'c3_vig', 'c4_cli', 'c5_mod', 'c6_prod', 'c8_equipe'] as const).map((k) => <Selo key={k}>{analise.calculadora[k] || `${k}: não definido`}</Selo>)}
            {analise.calculadora.c7_tipo?.map((t) => <Selo key={t} tom="azul">{t}</Selo>)}
          </div>
        )}
        {!analise && <Aviso tom="info">Gere a análise primeiro.</Aviso>}
        {stCalc.erroGravacao && <Aviso tom="erro">{stCalc.erroGravacao}</Aviso>}
        {lerErro && <Aviso tom="erro">{lerErro}</Aviso>}
        <div className="flex items-center gap-2">
          {(calcRodando || lendo) && <Progresso texto={calcRodando ? stCalc.progressoGravacao || 'Rodando a calculadora…' : 'Lendo os riscos do quadro…'} />}
          <div className="flex-1" />
          <Botao onClick={lerQuadro} disabled={!run.boardId || calcRodando || lendo}>Ler riscos do quadro</Botao>
          <Botao variante={stCalc.status === 'gravada' ? 'secundario' : 'primario'} onClick={rodarCalc} carregando={calcRodando} disabled={!analise || !run.boardId}>{stCalc.status === 'gravada' ? 'Rodar de novo' : 'Rodar agora'}</Botao>
        </div>
        <PainelQuadro etapa="calculadora" comparar={false} />
      </Cartao>

      <Moldura etapa="complemento" titulo="6c. Completar os riscos da calculadora" st={stC} onGerar={gerarComplemento} podeGerar={alvos.length > 0} motivo='Rode a calculadora ou clique em "Ler riscos do quadro" para listar os riscos que vieram do Cardápio.'
        descricao={`A IA preenche Período do Risco, Frentes, Estratégia e Descrição da Resposta dos riscos que vieram do Cardápio, para este projeto. ${doQuadro ? `${alvos.length} riscos da calculadora no quadro.` : ''}`}>
        {comp && (
          <div className="space-y-2">
            <BarraLista total={comp.riscos.length} abertos={rcC.qtd} onAbrir={() => rcC.abrirTodos(comp.riscos.map((x) => x.id))} onRecolher={rcC.recolherTodos} />
            {comp.riscos.map((x, i) => {
              const muda = (k: keyof Complemento, v: unknown) => editar('complemento', { riscos: comp.riscos.map((y, j) => (j === i ? { ...y, [k]: v } : y)) });
              return (
              <ItemRecolhivel key={x.id} aberto={rcC.aberto(x.id)} onAlternar={() => rcC.alternar(x.id)} inativo={x.aplicar === false}
                cabecalho={<><input type="checkbox" {...naoAlterna} checked={x.aplicar !== false} onChange={(e) => muda('aplicar', e.target.checked)} /><span className="text-[13px] font-medium truncate">{nomeDe(x.id)}</span></>}
                resumo={<><Selo>{x.estrategia}</Selo><Selo>{x.frente}</Selo><span className="num text-[12px] text-muted-foreground">d{x.dia_inicio}–{x.dia_fim}</span></>}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[13px]">
                    <Escolha opcoes={ROTULOS.estrategia} valor={x.estrategia} onMudar={(v) => muda('estrategia', v)} />
                    <Escolha opcoes={ROTULOS.frentes} valor={x.frente} onMudar={(v) => muda('frente', v)} />
                    <span className="text-[12px] text-muted-foreground">dia {x.dia_inicio} a {x.dia_fim}</span>
                  </div>
                  <Texto rows={2} value={x.resposta} onChange={(e) => muda('resposta', e.target.value)} />
                </div>
              </ItemRecolhivel>
              );
            })}
            <BarraGravar onGravar={aplicar} gravando={!!stC.gravando} progresso={stC.progressoGravacao ?? ''} erro={stC.erroGravacao ?? ''} rotulo="Aplicar nos riscos do quadro" desabilitado={!run.boardId} />
          </div>
        )}
      </Moldura>
    </div>
  );
}
