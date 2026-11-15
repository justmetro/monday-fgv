/**
 * Literal Tailwind classes per color token (dynamic class names would not be generated).
 * Keys are the CSS variable names used in lib/alocacao (TEMP_COR / CAP_COR / COMPLEX_COR).
 */
export const DOT: Record<string, string> = {
  '--temp-reforco': 'bg-[hsl(var(--temp-reforco))]',
  '--temp-assinado': 'bg-[hsl(var(--temp-assinado))]',
  '--temp-15': 'bg-[hsl(var(--temp-15))]',
  '--temp-30': 'bg-[hsl(var(--temp-30))]',
  '--temp-45': 'bg-[hsl(var(--temp-45))]',
  '--temp-mudanca': 'bg-[hsl(var(--temp-mudanca))]',
  '--temp-sem': 'bg-[hsl(var(--temp-sem))]',
  '--farol-red': 'bg-[hsl(var(--farol-red))]',
  '--farol-yellow': 'bg-[hsl(var(--farol-yellow))]',
  '--farol-green': 'bg-[hsl(var(--farol-green))]',
  '--farol-gray': 'bg-[hsl(var(--farol-gray))]',
};

export const CHIP: Record<string, string> = {
  '--temp-reforco': 'border-[hsl(var(--temp-reforco)/0.5)] bg-[hsl(var(--temp-reforco)/0.14)] text-[hsl(var(--temp-reforco))]',
  '--temp-assinado': 'border-[hsl(var(--temp-assinado)/0.5)] bg-[hsl(var(--temp-assinado)/0.14)] text-[hsl(var(--temp-assinado))]',
  '--temp-15': 'border-[hsl(var(--temp-15)/0.5)] bg-[hsl(var(--temp-15)/0.14)] text-[hsl(var(--temp-15))]',
  '--temp-30': 'border-[hsl(var(--temp-30)/0.5)] bg-[hsl(var(--temp-30)/0.14)] text-[hsl(var(--temp-30))]',
  '--temp-45': 'border-[hsl(var(--temp-45)/0.5)] bg-[hsl(var(--temp-45)/0.14)] text-[hsl(var(--temp-45))]',
  '--temp-mudanca': 'border-[hsl(var(--temp-mudanca)/0.5)] bg-[hsl(var(--temp-mudanca)/0.14)] text-[hsl(var(--temp-mudanca))]',
  '--temp-sem': 'border-border bg-[hsl(var(--neutral-soft))] text-muted-foreground',
  '--farol-red': 'border-[hsl(var(--farol-red)/0.5)] bg-[hsl(var(--farol-red)/0.14)] text-[hsl(var(--farol-red))]',
  '--farol-yellow': 'border-[hsl(var(--farol-yellow)/0.5)] bg-[hsl(var(--farol-yellow)/0.14)] text-[hsl(var(--farol-yellow))]',
  '--farol-green': 'border-[hsl(var(--farol-green)/0.5)] bg-[hsl(var(--farol-green)/0.14)] text-[hsl(var(--farol-green))]',
  '--farol-gray': 'border-border bg-[hsl(var(--neutral-soft))] text-muted-foreground',
  // Gantt capacity colors: tinted background + foreground text (the light pink is unreadable as text).
  '--cap-curto': 'border-[hsl(var(--cap-curto)/0.6)] bg-[hsl(var(--cap-curto)/0.22)] text-foreground',
  '--cap-medio': 'border-[hsl(var(--cap-medio)/0.6)] bg-[hsl(var(--cap-medio)/0.22)] text-foreground',
  '--cap-longo': 'border-[hsl(var(--cap-longo)/0.6)] bg-[hsl(var(--cap-longo)/0.22)] text-foreground',
};

DOT['--cap-curto'] = 'bg-[hsl(var(--cap-curto))]';
DOT['--cap-medio'] = 'bg-[hsl(var(--cap-medio))]';
DOT['--cap-longo'] = 'bg-[hsl(var(--cap-longo))]';

/** Capacity colors of the “Alocação por Gerente” Gantt / list (bars, legend and chips). */
export const GANTT_CAP_COR: Record<'Curto prazo' | 'Médio prazo' | 'Longo prazo' | 'Não', string> = {
  'Curto prazo': '--cap-curto', 'Médio prazo': '--cap-medio', 'Longo prazo': '--cap-longo', Não: '--farol-gray',
};

export const cor = (v: string) => `hsl(var(${v}))`;
