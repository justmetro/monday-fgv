import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils.js';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export function DialogContent({ className, children, ...p }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content aria-describedby={undefined} className={cn('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg', className)} {...p}>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"><X className="h-4 w-4" /></D.Close>
      </D.Content>
    </D.Portal>
  );
}
export const DialogHeader = ({ className, ...p }) => <div className={cn('flex flex-col gap-1.5', className)} {...p} />;
export const DialogFooter = ({ className, ...p }) => <div className={cn('flex justify-end gap-2', className)} {...p} />;
export const DialogTitle = ({ className, ...p }) => <D.Title className={cn('text-lg font-semibold', className)} {...p} />;
export const DialogDescription = ({ className, ...p }) => <D.Description className={cn('text-sm text-muted-foreground', className)} {...p} />;
