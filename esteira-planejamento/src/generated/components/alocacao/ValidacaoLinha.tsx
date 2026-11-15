import { cn } from '@lib/utils';
import { Checkbox } from '@components/ui/checkbox';
import { codigoDe, fmtDate, tituloDe, DASH } from '@generated/lib/format';
import type { LinhaValidacao } from '@generated/lib/relatorio';
import { NomeLink } from '@generated/components/NomeLink';
import { Chip } from '@generated/components/alocacao/bits';
import { trCls } from '@generated/components/alocacao/cards';
import { type AlocCtx, NomeGerente } from '@generated/components/alocacao/ctx';
import { TipoTag, ExperienciaGerente } from '@generated/components/alocacao/DestinoGerentes';
import { RevisadoR, revisadoDe } from '@generated/components/alocacao/RevisadoR';

/** One validation row: arriving project, managers, type, arrival, the manager's other active projects (overlap in red), situation. */
export function ValidacaoLinha({ ctx, l, marcado, onToggle }: { ctx: AlocCtx; l: LinhaValidacao; marcado: boolean; onToggle: () => void }) {
  const { d, chegada } = l;
  const gerentesDd = new Set(l.destinos.filter((g) => g.tipoDestino === 'gerente').map((g) => g.gerenteId)).size;
  const revisado = revisadoDe(ctx, l.destinos.flatMap((g) => (g.gerenteId ? [g.gerenteId] : [])));
  return (
    <tr data-item-id={d.p.id} className={trCls}>
      <td className="px-3 py-2"><Checkbox checked={marcado} onCheckedChange={onToggle} aria-label={`Selecionar ${d.p.name}`} /></td>
      <td className="max-w-[300px] px-3 py-2">
        <span className="font-mono-code block text-[11px] text-primary">{codigoDe(d.p) ?? DASH}</span>
        <NomeLink p={d.p} />
        <span className="block text-[11px] text-[hsl(var(--fg-subtle))]">temp. {d.temp.valor}</span>
      </td>
      <td className="px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {l.destinos.map((g) => (
            <li key={g.id} className="text-[13px]">
              {g.gerenteId ? <NomeGerente ctx={ctx} id={g.gerenteId} nome={g.rotulo} className="font-normal" /> : <span className="text-foreground">{g.rotulo}</span>}
              {g.gerenteId && <ExperienciaGerente ctx={ctx} gerenteId={g.gerenteId} d={d} className="max-w-[240px]" />}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-3 py-2"><span className="flex flex-wrap gap-1">{l.tipos.map((t) => <TipoTag key={t} tipo={t} />)}</span></td>
      <td className="tnum whitespace-nowrap px-3 py-2" title={chegada.rotuloOrigem}>
        {chegada.inicio ? <span className="text-foreground">{fmtDate(chegada.inicio)}</span> : <span className="text-[hsl(var(--warning))]">Sem previsão</span>}
        <span className="block text-[11px] text-[hsl(var(--fg-subtle))]">{chegada.meses} meses</span>
      </td>
      <td className="min-w-[240px] px-3 py-2">
        {l.destinos.every((g) => g.tipoDestino !== 'gerente') ? <span className="text-xs text-[hsl(var(--fg-subtle))]">—</span> : (
          <ul className="flex flex-col gap-1">
            {l.destinos.filter((g) => g.tipoDestino === 'gerente').map((g) => (
              <li key={g.id} className="min-w-0 text-xs">
                {l.destinos.length > 1 && <span className="block text-[10px] uppercase tracking-wide text-[hsl(var(--fg-subtle))]">{g.rotulo}</span>}
                {g.outros.length === 0 ? <span className="text-muted-foreground">Nenhum outro projeto ativo</span> : g.outros.map((o) => (
                  <span key={o.p.id} className="flex min-w-0 items-baseline gap-1.5">
                    <span className="min-w-0 truncate text-foreground" title={o.p.name}>{tituloDe(o.p)}</span>
                    <span className={cn('tnum shrink-0', o.sobrepoe ? 'font-medium text-[hsl(var(--danger))]' : 'text-muted-foreground')}
                      title={o.sobrepoe ? 'Término depois da chegada prevista: sobreposição' : 'Término antes da chegada prevista'}>
                      {o.termino ? fmtDate(o.termino) : 'sem data'}
                    </span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="flex flex-col items-start gap-1">
          <Chip corVar="--temp-45">Pendente</Chip>
          {l.sobreposicaoAte && <span className="text-[11px] text-[hsl(var(--danger))]">sobreposição até {fmtDate(l.sobreposicaoAte)}</span>}
          {gerentesDd > 3 && <span className="text-[11px] text-[hsl(var(--danger))]">mais de 3 gerentes</span>}
          {d.gerenteJaNo0201 && <span className="text-[11px] text-muted-foreground">gerente já no 02.01</span>}
        </span>
      </td>
      <td className="w-8 px-1 py-2 text-center"><RevisadoR r={revisado} /></td>
    </tr>
  );
}
