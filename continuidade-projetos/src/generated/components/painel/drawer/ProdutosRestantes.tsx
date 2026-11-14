import { useState } from 'react';
import { ChevronRight, PackageCheck, Pencil, Undo2 } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';
import { Chip, type Tone } from '@generated/components/painel/Chips';
import { DateField, NumberField, Section, SelectField } from '@generated/components/painel/Fields';
import { LinkBotao } from '@generated/components/painel/LinkBotao';
import {
  ValidarProdutosDialog, fmtCampo, ROTULO, type AlteracaoProduto, type CampoEd, type ValorEd,
} from '@generated/components/painel/drawer/ValidarProdutosDialog';
import {
  BOARD_B_ID, dataEntrega, fmtBRL, fmtBRL2, fmtDate, itemUrl, produtoAtivo, todayIso, type ProdutoView,
} from '@generated/lib/painel';
import { valorIgual } from '@generated/lib/logCampos';
import { cn } from '@lib/utils';
import type { PainelData } from '@generated/hooks/usePainelData';

// Somente rótulos que existem na coluna Status do Produto.
const STATUS_PRODUTO = ['Não Iniciado', 'Entrega Final', 'Não Há', 'Concluído'];
const STATUS_ENTREGA = ['Concluído', 'Entrega Final'];
type Rascunho = Partial<Record<CampoEd, ValorEd>>;

function atrasoTone(a: string | null): Tone {
  if (a === 'Atrasado' || a === 'Entregue com atraso' || a === 'Atrasado e ainda não entregue') return 'danger';
  if (a === 'No Prazo' || a === 'Entregue no prazo') return 'success';
  return 'neutral';
}

/** Situação (fórmula "Status Atraso Entrega", somente leitura). Produto com entrega real nunca aparece como atrasado em aberto. */
function situacaoDe(x: ProdutoView): string | null {
  if (x.entregaReal) return x.situacao ?? (x.atraso === 'Atrasado' ? 'Entregue com atraso' : 'Entregue no prazo');
  return x.atraso;
}

/** Ação "Marcar como entregue": data de entrega real (padrão hoje) + status Concluído/Entrega Final. */
function EntregaRow({ x, onCancel, onApply }: { x: ProdutoView; onCancel: () => void; onApply: (data: string, status: string) => void }) {
  const [data, setData] = useState<string | null>(todayIso());
  const [status, setStatus] = useState<string | null>(STATUS_ENTREGA.includes(x.status ?? '') ? x.status : 'Concluído');
  return (
    <tr className="border-t border-border bg-[hsl(var(--chrome))] align-top">
      <td className="px-3 py-2 text-sm text-foreground"><span className="line-clamp-2 break-words">{x.nome}</span><span className="mt-1 block text-xs text-muted-foreground">Marcar como entregue</span></td>
      <td className="px-3 py-2"><SelectField id={`p-en-st-${x.id}`} value={status} onChange={setStatus} options={STATUS_ENTREGA} /></td>
      <td className="px-3 py-2"><DateField id={`p-en-dt-${x.id}`} value={data} onChange={setData} /><span className="mt-1 block text-xs text-muted-foreground">Data de Entrega Real</span></td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={onCancel} className="min-h-8 rounded-md border border-border bg-card px-2.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
          <button type="button" disabled={!data || !status} onClick={() => data && status && onApply(data, status)} className="min-h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Aplicar ao rascunho</button>
        </div>
      </td>
    </tr>
  );
}

/** Valores efetivos (rascunho sobre o valor do monday). */
function efetivo(x: ProdutoView, r: Rascunho | undefined) {
  const status = r && 'status' in r ? (r.status as string | null) : x.status;
  const prazo = r && 'prazo' in r ? (r.prazo as string | null) : dataEntrega(x);
  const valor = r && 'valor' in r ? (r.valor as number | null) : x.valor;
  const entregaReal = r && 'entregaReal' in r ? (r.entregaReal as string | null) : x.entregaReal;
  return { status, prazo, valor, entregaReal };
}

