import type { ReactNode } from 'react';
import { PanelRight } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import { codigoDe, fmtDate, DASH } from '@generated/lib/format';
import { rotuloDestino, classificar, contaNoTotal, tipoDe, TIPO_LABEL, type Destino } from '@generated/lib/alocacao';
import { chegadaDe, CHEGADA_REGRA } from '@generated/lib/chegada';
import { StatusPill, InfoDica } from '@generated/components/ui-bits';
import { Chip } from '@generated/components/alocacao/bits';
import { Comentario } from '@generated/components/alocacao/comentario';
import { type AlocCtx, TempSel, ComplexSel } from '@generated/components/alocacao/ctx';
import { DestinoGerentes, ExperienciaProjetados } from '@generated/components/alocacao/DestinoGerentes';
import { DesativarProjeto } from '@generated/components/alocacao/selecao';
import { AbrirFechando, useAbrirProjeto } from '@generated/components/AbrirProjeto';

function Fato({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">{k}</dt>
      <dd className="mt-1 break-words text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

/** Status information that used to be tags on the table rows: situation, type of projection, pending sync, manual revisions. */
function Situacao({ d }: { d: Destino }) {
  const cl = classificar(d);
  const revisados = [d.temp.ajuste ? 'temperatura' : null, d.complex.ajuste ? 'complexidade' : null].filter(Boolean).join(' e ');
  return (
    <section className="border-t border-border px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Situação</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {cl === 'novo' ? <Chip corVar="--temp-30">Novo gerente</Chip> : cl === 'externo' ? <Chip corVar="--farol-gray">Externo</Chip>
          : cl === 'interno' ? <Chip corVar="--farol-green">Projeção de gerente interno</Chip> : <Chip corVar="--temp-sem">Sem projeção</Chip>}
        {d.projecoes.length > 0 && d.comGerente && [...new Set(d.projecoes.map((x) => tipoDe(x.data)))].map((t) => <Chip key={t} corVar="--temp-mudanca">{TIPO_LABEL[t]}</Chip>)}
        {d.gerenteJaNo0201 && <Chip corVar="--farol-gray">Gerente já no 02.01 · falta validar</Chip>}
        {d.aguardandoSync && <Chip corVar="--temp-30">Validado, aguardando sincronizar com o 02.01</Chip>}
        {!contaNoTotal(d) && <Chip corVar="--farol-gray">Fora do total</Chip>}
      </div>
      {revisados && <p className="mt-2 text-[11px] text-[hsl(var(--fg-subtle))]">Revisado manualmente: {revisados}</p>}
    </section>
  );
}

function VerFicha({ d }: { d: Destino }) {
  const abrir = useAbrirProjeto();
  return (
    <button type="button" onClick={() => abrir?.(d.p)}
      className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-3 text-[13px] text-foreground hover:bg-[hsl(var(--surface-3))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8">
      <PanelRight className="size-3.5 text-primary" aria-hidden /> Ficha completa do projeto
    </button>
  );
}

/** Comments: one per projected manager (key = manager / destination type); a general one without projection. */
function Comentarios({ ctx, d }: { ctx: AlocCtx; d: Destino }) {
  const { dados, api } = ctx;
  const doc = (gid: string) => dados.comentarios.find((x) => x.data.escopo === 'projeto' && x.data.alvoId === d.p.id && x.data.gerenteId === gid) ?? null;
  if (!d.projecoes.length) return <Comentario doc={doc('')} rotulo={d.p.name} onSave={(t) => api.comentar('projeto', d.p.id, '', t)} />;
  return (
    <ul className="flex flex-col gap-2">
      {d.projecoes.map((x, i) => {
        const gid = x.data.destinoTipo === 'gerente' || x.data.destinoTipo === 'novo' ? x.data.gerenteId : x.data.destinoTipo;
        const proprio = doc(gid);
        const legado = !proprio && i === 0 ? doc('') : null;
        const salvar = async (t: string) => {
          const ok = await api.comentar('projeto', d.p.id, gid, t);
          if (ok && legado) await api.comentar('projeto', d.p.id, '', '');
          return ok;
        };
        return (
          <li key={x.id} className="min-w-0">
            <span className="block text-[11px] text-muted-foreground">{rotuloDestino(x.data)}</span>
            <Comentario doc={proprio ?? legado} rotulo={`${d.p.name} · ${rotuloDestino(x.data)}`} onSave={salvar} />
          </li>
        );
      })}
    </ul>
  );
}

/** Side panel of a destination card (Esteira de pactuação): temperature, complexity, eixos, comments and pickers. */
export function DestinoSheet({ ctx, id, onClose }: { ctx: AlocCtx; id: string | null; onClose: () => void }) {
  const d = id ? ctx.modelo.todos.find((x) => x.p.id === id) ?? null : null;
  const c = d ? chegadaDe(d) : null;
  return (
    <Sheet open={!!d} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto border-border bg-[hsl(var(--surface-chrome))] p-0 shadow-none sm:max-w-lg">
        {d && c && (
          <AbrirFechando fechar={onClose}>
            <SheetHeader className="gap-2 px-5 pb-4 pt-5 pr-12">
              <span className="font-mono-code text-xs text-primary">{codigoDe(d.p) ?? DASH}</span>
              <SheetTitle className="text-lg font-semibold leading-snug text-foreground">{d.p.name}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">{d.comGerente ? 'Projeto com gerente no 02.01' : 'Projeto novo · sem gerente no 02.01'}</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <StatusPill label={d.p.statusPlanejamento} />
                <VerFicha d={d} />
              </div>
            </SheetHeader>

            <Situacao d={d} />

            <section className="border-t border-border px-5 py-4">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Gerente projetado</h3>
              <DestinoGerentes ctx={ctx} d={d} />
              <ExperienciaProjetados ctx={ctx} d={d} />
            </section>

            <section className="border-t border-border px-5 py-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Fato k="Temperatura"><TempSel d={d} api={ctx.api} /></Fato>
                <Fato k="Complexidade"><ComplexSel d={d} api={ctx.api} /></Fato>
                <Fato k={<>Chegada prevista <InfoDica texto={CHEGADA_REGRA} /></>}>
                  {c.inicio ? fmtDate(c.inicio) : <span className="text-[hsl(var(--warning))]">Sem previsão</span>}
                  <span className="block text-[11px] text-muted-foreground">{c.rotuloOrigem}</span>
                </Fato>
                <Fato k="Data de assinatura">{fmtDate(d.p.dataDeAssinatura)}</Fato>
                <Fato k="Eixos">{(d.p.eixo ?? []).length ? (d.p.eixo ?? []).join(', ') : DASH}</Fato>
                <Fato k="UF · Cliente">{[(d.p.uf ?? []).join(', '), d.p.cliente].filter(Boolean).join(' · ') || DASH}</Fato>
              </dl>
            </section>

            <section className="border-t border-border px-5 py-4">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Comentários</h3>
              <Comentarios ctx={ctx} d={d} />
            </section>
            <div className="flex justify-end border-t border-border px-5 py-3"><DesativarProjeto ctx={ctx} d={d} /></div>
          </AbrirFechando>
        )}
      </SheetContent>
    </Sheet>
  );
}
