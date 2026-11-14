import { useMemo } from 'react';
import { buildTree, EMPTY } from '@generated/lib/engine';
import { Pill, PessoaName } from '@generated/components/Pill';
import { RoundAge, InterviewAge, VagaAge, AgeBadge, perfilAge } from '@generated/components/Age';
import { DragBoard, Draggable, DropZone } from '@generated/components/edit/Dnd';
import { useEdit } from '@generated/components/edit/EditProvider';
import { kindOf, optionsFor, rawLabel } from '@generated/lib/editing';
import { colorFor } from '@generated/lib/colors';
import { canon, normKey, pillVars, PILL_CLS } from '@generated/lib/normalize';

function Card({ it, subtitle, badgeKey, onOpen }) {
  return (
    <button onClick={() => onOpen(it)} className="lift w-full rounded-md border border-border bg-card p-3 text-left text-sm hover:shadow-[var(--glow-stack)]">
      <div className="line-clamp-2 font-medium">{it._pessoa != null ? <PessoaName match={it} /> : it.name}</div>
      {subtitle && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtitle(it)}</div>}
      {badgeKey && it[badgeKey] && <div className="mt-2"><Pill fieldKey={badgeKey} label={it[badgeKey]} /></div>}
      <div className="mt-2 flex flex-wrap gap-1">
        {it._pessoa != null ? <><RoundAge match={it} /><InterviewAge match={it} /></> : it._matches && 'vagaEmAberto' in it ? <VagaAge vaga={it} /> : perfilAge(it) ? <AgeBadge {...perfilAge(it)} /> : null}
      </div>
    </button>
  );
}

export default function KanbanView({ items, field, onOpen, subtitle, badgeKey }) {
  const { editMode, canFor, edit } = useEdit();
  const kind = items.length ? kindOf(field.key, items[0]) : null;
  const dragOn = !!kind && editMode && canFor(kind);

  const columns = useMemo(() => {
    const cols = buildTree(items, [field]) ?? [];
    if (!dragOn) return cols;
    // When dragging is possible, offer every real label as a drop target (even empty ones).
    const have = new Set(cols.map((c) => normKey(c.label)));
    const extra = optionsFor(field.key).filter((o) => !have.has(normKey(canon(o)))).map((o) => ({ id: `empty:${o}`, label: canon(o), color: colorFor(field.key, o), items: [] }));
    const merged = [...cols.filter((c) => c.label !== EMPTY), ...extra];
    if (field.order) { const o = field.order.map(normKey); const ix = (c) => { const i = o.indexOf(normKey(c.label)); return i < 0 ? 999 : i; }; merged.sort((a, b) => ix(a) - ix(b)); }
    const empty = cols.filter((c) => c.label === EMPTY);
    return [...merged, ...(empty.length ? empty : [{ id: 'empty:none', label: EMPTY, color: '#c4c4c4', items: [] }])];
  }, [items, field, dragOn]);

  const ph = (field.placeholders ?? []).filter((p) => !columns.some((c) => normKey(c.label) === normKey(p.label)));
  if (!columns.length && !ph.length) return null;
  const onMove = (it, label) => edit(kind, it, field.key, label === EMPTY ? null : rawLabel(field.key, label)); // Sem informação = limpar

  return (
    <DragBoard enabled={dragOn} onMove={onMove} renderOverlay={(it) => <Card it={it} subtitle={subtitle} badgeKey={badgeKey} onOpen={() => {}} />}>
      {dragOn && <p className="mb-2 text-xs text-muted-foreground">Arraste os cartões entre colunas para alterar “{field.label}”.</p>}
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3">
        {ph.map((p) => (
          <div key={`ph:${p.label}`} className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-md border border-dashed border-border bg-muted/20 sm:w-72">
            <div className="flex items-center gap-2 rounded-t-md px-3 py-2 text-sm font-medium"><span className="truncate">{p.label}</span><span className="ml-auto rounded-full bg-muted px-2 text-xs tabular-nums text-muted-foreground">—</span></div>
            <p className="px-3 pb-4 pt-2 text-center text-xs text-muted-foreground">{p.note}</p>
          </div>
        ))}
        {columns.map((c) => (
          <DropZone key={c.id} id={c.label} enabled={dragOn} className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-md border border-border bg-muted/40 transition-shadow sm:w-72">
            <div className={`flex items-center gap-2 rounded-t-md px-3 py-2 text-sm font-medium ${PILL_CLS}`} style={pillVars(c.color)}>
              <span className="truncate">{c.label}</span>
              <span className="ml-auto rounded-full bg-background/30 px-2 text-foreground text-xs tabular-nums">{c.items.length}</span>
            </div>
            {c.label === EMPTY && field.emptyHint && <p className="px-3 pt-2 text-[11px] text-muted-foreground">Motivo: {field.emptyHint}</p>}
            <div className="flex max-h-[65vh] min-h-16 flex-col gap-2 overflow-y-auto p-2">
              {c.items.map((it) => (
                <Draggable key={`${c.id}-${it.id}`} id={`${c.id}-${it.id}`} item={it} column={c.label} enabled={dragOn}>
                  <Card it={it} subtitle={subtitle} badgeKey={badgeKey} onOpen={onOpen} />
                </Draggable>
              ))}
              {!c.items.length && <p className="py-4 text-center text-xs text-muted-foreground">{dragOn ? 'Solte aqui' : 'Vazio'}</p>}
            </div>
          </DropZone>
        ))}
      </div>
    </DragBoard>
  );
}
