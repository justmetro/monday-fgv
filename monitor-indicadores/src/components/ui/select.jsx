import * as React from 'react';
import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@lib/utils';
export const Select = S.Root;
export const SelectGroup = S.Group;
export const SelectValue = S.Value;
export const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <S.Trigger ref={ref} className={cn('flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1', className)} {...props}>
    {children}<S.Icon asChild><ChevronDown className="h-4 w-4 opacity-50" /></S.Icon>
  </S.Trigger>
));
export const SelectContent = React.forwardRef(({ className, children, position = 'popper', ...props }, ref) => (
  <S.Portal><S.Content ref={ref} position={position} className={cn('relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1', className)} {...props}>
    <S.Viewport className={cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}>{children}</S.Viewport>
  </S.Content></S.Portal>
));
export const SelectLabel = React.forwardRef(({ className, ...props }, ref) => <S.Label ref={ref} className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />);
export const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <S.Item ref={ref} className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props}>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"><S.ItemIndicator><Check className="h-4 w-4" /></S.ItemIndicator></span>
    <S.ItemText>{children}</S.ItemText>
  </S.Item>
));
export const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => <S.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />);
