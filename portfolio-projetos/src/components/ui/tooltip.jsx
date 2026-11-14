import * as React from 'react';
import * as T from '@radix-ui/react-tooltip';
import { cn } from '@lib/utils';
export const TooltipProvider = T.Provider;
export const Tooltip = T.Root;
export const TooltipTrigger = T.Trigger;
export const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <T.Portal><T.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95', className)} {...props} /></T.Portal>
));
