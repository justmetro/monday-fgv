import { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Search } from 'lucide-react';
import { useVibeQuery } from '@vibe/db/client';
import { Q_ACOES } from '@generated/hooks/useAlocacao';
import { Skeleton } from '@components/ui/skeleton';
import { Spinner } from '@components/ui/spinner';
import { cn } from '@lib/utils';
import { ACAO_LABEL, ACAO_TIPOS, alocAcoes, type AcaoTipo } from '@generated/models';
import { listarAcoes, autoresAcoes } from '@generated/server/acoes';
import { Chip } from '@generated/components/alocacao/bits';
import { Secao, btnNeutro, tabelaCls, theadCls, thCls, trCls } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';

type Pagina = Awaited<ReturnType<typeof listarAcoes>>;
type Acao = Pagina['itens'][number];
const AVISO_VALIDACAO = 'O que foi gravado no 02.01 (Gerente, dropdown e Alocação Gerente) não é desfeito — ajuste no monday se necessário.';
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
const selCls = 'h-11 min-w-0 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2 text-base text-foreground md:h-8 md:text-[13px]';

/** "Registro de ações": every app action of the tab (last 90 days), newest first, with undo. */
export function SubRegistro({ ctx }: { ctx: AlocCtx }) {
  const [autor, setAutor] = useState('');
  const [tipo, setTipo] = useState<AcaoTipo | ''>('');
  const [busca, setBusca] = useState('');
  const [buscaDeb, setBuscaDeb] = useState('');
  const [extra, setExtra] = useState<{ itens: Acao[]; cursor: string | null; usado: boolean }>({ itens: [], cursor: null, usado: false });
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setBuscaDeb(busca.trim()), 300); return () => clearTimeout(t); }, [busca]);
  const filtros = useMemo(() => ({ autor: autor || undefined, tipo: tipo || undefined, busca: buscaDeb || undefined }), [autor, tipo, buscaDeb]);
  useEffect(() => { setExtra({ itens: [], cursor: null, usado: false }); }, [filtros]);

  const q = useVibeQuery([...Q_ACOES, filtros], () => listarAcoes({ data: filtros }), { collections: [alocAcoes.name] });
  const autores = useVibeQuery([...Q_ACOES, 'autores'], () => autoresAcoes({ data: {} }), { collections: [alocAcoes.name] });
  // Keeps the previous rows visible (dimmed) while a filter change refetches.
  const [ultimo, setUltimo] = useState<Pagina | null>(null);
  useEffect(() => { if (q.data) setUltimo(q.data); }, [q.data]);
  const pagina = q.data ?? ultimo;
  const linhas = useMemo(() => {
    const vistos = new Set<string>();
    return [...(pagina?.itens ?? []), ...extra.itens].filter((a) => (vistos.has(a.id) ? false : (vistos.add(a.id), true)));
  }, [pagina, extra.itens]);
  const proximo = extra.usado ? extra.cursor : (pagina?.cursor ?? null);

  const carregarMais = async () => {
    if (!proximo) return;
    setCarregandoMais(true);
    try {
      const r = await listarAcoes({ data: { ...filtros, cursor: proximo } });
      setExtra((e) => ({ itens: [...e.itens, ...(r?.itens ?? [])], cursor: r?.cursor ?? null, usado: true }));
    } catch (e) {
      console.error('Falha ao carregar mais registros', e);
    } finally {
      setCarregandoMais(false);
    }
  };

  const desfazer = async (a: Acao) => {
    const ok = await ctx.perguntar({
      titulo: 'Desfazer ação?',
      texto: `${a.descricao}\n\nTudo o que esta ação alterou no app volta ao estado anterior.${a.tipo === 'validar' ? `\n\nO status volta para Pendente. ${AVISO_VALIDACAO}` : ''}`,
      ok: 'Desfazer',
    });
    if (!ok) return;
    setDesfazendo(a.id);
    const r = await ctx.api.desfazer(a.id);
    setDesfazendo(null);
    if (r.ok) setExtra((e) => ({ ...e, itens: e.itens.map((x) => (x.id === a.id ? { ...x, desfeita: true } : x)) }));
  };

  return (
    <Secao titulo="Registro de ações" aside={<span className="text-xs text-muted-foreground">Últimos 90 dias · mais recentes primeiro</span>}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <label className="sr-only" htmlFor="reg-pessoa">Pessoa</label>
        <select id="reg-pessoa" value={autor} onChange={(e) => setAutor(e.target.value)} className={selCls}>
          <option value="">Todas as pessoas</option>
          {(autores.data ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label className="sr-only" htmlFor="reg-tipo">Tipo de ação</label>
        <select id="reg-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as AcaoTipo | '')} className={selCls}>
          <option value="">Todos os tipos</option>
          {ACAO_TIPOS.map((t) => <option key={t} value={t}>{ACAO_LABEL[t]}</option>)}
        </select>
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto ou gerente…" aria-label="Buscar no registro por projeto ou gerente"
            className={cn(selCls, 'w-full pl-8')} />
        </div>
        {q.isFetching && pagina && <Spinner className="size-3.5 text-muted-foreground" />}
      </div>

      {!pagina && q.isLoading ? (
        <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label="Carregando registro">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full bg-[hsl(var(--surface-2))]" />)}
        </div>
      ) : q.isError && !pagina ? (
        <p role="alert" className="px-4 py-8 text-center text-[13px] text-[hsl(var(--danger))]">Não foi possível carregar o registro de ações.</p>
      ) : !linhas.length ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-muted-foreground">
          <History className="size-5" aria-hidden />
          {filtros.autor || filtros.tipo || filtros.busca ? 'Nenhuma ação encontrada com esses filtros.' : 'Nenhuma ação registrada ainda. As próximas alterações feitas no app aparecem aqui.'}
        </div>
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', q.isFetching && 'opacity-60')}>
          <table className={tabelaCls}>
            <thead className={theadCls}>
              <tr>
                <th scope="col" className={thCls}>Data/hora</th><th scope="col" className={thCls}>Pessoa</th><th scope="col" className={thCls}>Tipo</th>
                <th scope="col" className={thCls}>Descrição</th><th scope="col" className={cn(thCls, 'text-right')}>Itens</th>
                <th scope="col" className={thCls}>Status</th><th scope="col" className={thCls}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((a) => (
                <tr key={a.id} className={cn(trCls, a.desfeita && 'text-muted-foreground')}>
                  <td className="tnum whitespace-nowrap px-3 py-2 text-xs">{dataHora(a.em)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{a.autor}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{ACAO_LABEL[a.tipo] ?? a.tipo}</td>
                  <td className={cn('max-w-[460px] px-3 py-2', !a.desfeita && 'text-foreground', a.desfeita && 'line-through decoration-[hsl(var(--fg-subtle))]')}>{a.descricao}</td>
                  <td className="tnum px-3 py-2 text-right">{a.itens}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {a.desfeita
                      ? <span title={a.desfeitaEm ? `por ${a.desfeitaPor} em ${dataHora(a.desfeitaEm)}` : undefined}><Chip corVar="--farol-gray" className="h-5">Desfeita</Chip></span>
                      : <Chip corVar="--farol-green" className="h-5">Ativa</Chip>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!a.desfeita && a.tipo !== 'desfazer' ? (
                      <button type="button" onClick={() => void desfazer(a)} disabled={desfazendo === a.id} className={btnNeutro} aria-label={`Desfazer: ${a.descricao}`}>
                        {desfazendo === a.id ? <Spinner className="size-3.5" /> : <RotateCcw className="size-3.5" aria-hidden />} Desfazer
                      </button>
                    ) : <span className="text-xs text-[hsl(var(--fg-subtle))]" aria-hidden="true">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {proximo && linhas.length > 0 && (
        <div className="flex justify-center border-t border-border px-4 py-3">
          <button type="button" onClick={() => void carregarMais()} disabled={carregandoMais} className={btnNeutro}>
            {carregandoMais && <Spinner className="size-3.5" />} Carregar mais
          </button>
        </div>
      )}
    </Secao>
  );
}
