import type { ReactNode } from 'react';
import { cn } from '@lib/utils';

/** Cartão simples (o efeito de luz seguindo o mouse foi retirado por desempenho). */
export function spotMove() {}

export function SpotlightCard({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn(className)}>{children}</div>;
}
