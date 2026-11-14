import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import 'react-day-picker/style.css';
import { cn } from '../utils.js';

export function Calendar({ className, ...p }) {
  return <DayPicker locale={ptBR} className={cn('p-3 text-sm [--rdp-accent-color:hsl(var(--primary))] [--rdp-accent-background-color:hsl(var(--muted))]', className)} {...p} />;
}
