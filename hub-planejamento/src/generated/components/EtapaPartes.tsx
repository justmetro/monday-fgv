import { useHub } from '@generated/lib/estado';
import type { Parte, Risco } from '@generated/lib/gravar';
import { ROTULOS } from '@generated/lib/rotulos';
import { PainelQuadro } from '@generated/components/PainelQuadro';
import { Moldura, BarraGravar } from '@generated/components/Moldura';
import { Campo, Texto, Escolha, Selo, Aviso, Numero, BarraLista, ItemRecolhivel, useRecolher, naoAlterna } from '@generated/components/ui';

const CLASSES = ['Contratante e decisão', 'Execução e validação técnica', 'Público beneficiário', 'Controle e conformidade', 'Parceiros e rede', 'Fornecedores críticos'];

export function estrategia(poder: string, interesse: string) {
  if (poder === 'Alto' && interesse === 'Alto') return 'Gerenciar de perto';
  if (poder === 'Alto') return 'Engajar institucionalmente';
  if (interesse === 'Alto') return 'Consultar frequentemente';
  return 'Manter informado';
}

export function EtapaPartes() {
  const { run, etapa, gerar, editar, gravarQuadro } = useHub();
  const st = etapa('partes');
  const rc = useRecolher();
  if (!run) return null;
  const riscos = ((run.etapas.riscos?.resultado as { riscos: Risco[] } | undefined)?.riscos ?? []).filter((x) => x.incluir !== false).map((x) => ({ id: x.id, titulo: x.titulo }));
  const r = st.resultado as { partes: Parte[] } | undefined;
  const mudar = (i: number, k: keyof Parte, v: unknown) => r && editar('partes', { partes: r.partes.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  const gravar = () => { if (r && run.boardId) gravarQuadro('partes'); };

  return (
    <Moldura etapa="partes" titulo="8. Partes Interessadas" st={st} onGerar={() => gerar('partes', { riscos })} podeGerar={!!run.docs.length}
      descricao="Mapeamento institucional (órgãos, secretarias, áreas, conselhos, financiadores, redes, públicos e fornecedores críticos), sem pessoas físicas. Classe, papel, interesse, poder, expectativas e riscos associados; a estratégia é a fórmula do quadro.">
      {!riscos.length && st.status === 'nao_iniciada' && <Aviso tom="info">Dica: gere os riscos específicos antes, para a IA ligar cada parte aos riscos.</Aviso>}
      {r && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Numero rotulo="Partes" valor={r.partes.filter((x) => x.incluir !== false).length} detalhe={`de ${r.partes.length} propostas`} />
            {['Gerenciar de perto', 'Engajar institucionalmente', 'Consultar frequentemente', 'Manter informado'].map((e) => (
              <Numero key={e} rotulo={e} valor={r.partes.filter((x) => x.incluir !== false && estrategia(x.poder, x.interesse) === e).length} />
            ))}
          </div>
          <BarraLista total={r.partes.length} abertos={rc.qtd} onAbrir={() => rc.abrirTodos(r.partes.map((_, i) => i))} onRecolher={rc.recolherTodos} />
          {r.partes.map((x, i) => (
            <ItemRecolhivel key={i} aberto={rc.aberto(i)} onAlternar={() => rc.alternar(i)} inativo={x.incluir === false}
              cabecalho={<><input type="checkbox" {...naoAlterna} checked={x.incluir !== false} onChange={(e) => mudar(i, 'incluir', e.target.checked)} /><span className="text-[13px] font-medium truncate">{x.nome || 'Sem nome'}</span></>}
              resumo={<><Selo>{x.classe}</Selo><Selo tom="azul">{estrategia(x.poder, x.interesse)}</Selo></>}>
              <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Campo value={x.nome} onChange={(e) => mudar(i, 'nome', e.target.value)} />
                <Selo tom="azul">{estrategia(x.poder, x.interesse)}</Selo>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <Escolha className="col-span-2" opcoes={CLASSES} valor={x.classe} onMudar={(v) => mudar(i, 'classe', v)} />
                <Campo className="col-span-2" value={x.area} onChange={(e) => mudar(i, 'area', e.target.value)} placeholder="Área (posição no arranjo)" />
                <Escolha opcoes={ROTULOS.nivel} valor={x.interesse} onMudar={(v) => mudar(i, 'interesse', v)} title="Interesse" />
                <Escolha opcoes={ROTULOS.nivel} valor={x.poder} onMudar={(v) => mudar(i, 'poder', v)} title="Poder/Influência" />
                <Campo className="col-span-3" value={x.cargo_cliente} onChange={(e) => mudar(i, 'cargo_cliente', e.target.value)} placeholder="Cargo de quem representa" />
                <div className="col-span-3 flex flex-wrap gap-1">
                  {ROTULOS.papel.map((p) => {
                    const on = x.papel?.includes(p);
                    return <button key={p} onClick={() => mudar(i, 'papel', on ? x.papel.filter((y) => y !== p) : [...(x.papel ?? []), p])} className={`rounded-full px-2 h-6 text-[12px] ${on ? 'bg-foreground text-background' : 'bg-muted'}`}>{p}</button>;
                  })}
                </div>
                <Texto className="col-span-6" rows={3} value={x.expectativas} onChange={(e) => mudar(i, 'expectativas', e.target.value)} />
                <Texto className="col-span-6" rows={2} value={x.riscos_associados} onChange={(e) => mudar(i, 'riscos_associados', e.target.value)} />
              </div>
              </div>
            </ItemRecolhivel>
          ))}
          <BarraGravar onGravar={gravar} gravando={!!st.gravando} progresso={st.progressoGravacao ?? ''} erro={st.erroGravacao ?? ''} rotulo="Gravar partes interessadas" desabilitado={!run.boardId} />
          <PainelQuadro etapa="partes" />
        </div>
      )}
    </Moldura>
  );
}
