import type { AlocCtx } from '@generated/components/alocacao/ctx';

/** What was revised manually (capacity and/or eixos) among the given managers of the Mapa. */
export function revisadoDe(ctx: AlocCtx, gerenteIds: string[]): { cap: boolean; eixos: boolean } {
  const todos = [...ctx.modelo.gerentes, ...ctx.modelo.desativados];
  const ids = new Set(gerenteIds);
  const sel = todos.filter((g) => ids.has(g.g.id));
  return { cap: sel.some((g) => !!g.cap.ajuste), eixos: sel.some((g) => !!g.eixos.ajuste) };
}

export const textoRevisado = (r: { cap: boolean; eixos: boolean }) =>
  r.cap && r.eixos ? 'capacidade e eixos' : r.cap ? 'capacidade' : 'eixos';

/** Blue "R": only shown in Validação, when the manager's capacity or eixos were revised manually. */
export function RevisadoR({ r }: { r: { cap: boolean; eixos: boolean } }) {
  if (!r.cap && !r.eixos) return null;
  const t = `Revisado manualmente: ${textoRevisado(r)}`;
  return (
    <span title={t} aria-label={t} className="inline-flex size-5 items-center justify-center rounded-[var(--radius-sm)] bg-[hsl(var(--accent-soft))] text-[11px] font-semibold text-primary">
      R
    </span>
  );
}
