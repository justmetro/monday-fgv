import { useState } from 'react';
import { AlertTriangle, CalendarX, Clock, DatabaseZap, Link2Off } from 'lucide-react';
import type { IndicatorDoc } from '@generated/models';
import { k, type Model, type Slice } from '@generated/lib/metrics';
import { fmtDate } from '@generated/lib/format';
import { cn } from '@lib/utils';
import { Panel, SectionTitle } from '../ui-bits';

type Tab = 'late' | 'meta' | 'semBase' | 'semPrazo' | 'issues';
const KIND: Record<string, string> = { 'sem-vinculo': 'Sem vínculo', 'ref-ausente': 'Referência não importada', divergencia: 'Divergência' };

export function AttentionList({ model, s, onIndicator }: { model: Model; s: Slice; onIndicator: (i: IndicatorDoc) => void }) {
  const [tab, setTab] = useState<Tab>('late');
  const tabs = [
    { id: 'late' as const, label: 'Medições atrasadas', n: s.late.length, icon: Clock },
    { id: 'meta' as const, label: 'Metas não alcançadas', n: s.notReached.length, icon: AlertTriangle },
    { id: 'semBase' as const, label: 'Sem base de dados', n: s.semBase.length, icon: DatabaseZap },
    { id: 'semPrazo' as const, label: 'Sem prazo', n: s.semPrazo.length, icon: CalendarX },
    { id: 'issues' as const, label: 'Inconsistências de vínculo', n: s.issues.length, icon: Link2Off },
  ];
  const proj = (b: string) => model.projectBy.get(b)?.name ?? b;
  const open = (boardId: string, indIds: string[]) => {
    const ind = indIds.map((id) => model.indBy.get(k(boardId, id))).find(Boolean);
    if (ind) onIndicator(ind);
  };
  const list = tab === 'late' ? s.late : tab === 'meta' ? s.notReached : tab === 'semBase' ? s.semBase : s.semPrazo;

  return (
    <Panel>
      <SectionTitle>Lista de atenção</SectionTitle>
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm', tab === t.id ? 'border-primary font-medium' : 'border-transparent text-muted-foreground')}>
            <t.icon className="size-4" aria-hidden />{t.label}<span className="rounded-sm bg-muted px-1.5 font-mono text-xs">{t.n}</span>
          </button>
        ))}
      </div>
      <ul className="max-h-96 divide-y divide-border overflow-y-auto">
        {tab !== 'issues' && list.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nada a sinalizar no recorte.</li>}
        {tab !== 'issues' && list.map((m) => (
          <li key={`${m.projectBoardId}:${m.itemId}`}>
            <button onClick={() => open(m.projectBoardId, m.indicadorIds)} className="grid w-full grid-cols-1 gap-1 py-2.5 text-left text-sm hover:bg-muted/50 sm:grid-cols-[1fr_auto]">
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{proj(m.projectBoardId)} · {model.indicatorsOf(m).map((i) => i.name).join(', ') || 'sem indicador resolvido'}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground sm:text-right">
                {tab === 'meta' ? `${m.statusMeta} · ${m.statusMedicao ?? ''}` : `Prazo ${fmtDate(m.prazo)} · ${m.statusMedicao ?? 'sem status'}`}
              </span>
            </button>
          </li>
        ))}
        {tab === 'issues' && s.issues.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhuma inconsistência de vínculo.</li>}
        {tab === 'issues' && s.issues.map((is, n) => (
          <li key={n} className="py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-[hsl(var(--warn-soft))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--warn))]">{KIND[is.kind]}</span>
              <span className="text-[11px] uppercase text-muted-foreground">{is.entity === 'medicao' ? 'Medição' : 'Indicador'}</span>
              <span className="font-medium">{is.name}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{proj(is.projectBoardId)} · {is.detail}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
