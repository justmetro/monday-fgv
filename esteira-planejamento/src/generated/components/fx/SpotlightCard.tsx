import type { PointerEvent, ReactNode } from 'react';
import { cn } from '@lib/utils';

/** Pointer-following spotlight on border + surface (Magic UI MagicCard look, MIT). No re-render on move. */
/** Pointer handler for elements that can't be wrapped (e.g. an <li>): add class "fx-spot" + onPointerMove={spotMove}. */
export function spotMove(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--fx-x', `${e.clientX - r.left}px`);
  el.style.setProperty('--fx-y', `${e.clientY - r.top}px`);
}

export function SpotlightCard({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div onPointerMove={spotMove} className={cn('fx-spot', className)}>
      {children}
    </div>
  );
}
