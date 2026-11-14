import { Section } from '@generated/components/painel/Fields';
import { cn } from '@lib/utils';
import { fmtBRL2, fmtDate, type Row } from '@generated/lib/painel';

/** 1. Qual é o projeto: código, nome, gerente, vigência, último produto, dias restantes. */
export function ResumoSection({ row }: { row: Row }) {
  const p = row.projeto;
  const vig = p.contratual;
  const d = row.diasFim;
  const principais: [string, string, string?][] = [
    ['Código', p.codigo ?? '��'],
    ['Gerente', p.gerentes.join(', ') || '—'],
    ['Vigência contratual', vig ? `${fmtDate(vig.from)} – ${fmtDate(vig.to)}` : '—'],
    ['Último produto previsto', fmtDate(row.dataFim)],
    [
      'Dias restantes',
      d === null ? '—' : d < 0 ? `Vencido há ${Math.abs(d)} ${Math.abs(d) === 1 ? 'dia' : 'dias'}` : `${d} ${d === 1 ? 'dia' : 'dias'}`,
      d !== null && d < 0 ? 'text-[hsl(var(--danger-ink))] font-medium' : d !== null && d <= 90 ? 'text-[hsl(var(--warning-ink))] font-medium' : undefined,
    ],
  ];
  const extras: [string, string][] = [
    ['Cliente', p.clientes.join(', ') || '—'],
    ['Eixo', p.eixo ?? '—'],
    ['Área que acompanha', p.areas.join(', ') || '—'],
    ['Centro de Custo', p.centroCusto ?? '—'],
    ['Valor Contrato', fmtBRL2(p.valorContrato)],
    ['Faixa de Complexidade', p.faixaComplexidade ?? '—'],
  ];
  return (
    <Section title="Projeto" id="sec-resumo">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {principais.map(([k, v, cls]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={cn('tnum mt-0.5 break-words text-sm text-foreground', cls)}>{v}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-4 text-sm">
        <summary className="min-h-8 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Mais dados do projeto</summary>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {extras.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 break-words text-sm text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Section>
  );
}
