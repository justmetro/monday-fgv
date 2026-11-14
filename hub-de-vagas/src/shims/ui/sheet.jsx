import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils.js';

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;
const SIDE = {
  right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
  left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
  top: 'inset-x-0 top-0 border-b',
  bottom: 'inset-x-0 bottom-0 border-t',
};
export function SheetContent({ side = 'right', className, children, ...p }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content aria-describedby={undefined} className={cn('fixed z-50 flex flex-col gap-4 border-border bg-background p-6 shadow-lg', SIDE[side], className)} {...p}>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"><X className="h-4 w-4" /></D.Close>
      </D.Content>
    </D.Portal>
  );
}
export const SheetHeader = ({ className, ...p }) => <div className={cn('flex flex-col gap-1.5', className)} {...p} />;
export const SheetTitle = ({ className, ...p }) => <D.Title className={cn('text-lg font-semibold', className)} {...p} />;
export const SheetDescription = ({ className, ...p }) => <D.Description className={cn('text-sm text-muted-foreground', className)} {...p} />;
