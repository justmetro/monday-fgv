import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react';

const cx = (...c: (string | undefined | false)[]) => c.filter(Boolean).join(' ');
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export function DialogContent({ className, children, ...p }: ComponentPropsWithoutRef<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content className={cx('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-card p-6 shadow-lg', className)} {...p}>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"><X className="h-4 w-4" /></D.Close>
      </D.Content>
    </D.Portal>
  );
}
export const DialogHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cx('flex flex-col gap-1.5', className)} {...p} />;
export const DialogTitle = ({ className, ...p }: ComponentPropsWithoutRef<typeof D.Title>) => <D.Title className={cx('text-lg font-semibold', className)} {...p} />;
export const DialogDescription = ({ className, ...p }: ComponentPropsWithoutRef<typeof D.Description>) => <D.Description className={cx('text-sm text-muted-foreground', className)} {...p} />;
