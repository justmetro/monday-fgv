import * as P from '@radix-ui/react-popover';
import { cn } from '../utils.js';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export function PopoverContent({ className, align = 'center', sideOffset = 4, ...p }) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn('z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none', className)} {...p} />
    </P.Portal>
  );
}
