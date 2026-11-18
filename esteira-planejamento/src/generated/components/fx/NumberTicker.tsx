import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@lib/utils';

interface Props extends ComponentPropsWithoutRef<'span'> {
  value: number;
  decimalPlaces?: number;
  format?: (n: number) => string;
  delay?: number;
}

/** Número formatado, sem animação de contagem (mostra o valor final direto). */
export function NumberTicker({ value, decimalPlaces = 0, format, delay: _delay, className, ...props }: Props) {
  const txt = format
    ? format(value)
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(value.toFixed(decimalPlaces)));
  return <span className={cn('inline-block tabular-nums', className)} {...props}>{txt}</span>;
}
