// Versões enxutas dos componentes shadcn usados pelos Vibes.
import * as SelectP from '@radix-ui/react-select';
import * as TabsP from '@radix-ui/react-tabs';
import * as PopP from '@radix-ui/react-popover';
import * as ColP from '@radix-ui/react-collapsible';
import * as CheckP from '@radix-ui/react-checkbox';
import * as AD from '@radix-ui/react-alert-dialog';
import { Check, ChevronDown } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';
import { forwardRef, type ComponentPropsWithoutRef, type HTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@lib/utils';

export const Skeleton = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('animate-pulse rounded-md bg-muted', className)} {...p} />;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn('flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50', className)} {...p} />
));

export const Select = SelectP.Root;
export const SelectValue = SelectP.Value;
export const SelectTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof SelectP.Trigger>>(({ className, children, ...p }, ref) => (
  <SelectP.Trigger ref={ref} className={cn('flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50 [&>span]:truncate', className)} {...p}>
    {children}<SelectP.Icon asChild><ChevronDown className="size-4 opacity-60" /></SelectP.Icon>
  </SelectP.Trigger>
));
export function SelectContent({ className, children, position = 'popper', ...p }: ComponentPropsWithoutRef<typeof SelectP.Content>) {
  return (
    <SelectP.Portal>
      <SelectP.Content position={position} sideOffset={4} className={cn('z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md', position === 'popper' && 'w-[var(--radix-select-trigger-width)]', className)} {...p}>
        <SelectP.Viewport className="p-1">{children}</SelectP.Viewport>
      </SelectP.Content>
    </SelectP.Portal>
  );
}
export const SelectItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof SelectP.Item>>(({ className, children, ...p }, ref) => (
  <SelectP.Item ref={ref} className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50', className)} {...p}>
    <span className="absolute right-2 flex size-3.5 items-center justify-center"><SelectP.ItemIndicator><Check className="size-4" /></SelectP.ItemIndicator></span>
    <SelectP.ItemText>{children}</SelectP.ItemText>
  </SelectP.Item>
));

export const Tabs = TabsP.Root;
export const TabsList = ({ className, variant: _v, ...p }: ComponentPropsWithoutRef<typeof TabsP.List> & { variant?: string }) => <TabsP.List className={cn('inline-flex items-center gap-1', className)} {...p} />;
export const TabsTrigger = ({ className, ...p }: ComponentPropsWithoutRef<typeof TabsP.Trigger>) => <TabsP.Trigger className={cn('inline-flex items-center justify-center whitespace-nowrap text-sm', className)} {...p} />;
export const TabsContent = TabsP.Content;

export const Popover = PopP.Root;
export const PopoverTrigger = PopP.Trigger;
export const PopoverContent = ({ className, align = 'center', sideOffset = 4, ...p }: ComponentPropsWithoutRef<typeof PopP.Content>) => (
  <PopP.Portal><PopP.Content align={align} sideOffset={sideOffset} className={cn('z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none', className)} {...p} /></PopP.Portal>
);

export const Collapsible = ColP.Root;
export const CollapsibleTrigger = ColP.Trigger;
export const CollapsibleContent = ColP.Content;

export const Checkbox = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof CheckP.Root>>(({ className, ...p }, ref) => (
  <CheckP.Root ref={ref} className={cn('peer size-4 shrink-0 rounded-sm border border-primary disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground', className)} {...p}>
    <CheckP.Indicator className="flex items-center justify-center"><Check className="size-3.5" /></CheckP.Indicator>
  </CheckP.Root>
));

export const AlertDialog = AD.Root;
export const AlertDialogTrigger = AD.Trigger;
export function AlertDialogContent({ className, ...p }: ComponentPropsWithoutRef<typeof AD.Content>) {
  return (
    <AD.Portal>
      <AD.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <AD.Content className={cn('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-card p-6 shadow-lg', className)} {...p} />
    </AD.Portal>
  );
}
export const AlertDialogHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col gap-2', className)} {...p} />;
export const AlertDialogFooter = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...p} />;
export const AlertDialogTitle = ({ className, ...p }: ComponentPropsWithoutRef<typeof AD.Title>) => <AD.Title className={cn('text-lg font-semibold', className)} {...p} />;
export const AlertDialogDescription = ({ className, ...p }: ComponentPropsWithoutRef<typeof AD.Description>) => <AD.Description className={cn('text-sm text-muted-foreground', className)} {...p} />;
export const AlertDialogAction = ({ className, ...p }: ComponentPropsWithoutRef<typeof AD.Action>) => <AD.Action className={cn('inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground', className)} {...p} />;
export const AlertDialogCancel = ({ className, ...p }: ComponentPropsWithoutRef<typeof AD.Cancel>) => <AD.Cancel className={cn('inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm', className)} {...p} />;

export const Toaster = (p: ComponentPropsWithoutRef<typeof Sonner>) => <Sonner {...p} />;
