import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Checkbox } from '@components/ui/checkbox';
import { Spinner } from '@components/ui/spinner';
import { cn } from '@lib/utils';
import { codigoDe } from '@generated/lib/format';
import { TEMPS, TEMP_COR, type Temp } from '@generated/lib/alocacao';
import { TriangleAlert } from 'lucide-react';
import { lerPdfPrioridades, vincularLinhas, type FontePdf, type LinhaPdf } from '@generated/lib/importar';
import { BuscaCombo, Chip } from '@generated/components/alocacao/bits';
import { btnNeutro, tabelaCls, theadCls, thCls, trCls } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';

interface Linha { key: string; nome: string; etapa: string; responsavel: string; fonte: FontePdf; cor: string; pagina: number; projetoId: string | null; aviso: string | null; temp: Temp | ''; incluir: boolean }

/** Color sample of the PDF row (SVG fill — the color is data read from the file). */
const Amostra = ({ cor }: { cor: string }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-label={`Cor da linha ${cor}`} className="shrink-0">
    <title>{cor}</title>
    <rect x="0.5" y="0.5" width="17" height="17" rx="3" fill={cor} stroke="hsl(var(--border))" />
  </svg>
);

/** Import of the weekly PDF: temperature from the row background color → review screen → apply on confirm. */
export function ImportarDialog({ ctx, open, onOpenChange }: { ctx: AlocCtx; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { modelo, api } = ctx;
  const [lendo, setLendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const porId = useMemo(() => new Map(modelo.todos.map((d) => [d.p.id, d])), [modelo.todos]);
  const opcoesProjeto = useMemo(() => modelo.todos.map((d) => ({ id: d.p.id, label: d.p.name, sub: codigoDe(d.p) ?? undefined })), [modelo.todos]);

  const lerPdf = async (f: File | undefined) => {
    if (!f) return;
    setLendo(true);
    try {
      const lidas = await lerPdfPrioridades(f);
      if (!lidas.length) {
        toast.error('Nenhuma tabela encontrada no PDF', { description: 'Esperado: páginas “STATUS NEGOCIAÇÕES” e/ou “LISTA DE PROSPECÇÕES” com NOME | ETAPA | RESPONSÁVEL.' });
        return;
      }
      // Linked separately: a project in both lists keeps the Status Negociações temperature.
      const neg = lidas.filter((l) => l.fonte === 'negociacoes');
      const pros = lidas.filter((l) => l.fonte === 'prospeccoes');
      const vNeg = vincularLinhas(neg.map((l) => l.nome), modelo.todos);
      const vPros = vincularLinhas(pros.map((l) => l.nome), modelo.todos);
      const idsNeg = new Set(vNeg.map((v) => v.projetoId).filter(Boolean));
      const montar = (l: LinhaPdf, v: { projetoId: string | null; aviso: string | null } | undefined, i: number): Linha => {
        const repetido = l.fonte === 'prospeccoes' && !!v?.projetoId && idsNeg.has(v.projetoId);
        const aviso = [l.aviso, v?.aviso, repetido ? 'Projeto também em Status Negociações: vale a temperatura de lá.' : null].filter(Boolean).join(' ') || null;
        return {
          key: `${l.fonte}-${l.pagina}-${i}`, nome: l.nome, etapa: l.etapa, responsavel: l.responsavel, cor: l.cor, pagina: l.pagina, fonte: l.fonte,
          projetoId: v?.projetoId ?? null, aviso, temp: l.temp ?? '', incluir: !!l.temp && !repetido,
        };
      };
      setLinhas([...neg.map((l, i) => montar(l, vNeg[i], i)), ...pros.map((l, i) => montar(l, vPros[i], i))]);
    } catch (e) {
      console.error('Erro ao ler PDF', e);
      toast.error('Não foi possível ler o PDF', { description: 'Confira se é o PDF semanal de prioridades de Negócios.' });
    } finally {
      setLendo(false);
    }
  };

  const set = (key: string, p: Partial<Linha>) => setLinhas((ls) => ls?.map((l) => (l.key === key ? { ...l, ...p } : l)) ?? null);
  const incluidas = (linhas ?? []).filter((l) => l.incluir && l.temp);
  const atualizar = [...new Map(incluidas.filter((l) => l.projetoId && porId.get(l.projetoId)?.temp.valor !== l.temp).map((l) => [l.projetoId as string, l.temp as string])).entries()]
    .map(([projetoId, temp]) => ({ projetoId, temp }));
  const pendentes = incluidas.filter((l) => !l.projetoId).map((l) => ({ nomeRelatorio: l.nome.slice(0, 400), etapa: l.etapa.slice(0, 200), temp: l.temp }));
  const todasMarcadas = !!linhas?.length && linhas.every((l) => l.incluir);

  const aplicar = async () => {
    setAplicando(true);
    const ok = await api.importar(atualizar, pendentes);
    setAplicando(false);
    if (ok) {
      toast.success(`${atualizar.length} temperatura(s) atualizada(s)`, { description: `${pendentes.length} não encontrado(s) foram para os pendentes.` });
      setLinhas(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !aplicando && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-24px)] max-w-6xl overflow-y-auto rounded-[var(--radius-lg)] border-border bg-popover shadow-none">
        <DialogHeader>
          <DialogTitle className="text-base">Importar prioridades de Negócios</DialogTitle>
          <DialogDescription className="text-[13px]">
            PDF da Reunião Semanal. “STATUS NEGOCIAÇÕES”: a temperatura vem da cor de fundo da linha, comparada com a legenda do rodapé da mesma página. “LISTA DE PROSPECÇÕES”: etapa “PAUSADO” marca o projeto como pausado. As demais páginas são ignoradas. Nada é aplicado antes da sua confirmação; a temperatura é salva como revisão no app.
          </DialogDescription>
        </DialogHeader>

        {!linhas ? (
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-input bg-[hsl(var(--surface-2)/0.5)] p-6 text-center text-[13px] text-muted-foreground hover:border-[hsl(var(--primary)/0.6)]">
            {lendo ? <Spinner className="size-4" /> : null}
            {lendo ? 'Lendo cores e tabelas do PDF…' : 'Clique para enviar o PDF do relatório'}
            <span className="text-[11px] text-[hsl(var(--fg-subtle))]">rosa = 15 a 30 dias · pêssego = 30 a 45 · amarelo claro = 45 a 60 · PAUSADO = Negociação pausada</span>
            <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={lendo} onChange={(e) => void lerPdf(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {linhas.filter((l) => l.fonte === 'negociacoes').length} em Status Negociações
              {' ('}{(['15 a 30 dias', '30 a 45 dias', '45 a 60 dias'] as const).map((t) => `${linhas.filter((l) => l.fonte === 'negociacoes' && l.temp === t).length} em ${t}`).join(', ')}
              {linhas.some((l) => l.fonte === 'negociacoes' && !l.temp) ? `, ${linhas.filter((l) => l.fonte === 'negociacoes' && !l.temp).length} sem cor reconhecida` : ''}{') · '}{linhas.filter((l) => l.fonte === 'prospeccoes').length} pausado(s) na Lista de Prospecções · <span className="text-foreground">{atualizar.length} atualizar</span> · {pendentes.length} não encontrado(s) → pendentes · {linhas.length - incluidas.length} fora
              {linhas.some((l) => l.aviso) && <span className="text-[hsl(var(--warning))]"> · {linhas.filter((l) => l.aviso).length} com possível duplicidade</span>}
            </p>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
              <table className={tabelaCls}>
                <thead className={theadCls}>
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2">
                      <Checkbox checked={todasMarcadas} onCheckedChange={() => setLinhas((ls) => ls?.map((l) => ({ ...l, incluir: !todasMarcadas })) ?? null)} aria-label="Incluir todos" />
                    </th>
                    <th scope="col" className={thCls}>Cor</th><th scope="col" className={thCls}>Nome no PDF</th><th scope="col" className={thCls}>Projeto associado</th>
                    <th scope="col" className={thCls}>Temperatura</th><th scope="col" className={thCls}>Etapa</th><th scope="col" className={thCls}>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const d = l.projetoId ? porId.get(l.projetoId) : undefined;
                    return (
                      <tr key={l.key} className={cn(trCls, !l.incluir && 'opacity-50')}>
                        <td className="px-3 py-2"><Checkbox checked={l.incluir} onCheckedChange={() => set(l.key, { incluir: !l.incluir })} aria-label={`Incluir ${l.nome}`} /></td>
                        <td className="px-3 py-2">{l.cor ? <Amostra cor={l.cor} /> : <span className="text-xs text-[hsl(var(--fg-subtle))]">—</span>}</td>
                        <td className="max-w-[280px] px-3 py-2 text-foreground">
                          {l.nome}
                          <span className="block text-[10px] text-[hsl(var(--fg-subtle))]">pág. {l.pagina} · {l.fonte === 'negociacoes' ? 'Status Negociações' : 'Lista de Prospecções'}</span>
                        </td>
                        <td className="max-w-[300px] px-3 py-2">
                          <BuscaCombo itens={opcoesProjeto} placeholder="Buscar projeto do 02.01…" onPick={(i) => set(l.key, { projetoId: i.id })}
                            gatilho={
                              <button type="button" className="min-h-11 w-full rounded-[var(--radius-sm)] px-1 text-left text-[13px] hover:bg-[hsl(var(--surface-2))] md:min-h-0">
                                {d ? <span className="text-foreground">{d.p.name}</span> : <span className="italic text-[hsl(var(--fg-subtle))]">não encontrado · vincular…</span>}
                              </button>
                            } />
                          {l.aviso && (
                            <span className="mt-1 flex items-start gap-1 text-[11px] text-[hsl(var(--warning))]">
                              <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden="true" />{l.aviso}
                            </span>
                          )}
                          {d && <button type="button" onClick={() => set(l.key, { projetoId: null })} className="h-11 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground md:h-6">desvincular</button>}
                        </td>
                        <td className="px-3 py-2">
                          <label className="sr-only" htmlFor={`imp-t-${l.key}`}>Temperatura de {l.nome}</label>
                          <select id={`imp-t-${l.key}`} value={l.temp} onChange={(e) => set(l.key, { temp: e.target.value as Temp | '' })}
                            className="h-11 rounded-[var(--radius-sm)] border border-input bg-[hsl(var(--surface-2))] px-1.5 text-xs text-foreground md:h-7">
                            <option value="">— não detectada</option>
                            {TEMPS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          {d && <span className="mt-1 block text-[10px] text-[hsl(var(--fg-subtle))]">atual: <Chip corVar={TEMP_COR[d.temp.valor]} className="h-5">{d.temp.valor}</Chip></span>}
                        </td>
                        <td className="max-w-[200px] px-3 py-2 text-xs text-muted-foreground">{l.etapa || '—'}</td>
                        <td className="max-w-[160px] px-3 py-2 text-xs text-muted-foreground">{l.responsavel || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setLinhas(null)} disabled={aplicando} className={btnNeutro}>Enviar outro PDF</button>
              <button type="button" onClick={() => void aplicar()} disabled={aplicando || (!atualizar.length && !pendentes.length)} className={btnNeutro}>
                {aplicando && <Spinner className="size-3.5" />} Confirmar ({atualizar.length} atualização(ões), {pendentes.length} pendente(s))
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
