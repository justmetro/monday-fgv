import type { ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import { fmtBRLCompact, toDate, DASH } from '@generated/lib/format';
import type { LinhaCarga } from '@generated/lib/carga';
import { MAPA_BOARD_ID, urlItem } from '@generated/lib/links';
import { StatusPill } from '@generated/components/ui-bits';
import { FimChip } from '@generated/components/carga-bits';
import { LinkBtn } from '@generated/components/ProjectView';
import { AbrirFechando } from '@generated/components/AbrirProjeto';
import { type CarteiraGerente, GerenteAbas } from '@generated/components/GerenteAbas';

const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const n = (v: number | null) => (v === null ? DASH : dec.format(v));
const lista = (v: string[]) => (v.length ? v.join(', ') : DASH);

function Fato({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

/** Portfolio from the Capacidade por Gerente line (no projections there): active vs. the rest of the scope. */
function carteiraDaLinha(l: LinhaCarga): CarteiraGerente {
  const ativos = new Set(l.ativos.map((p) => p.id));
  const fim = (d: Date | null) => d?.getTime() ?? Infinity;
  const comTermino = (ps: LinhaCarga['projetos']) => ps.map((p) => ({ p, termino: toDate(p.ltimoProdutoPrevisto) })).sort((a, b) => fim(a.termino) - fim(b.termino));
  return { ativos: comTermino(l.ativos), encerrados: comTermino(l.projetos.filter((p) => !ativos.has(p.id))), projecoes: null };
}

interface Props {
  linha: LinhaCarga | null;
  onClose: () => void;
  /** Portfolio from Gestão Alocação de Gerentes (same active rule + pending projections). */
  carteira?: CarteiraGerente | null;
  /** Manual revisions of this manager (Gestão Alocação de Gerentes only). */
  revisado?: string | null;
}

/** Manager side panel (Capacidade por Gerente and Gestão Alocação de Gerentes): Mapa data + tabs Ativos / Encerrados / Projeções. */
export function GerenteSheet({ linha, onClose, carteira, revisado }: Props) {
  const g = linha?.g;
  const c = linha ? carteira ?? carteiraDaLinha(linha) : null;
  const itemMapa = g?.cadastrado ? g.itemIds[0] : undefined;

  return (
    <Sheet open={!!linha} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto border-border bg-[hsl(var(--surface-chrome))] p-0 shadow-none sm:max-w-xl">
        {linha && g && c && (
          <AbrirFechando fechar={onClose}>
            <SheetHeader className="gap-2 px-5 pb-4 pt-5 pr-12">
              <SheetTitle className="text-lg font-semibold leading-snug text-foreground">{g.nome}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {g.cadastrado ? 'Mapa de Gerentes de Projeto' : 'Não cadastrado no Mapa de Gerentes (vínculo só pelo 02.01)'}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {g.atividadeAtual && <StatusPill label={g.atividadeAtual} />}
                <span className="tnum inline-flex items-center rounded-[var(--radius-sm)] border border-border bg-[hsl(var(--surface-2))] px-1.5 py-0.5 text-xs text-foreground">
                  {c.ativos.length} ativo{c.ativos.length === 1 ? '' : 's'} · {c.encerrados.length} encerrado{c.encerrados.length === 1 ? '' : 's'}
                </span>
              </div>
              {revisado && <p className="text-[11px] text-[hsl(var(--fg-subtle))]">Revisado manualmente: {revisado}</p>}
            </SheetHeader>
            {itemMapa && (
              <div className="flex flex-wrap gap-2 px-5 pb-4">
                <LinkBtn label="Abrir no quadro ↗" link={{ url: urlItem(itemMapa, MAPA_BOARD_ID) }} />
              </div>
            )}

            <section className="border-t border-border px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold text-muted-foreground">Dados do Mapa</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Fato k="Perfil">{lista(g.perfil)}</Fato>
                <Fato k="Certificação PMI">{lista(g.pmi)}</Fato>
                <Fato k="Processo de Qualificação">
                  {lista(g.qualificacao)}
                  {g.statusQualificacao && <span className="text-muted-foreground"> · {g.statusQualificacao}</span>}
                </Fato>
                <Fato k="E-mail">
                  {g.email ? (
                    <a href={`mailto:${g.email}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                      <Mail className="size-3" aria-hidden /> {g.email}
                    </a>
                  ) : DASH}
                </Fato>
                <Fato k="Local">{g.local ?? DASH}</Fato>
                <Fato k="Fim de atuação"><FimChip fim={g.fimAtuacao} dias={linha.fimDias} /></Fato>
                <Fato k="Av. Desempenho"><span className="tnum">{n(g.desempenho)}</span></Fato>
                <Fato k="Complexidade"><span className="tnum">{n(g.complexidade)}</span></Fato>
                <Fato k="Valor dos contratos ativos"><span className="tnum">{fmtBRLCompact(linha.valorAtivos)}</span></Fato>
                <Fato k="Total Projetos (Mapa)"><span className="tnum">{g.totalProjetosMapa ?? DASH}</span></Fato>
              </dl>
            </section>

            <section className="border-t border-border px-5 py-4">
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Projetos no 02.01 (coluna Gerente)</h3>
              <GerenteAbas c={c} />
            </section>
          </AbrirFechando>
        )}
      </SheetContent>
    </Sheet>
  );
}
