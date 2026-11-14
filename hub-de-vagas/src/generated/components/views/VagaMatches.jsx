import { ChevronRight, AlertTriangle } from 'lucide-react';
import { Pill, PessoaName } from '@generated/components/Pill';
import { fmtDate } from '@generated/lib/data';
import { RoundAge, InterviewAge, VagaAge } from '@generated/components/Age';
import { EditableStatus, EditableDate, EditableText } from '@generated/components/edit/Editable';
import { colorFor } from '@generated/lib/colors';
import { cn } from '@lib/utils';
import { SemDadosBadge } from '@generated/components/Age';

import { vagaPrazo } from '@generated/lib/esteira';

const isLate = (v) => vagaPrazo(v) === 'Atrasada';

export default function VagaMatches({ vagas, collapsed, toggle, onOpen }) {
  return (
    <div className="space-y-2">
      {vagas.map((v) => {
        const id = `vaga:${v.id}`;
        const open = !collapsed.has(id);
        const late = isLate(v);
        const color = late ? 'hsl(var(--destructive))' : colorFor('statusDaVaga', v.statusDaVaga);
        const ms = v._visibleMatches ?? v._matches;
        return (
          <section key={v.id} className="overflow-hidden rounded-md border border-border bg-card">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] px-2 py-2" style={{ borderLeftColor: color }}>
              <button onClick={() => toggle(id)} aria-label={open ? 'Recolher' : 'Expandir'} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
                <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} style={{ color }} />
              </button>
              <button onClick={() => onOpen('vaga', v)} className="min-w-0 flex-1 text-left">
                <span className={cn('flex items-center gap-1.5 truncate font-medium hover:underline', late && 'text-destructive')}>
                  {late && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}{v.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">Cód. {v.id} · {v.projeto || 'Sem projeto'} · {v.cargoPapel || 'Sem cargo'} · Início {v.dataDeIncioPrevista ? fmtDate(v.dataDeIncioPrevista) : 'Sem data'}</span>
                <VagaAge vaga={v} className="mt-1" />
              </button>
              <Pill fieldKey="statusDaVaga" label={v.statusDaVaga} />
              <span className="rounded-full border border-border px-2 text-xs tabular-nums text-muted-foreground">{ms.length} {ms.length === 1 ? 'match' : 'matches'}</span>
            </header>
            {open && (ms.length === 0 ? (
              <p className="border-t border-border px-12 py-3 text-sm text-muted-foreground">Sem matches</p>
            ) : (
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full min-w-[860px] text-sm">
                  <thead><tr className="text-xs text-muted-foreground">
                    {['Pessoa', 'Rodada', 'Resultado da Rodada', 'Status do Match', 'Envio do Card', 'Entrevista', 'Próxima Ação'].map((h) => <th key={h} className="px-3 py-1.5 text-left font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {ms.map((m) => (
                      <tr key={m.id} onClick={() => onOpen('match', m)} className="cursor-pointer border-t border-border hover:bg-accent/40">
                        <td className="max-w-[240px] px-3 py-2 font-medium"><PessoaName match={m} /><SemDadosBadge m={m} /></td>
                        <td className="px-3 py-2"><EditableStatus item={m} fieldKey="rodada" /></td>
                        <td className="px-3 py-2"><EditableStatus item={m} fieldKey="resultadoDaRodada" /></td>
                        <td className="px-3 py-2"><EditableStatus item={m} fieldKey="statusDoMatch" /></td>
                        <td className="px-3 py-2 tabular-nums"><span className="flex flex-col items-start gap-1"><EditableDate item={m} fieldKey="dataDeEnvioDoCard" /><RoundAge match={m} /></span></td>
                        <td className="px-3 py-2 tabular-nums"><span className="flex flex-col items-start gap-1"><EditableDate item={m} fieldKey="dataDaEntrevista" /><InterviewAge match={m} /></span></td>
                        <td className="max-w-[260px] px-3 py-2"><EditableText item={m} fieldKey="prximaAo" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
