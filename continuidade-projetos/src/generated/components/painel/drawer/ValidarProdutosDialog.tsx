import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { gravarProdutos } from '@generated/server/produtosGravar';
import { fmtBRL2, fmtDate } from '@generated/lib/painel';
import type { PainelData } from '@generated/hooks/usePainelData';

export type CampoEd = 'status' | 'prazo' | 'valor' | 'entregaReal';
export type ValorEd = string | number | null;
export type AlteracaoProduto = { produtoId: string; produtoNome: string; campos: { campo: CampoEd; esperado: ValorEd; novo: ValorEd }[] };

export const ROTULO: Record<CampoEd, string> = { status: 'Status do Produto', prazo: 'Prazo de Entrega', valor: 'Valor do Produto', entregaReal: 'Data de Entrega Real Corporativo' };
export function fmtCampo(c: CampoEd, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vazio)';
  if (typeof v === 'object') return '(vazio)';
  if (c === 'prazo' || c === 'entregaReal') return fmtDate(typeof v === 'string' ? v : null);
  if (c === 'valor') return fmtBRL2(typeof v === 'number' ? v : null);
  return String(v);
}

type Res = Awaited<ReturnType<typeof gravarProdutos>>;
type Conflitos = Extract<Res, { status: 'conflito' }>['conflitos'];
type Ok = Extract<Res, { status: 'ok' }>;
const chave = (produtoId: string, campo: string) => `${produtoId}:${campo}`;

