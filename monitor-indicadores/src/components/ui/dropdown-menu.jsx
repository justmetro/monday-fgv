import * as React from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@lib/utils';
export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;
export const DropdownMenuSub = M.Sub;
const item = 'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
const content = 'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';
export const DropdownMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <M.SubTrigger ref={ref} className={cn(item, 'data-[state=open]:bg-accent', inset && 'pl-8', className)} {...props}>{children}<ChevronRight className="ml-auto h-4 w-4" /></M.SubTrigger>
));
export const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => <M.Portal><M.SubContent ref={ref} className={cn(content, 'shadow-lg', className)} {...props} /></M.Portal>);
export const DropdownMenuContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => <M.Portal><M.Content ref={ref} sideOffset={sideOffset} className={cn(content, className)} {...props} /></M.Portal>);
export const DropdownMenuItem = React.forwardRef(({ className, inset, ...props }, ref) => <M.Item ref={ref} className={cn(item, inset && 'pl-8', className)} {...props} />);
export const DropdownMenuCheckboxItem = React.forwardRef(({ className, children, checked, ...props }, ref) => (
  <M.CheckboxItem ref={ref} className={cn(item, 'pl-8', className)} checked={checked} {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center"><M.ItemIndicator><Check className="h-4 w-4" /></M.ItemIndicator></span>{children}
  </M.CheckboxItem>
));
export const DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => <M.Label ref={ref} className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)} {...props} />);
export const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => <M.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />);
export const DropdownMenuShortcut = ({ className, ...props }) => <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />;
