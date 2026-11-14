import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { useState } from 'react';
import { cn } from '@lib/utils';

// Board-level drag context. onMove(item, targetId) fires when a card lands on a different column.
export function DragBoard({ enabled, onMove, renderOverlay, children }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const [activeItem, setActiveItem] = useState(null);
  if (!enabled) return children;
  return (
    <DndContext sensors={sensors}
      onDragStart={(e) => setActiveItem(e.active.data.current?.item ?? null)}
      onDragCancel={() => setActiveItem(null)}
      onDragEnd={(e) => {
        setActiveItem(null);
        const item = e.active.data.current?.item;
        const from = e.active.data.current?.column;
        const to = e.over?.id;
        if (item && to != null && to !== from) onMove(item, to);
      }}>
      {children}
      <DragOverlay dropAnimation={null}>{activeItem && renderOverlay ? <div className="rotate-1 opacity-95 shadow-[var(--shadow-pop)]">{renderOverlay(activeItem)}</div> : null}</DragOverlay>
    </DndContext>
  );
}

export function Draggable({ id, item, column, enabled, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { item, column }, disabled: !enabled });
  if (!enabled) return children;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} aria-roledescription="cartão arrastável" className={cn('touch-none', isDragging && 'opacity-40')}>
      {children}
    </div>
  );
}

export function DropZone({ id, enabled, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled });
  return <div ref={setNodeRef} className={cn(className, enabled && isOver && 'ring-2 ring-primary/70 ring-offset-1 ring-offset-background')}>{children}</div>;
}
