import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../utils.js';

export const Select = S.Root;
export const SelectGroup = S.Group;
export const SelectValue = S.Value;
export function SelectTrigger({ className, children, ...p }) {
  return (
    <S.Trigger className={cn('flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring [&>span]:truncate', className)} {...p}>
      {children}
      <S.Icon asChild><ChevronDown className="h-4 w-4 opacity-50" /></S.Icon>
    </S.Trigger>
  );
}
export function SelectContent({ className, children, position = 'popper', ...p }) {
  return (
    <S.Portal>
      <S.Content position={position} sideOffset={4} className={cn('z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md', position === 'popper' && 'w-[var(--radix-select-trigger-width)]', className)} {...p}>
        <S.Viewport className="p-1">{children}</S.Viewport>
      </S.Content>
    </S.Portal>
  );
}
export function SelectItem({ className, children, ...p }) {
  return (
    <S.Item className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[highlighted]:bg-muted', className)} {...p}>
      <S.ItemText>{children}</S.ItemText>
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"><S.ItemIndicator><Check className="h-4 w-4" /></S.ItemIndicator></span>
    </S.Item>
  );
}
