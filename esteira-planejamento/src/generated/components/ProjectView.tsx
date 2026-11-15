import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { normalizarUrlMonday } from '@generated/lib/links';
import { cn } from '@lib/utils';
import { type Projeto, gerenteDe, list, txt, fmtDate, fmtBRL, fmtPct, DASH } from '@generated/lib/format';
import { etapasDe } from '@generated/lib/farol';
import { paresDe, marcadorTexto } from '@generated/lib/finance';
import { IT_KEYS, IT_LABEL, fmtIt, itValor } from '@generated/lib/metricas';
import { FarolChip, StatusPill, Money } from '@generated/components/ui-bits';

function Bloco({ titulo, aside, children }: { titulo: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground">{titulo}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fato({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[hsl(var(--fg-subtle))]">{k}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-foreground">{v}</dd>
    </div>
  );
}

/** Compact "Abrir quadro do planejamento" link (column Quadro do Planejamento); hidden when empty. */
export function QuadroPlanLink({ p }: { p: Projeto }) {
  const url = normalizarUrlMonday(p.quadroDoPlanejamento?.url);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir quadro do planejamento de ${p.name} (nova aba)`}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-[13px] text-foreground transition-colors duration-150 hover:border-[hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--surface-3))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 md:h-8">
      <ExternalLink className="size-3.5 text-primary" aria-hidden /> Abrir quadro do planejamento
    </a>
  );
}

export function LinkBtn({ label, link }: { label: string; link: { url: string; label?: string } | null }) {
  const url = normalizarUrlMonday(link?.url);
  if (!url) {
    return (
      <span className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-border px-3 text-[13px] text-[hsl(var(--fg-subtle))] md:h-8" title="Link não preenchido no quadro">
        {label} · {DASH}
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-3 text-[13px] text-foreground transition-colors duration-150 hover:border-[hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--surface-3))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 md:h-8">
      <ExternalLink className="size-3.5 text-primary" aria-hidden /> {label}
    </a>
  );
}

const semNull = (v: string | null) => (v && v.trim().toLowerCase() !== 'null' ? v : null);

export function ProjectView({ p }: { p: Projeto }) {
  return (
    <>
      <Bloco titulo="Dados do projeto">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Fato k="Vigência contratual" v={p.vignciaContratual ? `${fmtDate(p.vignciaContratual.from)} → ${fmtDate(p.vignciaContratual.to)}` : DASH} />
          <Fato k="Gerente" v={gerenteDe(p)} />
          <Fato k="Ponto focal" v={p.pontoFocal?.map((x) => x.name).filter(Boolean).join(', ') || DASH} />
          <Fato k="Cliente" v={txt(p.cliente)} />
          <Fato k="UF" v={list(p.uf)} />
          <Fato k="Eixo" v={list(p.eixo)} />
          <Fato k="Tipo planejamento" v={list(p.tipoPlanejamento)} />
          <Fato k="Início planejamento" v={fmtDate(p.incioPlanejamento)} />
          <Fato k="Radar Monitoramento" v={<StatusPill label={p.radarMonitoramento} />} />
          <Fato k="Alocação de Equipe" v={<StatusPill label={p.alocaoDeEquipe} />} />
          <Fato k="Mês Referência Resultado" v={txt(p.msRefernciaResultado)} />
          <Fato k="Data Validação SGI" v={fmtDate(p.dataValidaoSgi)} />
        </dl>
      </Bloco>

      <Bloco titulo="Farois de prazo">
        <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-md)] border border-border bg-card">
          {etapasDe(p).map((e) => (
            <li key={e.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{e.label}</p>
                <p className="tnum text-[11px] text-muted-foreground">
                  Prazo {fmtDate(e.prazo)} · Concl. {fmtDate(e.conclusao)} · Result. {semNull(e.resultado)?.trim() || DASH}
                  {e.extra ? ` · ${e.extra.label} ${semNull(e.extra.value)?.trim() || DASH}` : ''}
                </p>
              </div>
              <FarolChip farol={e.farol} text={e.detalhe} />
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Indicadores IT">
        <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-[var(--radius-md)] border border-border bg-border">
          {IT_KEYS.map((k) => (
            <div key={k} className="bg-card px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{IT_LABEL[k]}</dt>
              <dd className="tnum mt-0.5 text-base font-light text-foreground">{fmtIt(itValor(p[k]))}</dd>
            </div>
          ))}
        </dl>
      </Bloco>

      <Bloco titulo={`Saldos · contrato ${fmtBRL(p.valorDoContrato)}`}>
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-card">
          <table className="tnum w-full min-w-[420px] text-[13px]">
            <thead className="text-[11px] text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-1.5 text-left font-medium"><span className="sr-only">Categoria</span></th>
                <th className="px-3 py-1.5 text-right font-medium">Orçado</th>
                <th className="px-3 py-1.5 text-right font-medium">Planejado</th>
                <th className="px-3 py-1.5 text-right font-medium">Saldo</th>
                <th className="px-3 py-1.5 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {paresDe(p).map((x) => (
                <tr key={x.key} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-medium text-foreground">{x.label}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtBRL(x.orcado)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtBRL(x.planejado)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{marcadorTexto(x.saldoRaw) ?? <Money value={x.saldo} />}</td>
                  <td className={cn('px-3 py-2 text-right', (x.pct ?? 0) < 0 && 'text-[hsl(var(--danger))]')}>{marcadorTexto(x.pctRaw) ?? fmtPct(x.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </>
  );
}
