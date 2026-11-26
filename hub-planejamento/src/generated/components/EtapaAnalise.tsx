import { useState } from 'react';
import { useHub } from '@generated/lib/estado';
import { gravarTap } from '@generated/server/hub';
import { errorMessage } from '@generated/lib/monday';
import { ROTULOS } from '@generated/lib/rotulos';
import { Moldura, BarraGravar, SeloStatus } from '@generated/components/Moldura';
import { Cartao, Texto, Campo, Escolha, Rotulo, Aviso, Botao, Selo, moeda } from '@generated/components/ui';
import type { DadosTap } from '@generated/server/tap';
import type { Caracteristicas } from '@generated/lib/calc';

export interface Analise {
  ficha: Record<string, any>;
  tap: DadosTap;
  calculadora: Caracteristicas;
  pendencias: { instrumento: string; pendencia: string; fontes: string; pergunta: string }[];
}

const linhas = (xs: string[] | undefined) => (xs ?? []).join('\n');
const deLinhas = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export function EtapaAnalise() {
  const { run, etapa, gerar, editar, atualizar, recarregar } = useHub();
  const st = etapa('analise');
  const stTap = etapa('tap');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  if (!run) return null;
  const a = st.resultado as Analise | undefined;
  const sem = !run.docs.length;

  const mudarTap = (k: keyof DadosTap, v: unknown) => a && editar('analise', { ...a, tap: { ...a.tap, [k]: v } });
  const mudarCalc = (k: keyof Caracteristicas, v: unknown) => a && editar('analise', { ...a, calculadora: { ...a.calculadora, [k]: v } });

  const escreverTap = async () => {
    if (!a || !run.boardId) return;
    setBusy(true); setErro('');
    try {
      await gravarTap({ data: { runId: run._id, boardId: run.boardId, tap: a.tap } });
      await recarregar();
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(false); }
  };

  const vigDias = a?.ficha?.vigencia_dias as number | null | undefined;

  return (
    <div className="space-y-4">
      <Moldura titulo="3. Análise dos documentos e TAP" st={st} onGerar={() => gerar('analise')} podeGerar={!sem} motivo="Envie os documentos antes."
        descricao="Ficha do projeto, Termo de Abertura (com o modelo de responsabilidades conforme o tipo: padrão, CNCA ou GA), características para a Calculadora de Riscos e pendências para validar com Negócios ou com o cliente.">
        {a && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
              {[
                ['Cliente', a.ficha.cliente], ['Instrumento', a.ficha.instrumento], ['Vigência', a.ficha.vigencia], ['Valor global', moeda(a.ficha.valor_global)],
                ['Eixo', `${a.ficha.eixo}`], ['Modalidade', a.ficha.modalidade], ['Assinatura', a.ficha.data_assinatura], ['Tipologias', (a.ficha.tipologias ?? []).join('; ')],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-muted/60 p-2.5"><Rotulo>{k}</Rotulo><div className="leading-snug">{v || '—'}</div></div>
              ))}
            </div>
            {a.ficha.eixo_justificativa && <div className="text-[12.5px] text-muted-foreground">Eixo: {a.ficha.eixo_justificativa}</div>}
            {vigDias && vigDias !== run.contexto.diasVigencia && (
              <Aviso tom="info">
                A vigência encontrada é de {vigDias} dias. <button className="underline" onClick={() => atualizar({ diasVigencia: vigDias })}>Usar como vigência de referência</button>
              </Aviso>
            )}
            {!!a.pendencias?.length && (
              <details className="rounded-xl border border-border/60" open>
                <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium">Pendências e divergências ({a.pendencias.length})</summary>
                <div className="divide-y divide-border/60">
                  {a.pendencias.map((p, i) => (
                    <div key={i} className="px-3 py-2 text-[13px] grid grid-cols-[110px_1fr] gap-2">
                      <Selo>{p.instrumento}</Selo>
                      <div><div>{p.pendencia}</div><div className="text-muted-foreground text-[12px] mt-0.5">Fonte: {p.fontes} · Perguntar: {p.pergunta}</div></div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Moldura>

      {a && (
        <Cartao className="p-4 space-y-3">
          <div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">Termo de Abertura (doc "0. TAP" do quadro)</h2><SeloStatus st={stTap} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3"><Rotulo>Nome do projeto</Rotulo><Campo value={a.tap.nome_projeto} onChange={(e) => mudarTap('nome_projeto', e.target.value)} /></div>
            <div><Rotulo>Data de início do contrato</Rotulo><Campo value={a.tap.data_inicio_contrato} onChange={(e) => mudarTap('data_inicio_contrato', e.target.value)} /></div>
            <div><Rotulo>Vigência contratual</Rotulo><Campo value={a.tap.vigencia_contratual} onChange={(e) => mudarTap('vigencia_contratual', e.target.value)} /></div>
            <div><Rotulo>Valor total (número)</Rotulo><Campo type="number" value={a.tap.valor_total ?? ''} onChange={(e) => mudarTap('valor_total', e.target.value === '' ? null : Number(e.target.value))} /></div>
            <div><Rotulo>Natureza do cliente</Rotulo><Escolha opcoes={ROTULOS.natureza} valor={a.tap.natureza_cliente} onMudar={(v) => mudarTap('natureza_cliente', v)} className="w-full" /></div>
            <div><Rotulo>Modalidade</Rotulo><Escolha opcoes={ROTULOS.modalidade} valor={a.tap.modalidade} onMudar={(v) => mudarTap('modalidade', v)} className="w-full" /></div>
            <div><Rotulo>Modelo de responsabilidades</Rotulo><Escolha opcoes={['padrao', 'cnca', 'ga']} valor={a.tap.modelo_tap} onMudar={(v) => mudarTap('modelo_tap', v)} className="w-full" /></div>
            <div className="col-span-3"><Rotulo>Experiência institucional</Rotulo><Texto rows={2} value={a.tap.experiencia_institucional} onChange={(e) => mudarTap('experiencia_institucional', e.target.value)} /></div>
            <div className="col-span-3"><Rotulo>1. Justificativa</Rotulo><Texto rows={6} value={a.tap.justificativa} onChange={(e) => mudarTap('justificativa', e.target.value)} /></div>
            <div className="col-span-3"><Rotulo>2. Resultado esperado</Rotulo><Texto rows={3} value={a.tap.resultado_principal} onChange={(e) => mudarTap('resultado_principal', e.target.value)} /></div>
            <div className="col-span-3"><Rotulo>Como o projeto chega ao resultado</Rotulo><Texto rows={3} value={a.tap.como_chega} onChange={(e) => mudarTap('como_chega', e.target.value)} /></div>
            <div className="col-span-3"><Rotulo>Resultados quantitativos (um por linha)</Rotulo><Texto rows={4} value={linhas(a.tap.resultados_quantitativos)} onChange={(e) => mudarTap('resultados_quantitativos', deLinhas(e.target.value))} /></div>
            <div><Rotulo>3.1 Total de produtos</Rotulo><Campo type="number" value={a.tap.total_produtos} onChange={(e) => mudarTap('total_produtos', Number(e.target.value))} /></div>
            <div className="col-span-2"><Rotulo>3.2 Tipos de entrega (um por linha)</Rotulo><Texto rows={2} value={linhas(a.tap.tipos_entrega)} onChange={(e) => mudarTap('tipos_entrega', deLinhas(e.target.value))} /></div>
            <div className="col-span-3"><Rotulo>4. Processo de entrega de produtos (um por linha)</Rotulo><Texto rows={5} value={linhas(a.tap.processo_entrega)} onChange={(e) => mudarTap('processo_entrega', deLinhas(e.target.value))} /></div>
            <div className="col-span-3"><Rotulo>5. Perfis da equipe indicados</Rotulo><Texto rows={2} value={a.tap.perfis_equipe} onChange={(e) => mudarTap('perfis_equipe', e.target.value)} /></div>
            <div className="col-span-3"><Rotulo>7. Fora do escopo (um por linha)</Rotulo><Texto rows={5} value={linhas(a.tap.fora_escopo)} onChange={(e) => mudarTap('fora_escopo', deLinhas(e.target.value))} /></div>
            <div className="col-span-3"><Rotulo>8. Necessidades e funcionalidades (um por linha, em ordem de prioridade)</Rotulo><Texto rows={5} value={linhas(a.tap.necessidades)} onChange={(e) => mudarTap('necessidades', deLinhas(e.target.value))} /></div>
          </div>
          {stTap.status === 'gerando' && <Aviso tom="info">{stTap.progresso || 'Gravando o TAP…'}</Aviso>}
          {stTap.status === 'erro' && <Aviso tom="erro">{stTap.erro}</Aviso>}
          {stTap.status === 'gravada' && <Aviso tom="ok">{stTap.resumoGravacao}</Aviso>}
          <BarraGravar onGravar={escreverTap} gravando={busy || stTap.status === 'gerando'} progresso={stTap.progresso ?? ''} erro={erro} rotulo={stTap.status === 'gravada' ? 'Gravar o TAP de novo' : 'Gravar o TAP no quadro'}
            desabilitado={!run.boardId}
            aviso={<Aviso tom="info">O hub preenche os campos do modelo no doc "0. TAP". Se o doc já foi preenchido, os campos do modelo não existem mais e nada é sobrescrito. Ponto de atenção: a gravação do doc sai pelo usuário que autorizou o app.</Aviso>} />
        </Cartao>
      )}

      {a && (
        <Cartao className="p-4 space-y-3">
          <h2 className="text-[15px] font-semibold">Características para a Calculadora de Riscos</h2>
          <p className="text-[13px] text-muted-foreground">Usadas na aba Riscos para cadastrar o projeto no 09.1 e rodar a calculadora v3. Revise aqui.</p>
          <div className="grid grid-cols-2 gap-3">
            {(['c1_fat', 'c2_tipofat', 'c3_vig', 'c4_cli', 'c5_mod', 'c6_prod', 'c8_equipe'] as const).map((k) => (
              <div key={k}>
                <Rotulo>{{ c1_fat: '1. Faturamento ao ano', c2_tipofat: '2. Tipo de faturamento', c3_vig: '3. Vigência', c4_cli: '4. Parceiro', c5_mod: '5. Modalidade', c6_prod: '6. Produtos ao mês', c8_equipe: '8. Equipe' }[k]}</Rotulo>
                <Escolha className="w-full" opcoes={ROTULOS.calc[k]} valor={a.calculadora[k] as string} vazio={k === 'c8_equipe' ? 'Escolha (não identificado nos documentos)' : undefined} onMudar={(v) => mudarCalc(k, v || null)} />
                {a.calculadora.justificativas?.[k] && <div className="text-[12px] text-muted-foreground mt-1">{a.calculadora.justificativas[k]}</div>}
              </div>
            ))}
            <div>
              <Rotulo>7. Tipologia de entrega</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {ROTULOS.calc.c7_tipo.map((t) => {
                  const on = a.calculadora.c7_tipo?.includes(t);
                  return <button key={t} onClick={() => mudarCalc('c7_tipo', on ? a.calculadora.c7_tipo.filter((x) => x !== t) : [...(a.calculadora.c7_tipo ?? []), t])}
                    className={`rounded-full px-2.5 h-7 text-[12.5px] ${on ? 'bg-foreground text-background' : 'bg-muted'}`}>{t}</button>;
                })}
              </div>
              {a.calculadora.justificativas?.c7_tipo && <div className="text-[12px] text-muted-foreground mt-1">{a.calculadora.justificativas.c7_tipo}</div>}
            </div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!a.calculadora.c8_gr85} onChange={(e) => mudarCalc('c8_gr85', e.target.checked)} /> 8.5 Outros vínculos (RPA, temporários) superam os efetivos</label>
          </div>
          {!a.calculadora.c8_equipe && <Aviso>A faixa de equipe não está nos documentos. Escolha uma antes de rodar a calculadora.</Aviso>}
          <div className="flex justify-end"><Botao onClick={() => editar('analise', a)}>Salvar características</Botao></div>
        </Cartao>
      )}
    </div>
  );
}
