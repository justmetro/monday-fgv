import * as M from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '../utils.js';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;
export function DropdownMenuContent({ className, sideOffset = 4, ...p }) {
  return (
    <M.Portal>
      <M.Content sideOffset={sideOffset} className={cn('z-50 min-w-[8rem] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md', className)} {...p} />
    </M.Portal>
  );
}
const item = 'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
export const DropdownMenuItem = ({ className, inset, ...p }) => <M.Item className={cn(item, inset && 'pl-8', className)} {...p} />;
export function DropdownMenuCheckboxItem({ className, children, checked, ...p }) {
  return (
    <M.CheckboxItem checked={checked} className={cn(item, 'pl-8', className)} {...p}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center"><M.ItemIndicator><Check className="h-4 w-4" /></M.ItemIndicator></span>
      {children}
    </M.CheckboxItem>
  );
}
export const DropdownMenuLabel = ({ className, ...p }) => <M.Label className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)} {...p} />;
export const DropdownMenuSeparator = ({ className, ...p }) => <M.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...p} />;
