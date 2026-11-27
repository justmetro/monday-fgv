// Comparação da prévia com o quadro (novos, alterados, ausentes e iguais) e remoção do que o hub gravou.
import { useEffect, useMemo, useState } from 'react';
import { GitCompare, Trash2, Archive, ChevronDown } from 'lucide-react';
import { useHub } from '@generated/lib/estado';
import { compararComQuadro, aplicarComparacao, previaApagar, apagarDoQuadro } from '@generated/server/comparar';
import type { Comparacao, ItemDiff, Situacao, ItemApagar } from '@generated/server/comparar';
import { errorMessage } from '@generated/lib/monday';
import { Botao, Selo, Aviso, Campo, cx } from '@generated/components/ui';

type EtapaComp = 'produtos' | 'eap' | 'riscos' | 'indicadores' | 'partes';
type EtapaApagar = EtapaComp | 'calculadora';

const ROTULO: Record<Situacao, string> = { novo: 'Novos', alterado: 'Alterados', ausente: 'Só no quadro', igual: 'Iguais' };
const AJUDA: Record<Situacao, string> = {
  novo: 'Estão na prévia e não no quadro. Marque os que quer adicionar.',
  alterado: 'Existem nos dois, com campos diferentes. Marque os que quer atualizar com a prévia; os desmarcados ficam como estão no quadro.',
  ausente: 'Estão no quadro e não vieram nesta prévia. Marque os que quer arquivar.',
  igual: 'Iguais no quadro e na prévia. Nada a fazer.',
};
const ORDEM: Situacao[] = ['novo', 'alterado', 'ausente', 'igual'];

