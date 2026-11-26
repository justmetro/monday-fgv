import { Trash2, Plus } from 'lucide-react';
import { useHub } from '@generated/lib/estado';
import { diasDoProduto, type Produto } from '@generated/lib/gravar';
import { ROTULOS } from '@generated/lib/rotulos';
import { diaParaData } from '@generated/lib/quadros';
import { Moldura, BarraGravar } from '@generated/components/Moldura';
import { Campo, Texto, Escolha, Aviso, Botao, moeda, dataBR } from '@generated/components/ui';

export interface ResultadoProdutos { produtos: Produto[]; checagem: { soma_valores: number; valor_global: number | null; diferenca: number | null; diferenca_pct: number | null; fora_da_vigencia: string[]; max_produtos_mes: number; media_produtos_mes: number; observacoes: string[] } }

/** Resumo dos produtos aprovados, usado como entrada das outras etapas. */
export function resumoProdutos(r: ResultadoProdutos | undefined) {
  return (r?.produtos ?? []).map((p, i) => ({ codigo: p.codigo, nome: p.nome, descricao: p.descricao, dia_inicio: p.dia_inicio, dia_fim: p.dia_fim, mes_inicio: p.mes_inicio, mes_fim: p.mes_fim, valor: p.valor, ordem: i + 1 }));
}

export function EtapaProdutos() {
  const { run, etapa, gerar, editar, gravarQuadro } = useHub();
  const st = etapa('produtos');
  if (!run) return null;
  const r = st.resultado as ResultadoProdutos | undefined;
  const inicio = run.contexto.inicioExecucao ?? null;

  const mudar = (i: number, k: keyof Produto, v: unknown) => r && editar('produtos', { ...r, produtos: r.produtos.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const remover = (i: number) => r && editar('produtos', { ...r, produtos: r.produtos.filter((_, j) => j !== i) });
  const adicionar = () => r && editar('produtos', { ...r, produtos: [...r.produtos, { codigo: `P${String(r.produtos.length + 1).padStart(2, '0')}`, nome: '', descricao: '', objetivo: '', mes_inicio: 1, mes_fim: 1, dia_inicio: null, dia_fim: null, valor: 0, fase: 'Fase 1', tipologia: '', tipo_entrega: '', fonte: 'Incluído manualmente' }] });

  const gravar = () => { if (r && run.boardId) gravarQuadro('produtos'); };

  const soma = r?.produtos.reduce((s, p) => s + (Number(p.valor) || 0), 0) ?? 0;

  return (
    <Moldura titulo="4. Cronograma de Produtos" st={st} onGerar={() => gerar('produtos')} podeGerar={!!run.docs.length} motivo="Envie os documentos antes."
      descricao="Uma linha por produto ou parcela, com código, descrição verificável, meses contratuais, valor, fase e tipo de entrega. Grava no grupo Produtos; produtos com o mesmo código são atualizados, não duplicados.">
      {r && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-[12.5px]">
            <span className="rounded-full bg-muted px-2.5 py-1">Soma: {moeda(soma)}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">Valor global: {moeda(r.checagem?.valor_global)}</span>
            {r.checagem?.valor_global != null && <span className={`rounded-full px-2.5 py-1 ${Math.abs(soma - r.checagem.valor_global) > 1 ? 'bg-[hsl(var(--warn)/.14)]' : 'bg-[hsl(var(--ok)/.12)]'}`}>Diferença: {moeda(soma - r.checagem.valor_global)}</span>}
            <span className="rounded-full bg-muted px-2.5 py-1">Pico: {r.checagem?.max_produtos_mes} produtos no mês</span>
          </div>
          {!!r.checagem?.observacoes?.length && (
            <details className="rounded-xl border border-border/60"><summary className="cursor-pointer px-3 py-2 text-[13px] font-medium">Checagem de consistência ({r.checagem.observacoes.length})</summary>
              <ul className="px-5 pb-3 list-disc text-[13px] space-y-1">{r.checagem.observacoes.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </details>
          )}
          <div className="space-y-2">
            {r.produtos.map((p, i) => {
              const d = diasDoProduto(p);
              return (
                <div key={i} className="rounded-xl border border-border/60 p-3 grid grid-cols-12 gap-2">
                  <Campo className="col-span-1" value={p.codigo} onChange={(e) => mudar(i, 'codigo', e.target.value)} />
                  <Campo className="col-span-7" value={p.nome} onChange={(e) => mudar(i, 'nome', e.target.value)} placeholder="Nome do produto" />
                  <Campo className="col-span-2" type="number" value={p.valor} onChange={(e) => mudar(i, 'valor', Number(e.target.value))} />
                  <Escolha className="col-span-1" opcoes={['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4']} valor={p.fase} onMudar={(v) => mudar(i, 'fase', v)} />
                  <button className="col-span-1 justify-self-end text-muted-foreground hover:text-destructive" onClick={() => remover(i)} aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
                  <Texto className="col-span-12" rows={2} value={p.descricao} onChange={(e) => mudar(i, 'descricao', e.target.value)} />
                  <Campo className="col-span-6" value={p.objetivo} onChange={(e) => mudar(i, 'objetivo', e.target.value)} placeholder="Objetivo" />
                  <Escolha className="col-span-3" opcoes={ROTULOS.tipoEntrega} valor={p.tipo_entrega} onMudar={(v) => mudar(i, 'tipo_entrega', v)} vazio="Tipo de entrega" />
                  <div className="col-span-3 flex items-center gap-1 text-[12.5px]">
                    M<Campo className="w-12" type="number" value={p.mes_inicio} onChange={(e) => mudar(i, 'mes_inicio', Number(e.target.value))} />
                    a M<Campo className="w-12" type="number" value={p.mes_fim} onChange={(e) => mudar(i, 'mes_fim', Number(e.target.value))} />
                  </div>
                  <div className="col-span-12 text-[12px] text-muted-foreground">
                    {p.tipologia} · dias {d.ini} a {d.fim}{inicio ? ` (${dataBR(diaParaData(inicio, d.ini))} a ${dataBR(diaParaData(inicio, d.fim))})` : ''} · Fonte: {p.fonte}
                  </div>
                </div>
              );
            })}
            <Botao variante="fantasma" onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar produto</Botao>
          </div>
          <BarraGravar onGravar={gravar} gravando={!!st.gravando} progresso={st.progressoGravacao ?? ''} erro={st.erroGravacao ?? ''} rotulo="Gravar produtos no quadro" desabilitado={!run.boardId}
            aviso={!inicio ? <Aviso>Sem data de início da execução, a coluna Contratual Início - Entrega fica vazia. Defina na aba Quadro.</Aviso> : undefined} />
        </div>
      )}
    </Moldura>
  );
}
