import * as C from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '../utils.js';

export function Checkbox({ className, ...p }) {
  return (
    <C.Root className={cn('peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:opacity-50', className)} {...p}>
      <C.Indicator><Check className="h-3 w-3" /></C.Indicator>
    </C.Root>
  );
}
