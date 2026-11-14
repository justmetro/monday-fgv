import * as S from '@radix-ui/react-slider';
import { cn } from '../utils.js';

export function Slider({ className, value, defaultValue, ...p }) {
  const vals = value ?? defaultValue ?? [0];
  return (
    <S.Root value={value} defaultValue={defaultValue} className={cn('relative flex w-full touch-none select-none items-center', className)} {...p}>
      <S.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"><S.Range className="absolute h-full bg-primary" /></S.Track>
      {vals.map((_, i) => <S.Thumb key={i} className="block h-4 w-4 rounded-full border border-primary bg-background shadow focus-visible:outline-none" />)}
    </S.Root>
  );
}
