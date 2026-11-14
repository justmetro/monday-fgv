import * as React from 'react';
import * as A from '@radix-ui/react-alert-dialog';
import { cn } from '@lib/utils';
export const AlertDialog = A.Root;
export const AlertDialogTrigger = A.Trigger;
export const AlertDialogPortal = A.Portal;
export const AlertDialogOverlay = React.forwardRef<any, any>(({ className, ...props }, ref) => <A.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-black/60', className)} {...props} />);
export const AlertDialogContent = React.forwardRef<any, any>(({ className, ...props }, ref) => (
  <A.Portal><AlertDialogOverlay /><A.Content ref={ref} className={cn('fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg', className)} {...props} /></A.Portal>
));
export const AlertDialogHeader = ({ className, ...props }: any) => <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />;
export const AlertDialogFooter = ({ className, ...props }: any) => <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />;
export const AlertDialogTitle = React.forwardRef<any, any>(({ className, ...props }, ref) => <A.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />);
export const AlertDialogDescription = React.forwardRef<any, any>(({ className, ...props }, ref) => <A.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />);
const btn = 'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50';
export const AlertDialogAction = React.forwardRef<any, any>(({ className, ...props }, ref) => <A.Action ref={ref} className={cn(btn, 'bg-primary text-primary-foreground hover:bg-primary/90', className)} {...props} />);
export const AlertDialogCancel = React.forwardRef<any, any>(({ className, ...props }, ref) => <A.Cancel ref={ref} className={cn(btn, 'mt-2 border border-input bg-background hover:bg-accent sm:mt-0', className)} {...props} />);
