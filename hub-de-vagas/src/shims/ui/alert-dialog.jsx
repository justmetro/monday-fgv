import * as A from '@radix-ui/react-alert-dialog';
import { cn } from '../utils.js';

const btn = 'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50';
export const AlertDialog = A.Root;
export const AlertDialogTrigger = A.Trigger;
export function AlertDialogContent({ className, children, ...p }) {
  return (
    <A.Portal>
      <A.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <A.Content className={cn('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg', className)} {...p}>{children}</A.Content>
    </A.Portal>
  );
}
export const AlertDialogHeader = ({ className, ...p }) => <div className={cn('flex flex-col gap-2', className)} {...p} />;
export const AlertDialogFooter = ({ className, ...p }) => <div className={cn('flex justify-end gap-2', className)} {...p} />;
export const AlertDialogTitle = ({ className, ...p }) => <A.Title className={cn('text-lg font-semibold', className)} {...p} />;
export const AlertDialogDescription = ({ className, ...p }) => <A.Description className={cn('text-sm text-muted-foreground', className)} {...p} />;
export const AlertDialogAction = ({ className, ...p }) => <A.Action className={cn(btn, 'bg-primary text-primary-foreground hover:bg-primary/90', className)} {...p} />;
export const AlertDialogCancel = ({ className, ...p }) => <A.Cancel className={cn(btn, 'border border-border bg-background hover:bg-muted', className)} {...p} />;