function EditRow({ x, inicial, onCancel, onApply }: {
  x: ProdutoView; inicial: ReturnType<typeof efetivo>; onCancel: () => void; onApply: (v: ReturnType<typeof efetivo>) => void;
}) {
  const [v, setV] = useState(inicial);
  return (
    <tr className="border-t border-border bg-[hsl(var(--chrome))] align-top">
      <td className="px-3 py-2 text-sm text-foreground"><span className="line-clamp-2 break-words">{x.nome}</span></td>
      <td className="px-3 py-2"><SelectField id={`p-st-${x.id}`} value={v.status} onChange={(s) => setV({ ...v, status: s })} options={STATUS_PRODUTO} /></td>
      <td className="px-3 py-2"><DateField id={`p-pr-${x.id}`} value={v.prazo} onChange={(s) => setV({ ...v, prazo: s })} /></td>
      <td className="px-3 py-2"><Chip tone={atrasoTone(situacaoDe(x))} dot>{situacaoDe(x) ?? 'Não avaliado'}</Chip></td>
      <td className="px-3 py-2">
        <NumberField id={`p-va-${x.id}`} value={v.valor} onChange={(n) => setV({ ...v, valor: n })} step={100} prefix="R$" />
        <div className="mt-2 flex justify-end gap-1.5">
          <button type="button" onClick={onCancel} className="min-h-8 rounded-md border border-border bg-card px-2.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
          <button type="button" onClick={() => onApply(v)} className="min-h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Aplicar ao rascunho</button>
        </div>
      </td>
    </tr>
  );
}

