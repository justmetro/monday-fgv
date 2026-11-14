import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { getProject } from '@generated/data/projects';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@components/ui/collapsible';
import { calcTone, envioTone, Eyebrow, Pill } from '@generated/components/kit';
import { formatDate } from '@generated/lib/config';
import { parseGrs } from '@generated/components/projects/ProjectRow';
import { cn } from '@lib/utils';

type Project = NonNullable<Awaited<ReturnType<typeof getProject>>['item']>;

export function ProjectHeader({ project: p }: { project: Project }) {
  const [open, setOpen] = useState(true);
  const grs = parseGrs(p.grsIdentificados);
  const answers: { n: string; q: string; a: string[] | null }[] = [
    { n: '01', q: 'Faturamento ao ano', a: p.column1FaturamentoAoAno },
    { n: '02', q: 'Tipo de faturamento', a: p.column2TipoDeFaturamento },
    { n: '03', q: 'Vigência do contrato', a: p.column3VignciaDoContrato },
    { n: '04', q: 'Cliente', a: p.column4Cliente },
    { n: '05', q: 'Modalidade', a: p.column5Modalidade },
    { n: '06', q: 'Produtos ao mês', a: p.column6ProdutosAoMs },
    { n: '07', q: 'Tipologia de entrega', a: p.column7TipologiaDeEntrega },
    { n: '08', q: 'Equipe', a: p.column8Equipe },
  ];
  const logLines = (p.logAvisosDoMotor ?? '').split('\n').filter((l) => l.trim());

  return (
    <section className="glass p-5 sm:p-7" aria-label="Ficha do projeto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>
            Projeto · {p.versoMetodologia ?? 'versão não informada'} · cadastro {formatDate(p.dataDeCadastro)}
          </Eyebrow>
          <h1 className="mt-2 break-words text-2xl font-medium leading-tight tracking-[-0.025em] text-foreground sm:text-3xl">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={calcTone(p.calculadora)} title="Status da calculadora">Calculadora: {p.calculadora ?? '—'}</Pill>
            <Pill tone={envioTone(p.envioAoPlanejamento)} title="Envio ao planejamento">Envio: {p.envioAoPlanejamento ?? 'Não enviado'}</Pill>
            <Pill tone="neutral">Execução {formatDate(p.dataDaLtimaExecuo)}</Pill>
            {p.responsvel?.length ? <Pill tone="dim">{p.responsvel.map((r) => r.name).filter(Boolean).join(', ')}</Pill> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-end gap-6">
          <div>
            <Eyebrow>Riscos gerados</Eyebrow>
            <p className="mono mt-1 text-4xl font-medium leading-none tabular-nums text-foreground">{p.riscosGerados ?? '—'}</p>
          </div>
          {p.linkDoPlanejamento?.url && (
            <a href={p.linkDoPlanejamento.url} target="_blank" rel="noreferrer" className="ghost-pill">
              Planejamento <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {grs.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <span className="mono-label mr-1 text-[hsl(var(--text-dim))]">GRs identificados</span>
          {grs.map((g) => (
            <span key={g} className="mono rounded-sm border border-[hsl(var(--cobalt)/0.35)] bg-[hsl(var(--surface-deep))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--sky))]">
              {g}
            </span>
          ))}
        </div>
      )}

      <Collapsible open={open} onOpenChange={setOpen} className="mt-6 border-t border-[hsl(var(--border))] pt-4">
        <CollapsibleTrigger className="mono-label flex min-h-11 w-full items-center justify-between text-muted-foreground hover:text-foreground lg:min-h-8">
          Respostas da Etapa 1 e registro do motor
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--border))] sm:grid-cols-2">
              {answers.map((a) => (
                <div key={a.n} className="min-w-0 bg-[hsl(var(--surface-deep)/0.8)] px-4 py-3">
                  <dt className="mono-label flex gap-2 text-[hsl(var(--text-dim))]">
                    <span className="text-[hsl(var(--sky))]">{a.n}</span> {a.q}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-foreground">{a.a?.length ? a.a.join(', ') : <span className="text-muted-foreground">Sem resposta</span>}</dd>
                </div>
              ))}
              <div className="min-w-0 bg-[hsl(var(--surface-deep)/0.8)] px-4 py-3 sm:col-span-2">
                <dt className="mono-label flex gap-2 text-[hsl(var(--text-dim))]">
                  <span className="text-[hsl(var(--sky))]">8.5</span> Outros tipos de contratação &gt; membros efetivos
                </dt>
                <dd className="mt-1 text-sm">
                  {p.column85OutrosTiposDeContrataoMembrosEfetivos ? (
                    <span className="text-[hsl(var(--sky))]">Marcado</span>
                  ) : (
                    <span className="text-muted-foreground">Não marcado</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="min-w-0">
              <Eyebrow>Log / avisos do motor</Eyebrow>
              {logLines.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">O motor ainda não registrou execução para este projeto.</p>
              ) : (
                <div className="mono mt-2 max-h-64 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-deep))] p-3 text-[12px] leading-relaxed">
                  {logLines.map((l, i) => (
                    <p key={i} className={cn('whitespace-pre-wrap break-words', /aviso/i.test(l) ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground')}>
                      {l}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