export function PainelQuadro({ etapa, comparar = true }: { etapa: EtapaApagar; comparar?: boolean }) {
  const { run, etapa: est, recarregar } = useHub();
  const st = est(etapa);
  const [comp, setComp] = useState<Comparacao | null>(null);
  const [filtro, setFiltro] = useState<Situacao>('novo');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [erro, setErro] = useState('');
  const [apagar, setApagar] = useState<ItemApagar[] | null>(null);
  const [verLista, setVerLista] = useState(false);
  const [confirmar, setConfirmar] = useState('');
  const [modoExcluir, setModoExcluir] = useState(false);

  // Comparação salva no servidor volta ao reabrir a aba; some depois de aplicar.
  useEffect(() => { setComp((st.comparacao as Comparacao | null) ?? null); }, [st.comparacao]);
  useEffect(() => {
    if (!comp) return;
    setMarcados(new Set(comp.itens.filter((i) => i.situacao === 'novo').map((i) => i.chave)));
    setFiltro((ORDEM.find((s) => comp.total[s] > 0) ?? 'novo'));
  }, [comp?.em]);

  const lista = useMemo(() => (comp?.itens ?? []).filter((i) => i.situacao === filtro), [comp, filtro]);
  if (!run?.boardId) return null;
  const gravando = !!st.gravando;
  const temPrevia = st.resultado != null;

  const fazerComparacao = async () => {
    setBusy('comparar'); setErro(''); setApagar(null);
    try { setComp((await compararComQuadro({ data: { runId: run._id, etapa: etapa as EtapaComp } })) as Comparacao); await recarregar(); }
    catch (e) { setErro(errorMessage(e)); } finally { setBusy(''); }
  };
  const marcar = (i: ItemDiff) => setMarcados((m) => { const n = new Set(m); if (n.has(i.chave)) n.delete(i.chave); else n.add(i.chave); return n; });
  const marcarTodos = (v: boolean) => setMarcados((m) => { const n = new Set(m); for (const i of lista) if (v) n.add(i.chave); else n.delete(i.chave); return n; });
  const escolhidos = (s: Situacao) => (comp?.itens ?? []).filter((i) => i.situacao === s && marcados.has(i.chave)).map((i) => i.chave);
  const nAdd = escolhidos('novo').length, nUpd = escolhidos('alterado').length, nArq = escolhidos('ausente').length;

  const aplicar = async () => {
    setBusy('aplicar'); setErro('');
    try {
      await aplicarComparacao({ data: { runId: run._id, etapa: etapa as EtapaComp, adicionar: escolhidos('novo'), atualizar: escolhidos('alterado'), arquivar: escolhidos('ausente') } });
      setComp(null);
      await recarregar();
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(''); }
  };

  const abrirApagar = async () => {
    setBusy('listar'); setErro(''); setComp(null); setModoExcluir(false); setConfirmar('');
    try { setApagar((await previaApagar({ data: { runId: run._id, etapa } })) as ItemApagar[]); }
    catch (e) { setErro(errorMessage(e)); } finally { setBusy(''); }
  };
  const executarApagar = async (modo: 'arquivar' | 'excluir') => {
    if (!apagar?.length) return;
    setBusy(modo); setErro('');
    try {
      await apagarDoQuadro({ data: { runId: run._id, etapa, ids: apagar.map((x) => x.id), modo, confirmacao: modo === 'excluir' ? confirmar.trim().toUpperCase() : undefined } });
      setApagar(null); setConfirmar(''); setModoExcluir(false);
      await recarregar();
    } catch (e) { setErro(errorMessage(e)); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[13px] font-medium flex-1">O que já está no quadro</div>
        {comparar && temPrevia && (
          <Botao onClick={fazerComparacao} carregando={busy === 'comparar'} disabled={gravando}><GitCompare className="h-3.5 w-3.5" /> Comparar com o quadro</Botao>
        )}
        <Botao variante="fantasma" onClick={abrirApagar} carregando={busy === 'listar'} disabled={gravando}><Trash2 className="h-3.5 w-3.5" /> Apagar do quadro</Botao>
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {!gravando && st.status !== 'gravada' && st.resumoGravacao && <Aviso tom="info">{st.resumoGravacao}</Aviso>}

      {comp && (
        <div className="space-y-2">
          <div className="text-[12px] text-muted-foreground">Comparado em {new Date(comp.em).toLocaleString('pt-BR')}</div>
          {comp.avisos.map((a, i) => <Aviso key={i} tom="info">{a}</Aviso>)}
          <div className="flex flex-wrap gap-1">
            {ORDEM.map((s) => (
              <button key={s} onClick={() => setFiltro(s)}
                className={cx('inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-[12.5px] transition', filtro === s ? 'bg-foreground text-background font-medium' : 'bg-muted hover:bg-secondary')}>
                {ROTULO[s]} <span className="num">{comp.total[s]}</span>
              </button>
            ))}
          </div>
          <div className="text-[12.5px] text-muted-foreground">{AJUDA[filtro]}</div>
          {filtro !== 'igual' && lista.length > 0 && (
            <div className="flex gap-2 text-[12px]">
              <button className="underline text-muted-foreground hover:text-foreground" onClick={() => marcarTodos(true)}>Marcar todos</button>
              <button className="underline text-muted-foreground hover:text-foreground" onClick={() => marcarTodos(false)}>Desmarcar todos</button>
            </div>
          )}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/60">
            {!lista.length && <div className="p-3 text-[13px] text-muted-foreground">Nenhum item.</div>}
            {lista.map((i) => (
              <label key={i.chave} className={cx('flex items-start gap-2 px-3 py-2 text-[13px]', filtro !== 'igual' && 'cursor-pointer hover:bg-muted/50')}>
                {filtro !== 'igual' && <input type="checkbox" className="mt-1" checked={marcados.has(i.chave)} onChange={() => marcar(i)} />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {i.nivel && <Selo>{i.nivel}</Selo>}
                    {i.contexto && <span className="text-[11.5px] text-muted-foreground truncate max-w-[260px]">{i.contexto}</span>}
                    {i.situacao === 'ausente' && (i.doHub ? <Selo tom="azul">Gravado pelo hub</Selo> : <Selo tom="aviso">Não gravado por esta execução</Selo>)}
                  </div>
                  <div className="mt-0.5">{i.titulo}</div>
                  {!!i.campos?.length && (
                    <ul className="mt-1 space-y-0.5 text-[12px]">
                      {i.campos.map((c, k) => (
                        <li key={k}><span className="font-medium">{c.campo}:</span> <span className="text-muted-foreground line-through">{c.quadro.slice(0, 160)}</span> <span>→ {c.previa.slice(0, 160)}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[12.5px] text-muted-foreground flex-1">Adicionar {nAdd} · atualizar {nUpd} · arquivar {nArq}</div>
            <Botao variante="fantasma" onClick={() => setComp(null)}>Fechar</Botao>
            <Botao variante="primario" onClick={aplicar} carregando={busy === 'aplicar'} disabled={!(nAdd + nUpd + nArq) || gravando}>Aplicar no quadro</Botao>
          </div>
        </div>
      )}

      {apagar && (
        <div className="space-y-2">
          {!apagar.length && <Aviso tom="info">Não achei itens desta etapa gravados pelo hub no quadro.</Aviso>}
          {apagar.length > 0 && (
            <>
              <Aviso>
                {apagar.length} itens desta etapa serão retirados do quadro. Só entram os que o hub gravou ou que batem com a prévia desta execução.
                {etapa === 'eap' && ' As atividades (subitens) saem junto com o seu marco.'}
                {etapa === 'indicadores' && ' As medições dos indicadores entram na lista.'}
                {' '}Arquivados podem ser restaurados pelo arquivo do quadro na monday. Excluídos de vez não voltam.
              </Aviso>
              <button className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => setVerLista((v) => !v)}>
                <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', verLista && 'rotate-180')} /> {verLista ? 'Esconder a lista' : 'Ver a lista'}
              </button>
              {verLista && (
                <div className="max-h-[260px] overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                  {apagar.map((x) => <div key={x.id} className="px-3 py-1.5 text-[12.5px] flex gap-2"><span className="text-muted-foreground w-28 shrink-0 truncate">{x.grupo}</span><span className="truncate">{x.nome}</span></div>)}
                </div>
              )}
              {modoExcluir && (
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px]">Para excluir de vez, digite EXCLUIR:</span>
                  <Campo className="w-36" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="EXCLUIR" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1" />
                <Botao variante="fantasma" onClick={() => { setApagar(null); setModoExcluir(false); setConfirmar(''); }}>Cancelar</Botao>
                {!modoExcluir && <Botao variante="fantasma" onClick={() => setModoExcluir(true)} disabled={gravando}>Excluir de vez…</Botao>}
                {modoExcluir && <Botao variante="perigo" onClick={() => executarApagar('excluir')} carregando={busy === 'excluir'} disabled={confirmar.trim().toUpperCase() !== 'EXCLUIR' || gravando}>Excluir {apagar.length} de vez</Botao>}
                {!modoExcluir && <Botao variante="primario" onClick={() => executarApagar('arquivar')} carregando={busy === 'arquivar'} disabled={gravando}><Archive className="h-3.5 w-3.5" /> Arquivar {apagar.length}</Botao>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
