import { MODALIDADES, type ContagemModalidade } from '@generated/lib/negocio';

/** Chips "CLT · Bolsa · Estágio · RPA fixo" com contagem (só modalidades presentes). */
export function EquipeChips({ cont, semModalidade = 0 }: { cont: ContagemModalidade | null | undefined; semModalidade?: number }) {
  const itens = MODALIDADES.filter((m) => (cont?.[m] ?? 0) > 0);
  if (!itens.length && !semModalidade) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {itens.map((m) => (
        <span key={m} className="tnum inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-xs text-foreground">
          <span className="text-muted-foreground">{m}</span> {cont?.[m]}
        </span>
      ))}
      {semModalidade > 0 && (
        <span className="tnum inline-flex h-6 items-center rounded-full bg-[hsl(var(--neutral-soft))] px-2 text-xs text-[hsl(var(--neutral-ink))]" title="Fora dos totais por modalidade">
          Modalidade não informada {semModalidade}
        </span>
      )}
    </span>
  );
}
