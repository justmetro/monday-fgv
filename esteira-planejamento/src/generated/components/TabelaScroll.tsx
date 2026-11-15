import type { ReactNode } from 'react';
import { ScrollArea, ScrollBar } from '@components/ui/scroll-area';
import { cn } from '@lib/utils';

const barra = 'h-2 w-2 p-0 [&:hover>[data-slot=scroll-area-thumb]]:!bg-[hsl(var(--muted-foreground)/0.5)]';

/** Scrolling table container: thin themed bars, horizontal bar always visible at the bottom of the visible table (height limited to the screen). */
export function TabelaScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollArea type="always" className={cn('w-full [&>[data-slot=scroll-area-viewport]]:max-h-[calc(100dvh-13rem)] [&>[data-slot=scroll-area-viewport]]:min-h-0', className)}>
      {children}
      <ScrollBar orientation="horizontal" className={barra} />
    </ScrollArea>
  );
}
