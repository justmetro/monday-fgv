import * as React from 'react';
import * as P from '@radix-ui/react-popover';
import { cn } from '@lib/utils';
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverContent = React.forwardRef(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <P.Portal><P.Content ref={ref} align={align} sideOffset={sideOffset} className={cn('z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)} {...props} /></P.Portal>
));
