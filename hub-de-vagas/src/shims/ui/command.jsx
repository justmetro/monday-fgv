import { Command as C } from 'cmdk';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './dialog.jsx';
import { cn } from '../utils.js';

export const Command = ({ className, ...p }) => <C className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)} {...p} />;
export function CommandDialog({ open, onOpenChange, title, description, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">{title ?? 'Busca'}</DialogTitle>
        <DialogDescription className="sr-only">{description ?? ''}</DialogDescription>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">{children}</Command>
      </DialogContent>
    </Dialog>
  );
}
export function CommandInput({ className, ...p }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3">
      <Search className="h-4 w-4 shrink-0 opacity-50" />
      <C.Input className={cn('flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground', className)} {...p} />
    </div>
  );
}
export const CommandList = ({ className, ...p }) => <C.List className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)} {...p} />;
export const CommandEmpty = (p) => <C.Empty className="py-6 text-center text-sm" {...p} />;
export const CommandGroup = ({ className, ...p }) => <C.Group className={cn('overflow-hidden p-1', className)} {...p} />;
export const CommandItem = ({ className, ...p }) => <C.Item className={cn('relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-muted', className)} {...p} />;
export const CommandSeparator = ({ className, ...p }) => <C.Separator className={cn('-mx-1 h-px bg-border', className)} {...p} />;