/** Validação final: lista cada alteração (valor atual no monday → novo) e só grava após "Confirmar". */
export function ValidarProdutosDialog({ open, onOpenChange, alteracoes, projectId, projectName, data, onGravados }: {
  open: boolean; onOpenChange: (o: boolean) => void; alteracoes: AlteracaoProduto[];
  projectId: string; projectName: string; data: PainelData; onGravados: (r: Ok['gravados']) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [conflitos, setConflitos] = useState<Conflitos | null>(null);
  const [forcados, setForcados] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<Ok | null>(null);

  useEffect(() => {
    if (open) { setConflitos(null); setForcados(new Set()); setResultado(null); }
  }, [open]);

  const confirmar = async () => {
    // Em conflito: campos não marcados para "gravar mesmo assim" saem do pedido.
    const pendentes = new Set((conflitos ?? []).map((c) => chave(c.produtoId, c.campo)));
    const itens = alteracoes
      .map((a) => ({ ...a, campos: a.campos.filter((c) => !pendentes.has(chave(a.produtoId, c.campo)) || forcados.has(chave(a.produtoId, c.campo))) }))
      .filter((a) => a.campos.length > 0);
    if (!itens.length) { onOpenChange(false); return; }
    const dec = data.getDecisao(projectId);
    setBusy(true);
    try {
      const res = await gravarProdutos({ data: { projectId, projectName, decisionId: dec && !dec.id.startsWith('tmp-') ? dec.id : null, itens, forcar: [...forcados] } });
      if (!res) throw new Error('Sem resposta');
      if (res.status === 'conflito') {
        setConflitos(res.conflitos);
        setForcados(new Set());
        return;
      }
      data.patchProdutos(projectId, res.atualizados);
      if (res.log) data.addLog(res.log);
      onGravados(res.gravados);
      setResultado(res);
      if (res.logErro) toast.warning('Gravado no monday, mas não foi possível registrar no histórico.');
    } catch (e) {
      console.error('gravarProdutos', e);
      toast.error('Não foi possível gravar. Nada foi alterado no monday. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const linhas = alteracoes.flatMap((a) => a.campos.map((c) => ({ ...c, produtoId: a.produtoId, produtoNome: a.produtoNome })));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{resultado ? 'Resultado da gravação' : conflitos ? 'Valores alterados por fora' : 'Validar alterações dos produtos'}</DialogTitle>
          <DialogDescription>
            {resultado ? 'Itens relidos do monday e painel atualizado.'
              : conflitos ? 'Estes campos mudaram no monday depois que o painel foi aberto. Marque os que devem ser gravados mesmo assim.'
                : 'Confira cada alteração. Nada é gravado no quadro Levantamento de Produtos até você confirmar.'}
          </DialogDescription>
        </DialogHeader>

        {!resultado && linhas.some((l) => l.campo === 'prazo') && (
          <p className="flex items-start gap-2 rounded-md bg-[hsl(var(--warning-soft))] px-3 py-2 text-xs text-[hsl(var(--warning-ink))]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            O quadro tem automação de recálculo de prazos; o valor pode ser alterado depois por ela.
          </p>
        )}
        {resultado ? (
          <div className="flex flex-col gap-3 text-sm">
            {resultado.gravados.length > 0 && (
              <ul className="flex flex-col gap-1">
                {resultado.gravados.map((g) => (
                  <li key={g.produtoId} className="flex items-start gap-2 text-[hsl(var(--success-ink))]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="text-foreground"><span className="font-medium">{g.produtoNome}</span> · gravado: {g.campos.map((c) => ROTULO[c]).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
            {resultado.falhas.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-md bg-[hsl(var(--danger-soft))] p-3">
                {resultado.falhas.map((f) => (
                  <li key={f.produtoId} className="flex items-start gap-2 text-[hsl(var(--danger-ink))]"><XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span><span className="font-medium">{f.produtoNome}</span> · não gravado ({f.campos.map((c) => ROTULO[c]).join(', ')}). A alteração continua como rascunho.</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : conflitos ? (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-sm">
            {conflitos.map((c) => {
              const k = chave(c.produtoId, c.campo);
              return (
                <li key={k} className="flex flex-col gap-1.5 px-3 py-2.5">
                  <span className="font-medium text-foreground">{c.produtoNome} · {ROTULO[c.campo]}</span>
                  <span className="tnum text-xs text-muted-foreground">Ao abrir: {fmtCampo(c.campo, c.esperado)} · Agora no monday: <span className="font-medium text-[hsl(var(--warning-ink))]">{fmtCampo(c.campo, c.atual)}</span> · Novo: {fmtCampo(c.campo, c.novo)}</span>
                  <label className="inline-flex min-h-8 w-fit cursor-pointer items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={forcados.has(k)}
                      onChange={() => setForcados((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
                    Gravar mesmo assim
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead className="bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
                <tr>{['Produto', 'Campo', 'Valor atual na monday', 'Valor novo'].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={chave(l.produtoId, l.campo)} className="border-t border-border align-top">
                    <td className="px-3 py-2"><span className="line-clamp-2 break-words">{l.produtoNome}</span></td>
                    <td className="px-3 py-2 text-muted-foreground">{ROTULO[l.campo]}</td>
                    <td className="tnum px-3 py-2 text-muted-foreground">{fmtCampo(l.campo, l.esperado)}</td>
                    <td className="tnum px-3 py-2 font-medium text-foreground"><span className="inline-flex items-center gap-1.5"><ArrowRight className="size-3 text-muted-foreground" aria-hidden />{fmtCampo(l.campo, l.novo)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border bg-[hsl(var(--chrome))] px-3 py-2 text-xs text-muted-foreground">Colunas de fórmula (como Situação / Status Atraso Entrega) são somente leitura: o monday recalcula depois da gravação.</p>
          </div>
        )}

        {!resultado && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Antes de gravar, o app relê os valores atuais do quadro. Cada gravação fica no histórico do projeto.
          </p>
        )}
        <DialogFooter>
          {resultado ? (
            <button type="button" onClick={() => onOpenChange(false)} className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Fechar</button>
          ) : (
            <>
              <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className="min-h-10 rounded-md border border-border bg-card px-4 text-sm hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Voltar ao rascunho</button>
              <button type="button" onClick={() => void confirmar()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {conflitos ? 'Confirmar e gravar' : 'Confirmar'}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