/** 2. O que ainda falta entregar. Edições ficam em rascunho; "Salvar" abre a validação e só grava no monday após confirmar. */
export function ProdutosRestantes({ produtos, carregando, erro, onRetry, data, projectId, projectName }: {
  produtos: ProdutoView[] | undefined; carregando: boolean; erro: boolean; onRetry: () => void;
  data: PainelData; projectId: string; projectName: string;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, Rascunho>>({});
  const [entregando, setEntregando] = useState<string | null>(null);
  const [validar, setValidar] = useState(false);
  const hoje = todayIso();
  const [entreguesAberto, setEntreguesAberto] = useState(false);
  const semDataReal = (produtos ?? []).filter((x) => !produtoAtivo(x) && !x.entregaReal).length;
  const todos = produtos ?? [];
  const lista = todos.filter(produtoAtivo);
  const entregues = todos.filter((x) => !produtoAtivo(x)).sort((a, b) => (b.entregaReal ?? '').localeCompare(a.entregaReal ?? ''));
  const ef = (x: ProdutoView) => efetivo(x, rascunho[x.id]);
  const ativo = (x: ProdutoView) => produtoAtivo({ status: ef(x).status, entregaReal: ef(x).entregaReal });
  const vencido = (x: ProdutoView) => { const e = ef(x); return ativo(x) && !!e.prazo && e.prazo < hoje; };
  const ordenados = [...lista].sort((a, b) => {
    const aa = ativo(a) ? 0 : 1; const ab = ativo(b) ? 0 : 1;
    if (aa !== ab) return aa - ab;
    return (ef(a).prazo ?? '9999').localeCompare(ef(b).prazo ?? '9999');
  });
  const ativos = lista.filter(ativo);
  const nVencidos = ativos.filter(vencido).length;
  const total = ativos.reduce((s, x) => s + (ef(x).valor ?? 0), 0);

  // Valor "atual na monday" = valor carregado ao abrir (prazo = coluna Prazo de Entrega).
  const original = (x: ProdutoView): Record<CampoEd, ValorEd> => ({ status: x.orig.status, prazo: x.orig.prazo, valor: x.orig.valor, entregaReal: x.entregaReal });
  const aplicarEntrega = (x: ProdutoView, dt: string, status: string) => {
    const o = original(x);
    const r: Rascunho = {};
    if (!valorIgual(status, o.status)) r.status = status;
    if (!valorIgual(dt, o.entregaReal)) r.entregaReal = dt;
    setRascunho((prev) => ({ ...prev, [x.id]: { ...(prev[x.id] ?? {}), ...r } }));
    setEntregando(null);
  };
  const aplicar = (x: ProdutoView, v: ReturnType<typeof efetivo>) => {
    const o = original(x);
    const r: Rascunho = {};
    if (!valorIgual(v.status, o.status)) r.status = v.status;
    if (!valorIgual(v.prazo, dataEntrega(x)) && !valorIgual(v.prazo, o.prazo)) r.prazo = v.prazo;
    if (!valorIgual(v.valor, o.valor)) r.valor = v.valor;
    setRascunho((prev) => { const n = { ...prev }; if (Object.keys(r).length) n[x.id] = r; else delete n[x.id]; return n; });
    setEditando(null);
  };
  const alteracoes: AlteracaoProduto[] = lista.filter((x) => rascunho[x.id]).map((x) => ({
    produtoId: x.id, produtoNome: x.nome,
    campos: (Object.keys(rascunho[x.id] ?? {}) as CampoEd[]).map((c) => ({ campo: c, esperado: original(x)[c], novo: rascunho[x.id]?.[c] ?? null })),
  }));
  const nAlt = alteracoes.reduce((s, a) => s + a.campos.length, 0);
  const iconBtn = 'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Section
      title="Produtos restantes"
      id="sec-produtos"
      aside={lista.length > 0 ? <span className="tnum text-xs text-muted-foreground">{ativos.length} itens · {nVencidos} vencidos · {fmtBRL(total)}</span> : undefined}
    >
      {!produtos ? (
        carregando ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : erro ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-[hsl(var(--danger-soft))] px-4 py-3 text-sm text-[hsl(var(--danger-ink))]">
            Não foi possível carregar os produtos.
            <button type="button" onClick={onRetry} className="min-h-9 rounded-md px-3 font-medium underline-offset-2 hover:underline">Tentar de novo</button>
          </div>
        ) : <p className="text-sm text-muted-foreground">Produtos ainda não carregados.</p>
      ) : lista.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md bg-[hsl(var(--success-soft))] px-4 py-3 text-sm text-[hsl(var(--success-ink))]">
          <PackageCheck className="size-4 shrink-0" aria-hidden /> Todos os produtos ligados a este projeto estão concluídos ou entregues.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
                <tr>
                  {['Produto', 'Status', 'Prazo de entrega', 'Situação'].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}
                  <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((x) => {
                  const e = ef(x);
                  const r = rascunho[x.id];
                  const mud = (c: CampoEd) => !!r && c in r;
                  if (entregando === x.id) return <EntregaRow key={x.id} x={x} onCancel={() => setEntregando(null)} onApply={(dt, st) => aplicarEntrega(x, dt, st)} />;
                  if (editando === x.id) return <EditRow key={x.id} x={x} inicial={e} onCancel={() => setEditando(null)} onApply={(v) => aplicar(x, v)} />;
                  return (
                    <tr key={x.id} className={cn('border-t border-border align-top', vencido(x) && 'bg-[hsl(var(--danger-soft))]', !ativo(x) && 'opacity-70')}>
                      <td className="px-3 py-2">
                        <LinkBotao href={itemUrl(BOARD_B_ID, x.id)} size="sm" title="Abrir produto no monday" className="max-w-[260px]">{x.nome}</LinkBotao>
                        {r && <div className="mt-1"><Chip tone="warning" title={(Object.keys(r) as CampoEd[]).map((c) => `${ROTULO[c]}: ${fmtCampo(c, original(x)[c])} → ${fmtCampo(c, r[c] ?? null)}`).join('; ')}>rascunho</Chip></div>}
                      </td>
                      <td className="px-3 py-2"><Chip tone={mud('status') ? 'warning' : e.status ? 'neutral' : 'ghost'}>{e.status ?? 'Sem status'}</Chip></td>
                      <td className="tnum px-3 py-2 text-foreground" title={x.prazo ? 'Prazo de Entrega' : x.previsto ? 'Data Prevista de Entrega' : undefined}>
                        <span className={cn(vencido(x) && 'font-medium text-[hsl(var(--danger-ink))]', mud('prazo') && 'font-medium text-[hsl(var(--warning-ink))]')}>{fmtDate(e.prazo)}</span>
                        {vencido(x) && <span className="mt-1 block"><Chip tone="danger">Vencido</Chip></span>}
                      </td>
                      <td className="px-3 py-2">
                        {mud('entregaReal') ? (
                          <Chip tone="warning" dot>Entregue em {fmtDate(e.entregaReal)} · aguardando gravação</Chip>
                        ) : (
                          <>
                            <Chip tone={atrasoTone(situacaoDe(x))} dot>{situacaoDe(x) ?? 'Não avaliado'}</Chip>
                            {x.entregaReal && <span className="tnum mt-1 block text-xs text-muted-foreground">Entrega real: {fmtDate(x.entregaReal)}</span>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-start justify-end gap-1">
                          <span className={cn('tnum pt-1.5 text-right text-foreground', mud('valor') && 'font-medium text-[hsl(var(--warning-ink))]')}>{fmtBRL2(e.valor)}</span>
                          {!ef(x).entregaReal && (
                            <button type="button" className={iconBtn} aria-label={`Marcar ${x.nome} como entregue`} title="Marcar como entregue" onClick={() => setEntregando(x.id)}><PackageCheck className="size-3.5" aria-hidden /></button>
                          )}
                          <button type="button" className={iconBtn} aria-label={`Editar ${x.nome}`} title="Editar (rascunho)" onClick={() => setEditando(x.id)}><Pencil className="size-3.5" aria-hidden /></button>
                          {r && (
                            <button type="button" className={iconBtn} aria-label={`Descartar rascunho de ${x.nome}`} title="Descartar rascunho" onClick={() => setRascunho((p) => { const n = { ...p }; delete n[x.id]; return n; })}>
                              <Undo2 className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {nAlt > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[hsl(var(--warning-soft))] px-4 py-2.5 text-sm text-[hsl(var(--warning-ink))]">
              <span>{nAlt} alteração(ões) em rascunho · ainda não gravadas no monday</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRascunho({})} className="min-h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Descartar</button>
                <button type="button" onClick={() => setValidar(true)} className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Salvar…</button>
              </div>
            </div>
          )}
        </>
      )}
      {entregues.length > 0 && (
        <div className="mt-4 rounded-md border border-border">
          <button
            type="button" aria-expanded={entreguesAberto} onClick={() => setEntreguesAberto((v) => !v)}
            className="flex min-h-10 w-full items-center justify-between gap-2 px-3 text-left text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="inline-flex items-center gap-2">
              <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', entreguesAberto && 'rotate-90')} aria-hidden />
              Entregues
            </span>
            <span className="tnum text-xs font-normal text-muted-foreground">{entregues.length} {entregues.length === 1 ? 'produto' : 'produtos'}{semDataReal > 0 && ` · ${semDataReal} sem data de entrega real`}</span>
          </button>
          {entreguesAberto && (
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
                  <tr>{['Produto', 'Entrega real', 'Situação'].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {entregues.map((x) => {
                    const semData = !x.entregaReal;
                    const sit = semData ? x.situacao : x.situacao && x.situacao.startsWith('Entregue') ? x.situacao : null;
                    return (
                      <tr key={x.id} className="border-t border-border align-top">
                        <td className="px-3 py-2"><LinkBotao href={itemUrl(BOARD_B_ID, x.id)} size="sm" title="Abrir produto no monday" className="max-w-[260px]">{x.nome}</LinkBotao></td>
                        <td className="tnum px-3 py-2 text-foreground">{semData ? <Chip tone="warning">Sem data de entrega real</Chip> : fmtDate(x.entregaReal)}</td>
                        <td className="px-3 py-2">{sit ? <Chip tone={atrasoTone(sit)} dot>{sit}</Chip> : <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <ValidarProdutosDialog
        open={validar} onOpenChange={setValidar} alteracoes={alteracoes} projectId={projectId} projectName={projectName} data={data}
        onGravados={(gs) => setRascunho((p) => { const n = { ...p }; for (const g of gs) delete n[g.produtoId]; return n; })}
      />
    </Section>
  );
}
